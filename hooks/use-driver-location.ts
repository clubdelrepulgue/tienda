"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { distanceMeters, headingDelta } from "@/lib/geolocation"

/**
 * Tracking de ubicación del repartidor.
 *
 * Objetivo: que el panel de despacho vea al repartidor moverse en tiempo real,
 * sin quemar la batería ni la cuota de escrituras, y comportándose igual en
 * iOS y en Android.
 *
 * Decisiones y por qué:
 *
 * - **Un solo `watchPosition`.** La versión anterior corría `getCurrentPosition`
 *   + `watchPosition` + un `setInterval` de `getCurrentPosition`, los tres en
 *   alta precisión. Eso triplicaba las escrituras, freía la batería y en iOS
 *   hacía que el sistema empezara a negar el sensor.
 *
 * - **Precisión adaptativa.** En iOS, CoreLocation devuelve
 *   `kCLErrorLocationUnknown` (código 2) muy seguido con
 *   `enableHighAccuracy: true`: en interiores, con el celu en el bolsillo o en
 *   el primer fix en frío. Tras 2 fallos seguidos bajamos a baja precisión
 *   (WiFi/red), que casi siempre responde, y reintentamos subir más tarde.
 *   Sin esto el repartidor queda "sin GPS" en iPhone mientras el mismo código
 *   anda bien en Android.
 *
 * - **Reanudar al volver a foreground.** iOS suspende el `watchPosition` cuando
 *   la pantalla se bloquea y NO lo reanuda al volver: el callback simplemente
 *   deja de dispararse para siempre. Reiniciamos el watch en `visibilitychange`.
 *
 * - **Envío por umbral + heartbeat.** Mandamos al servidor si se movió lo
 *   suficiente, si giró, o si pasó el intervalo de heartbeat aunque esté
 *   quieto (así `last_seen_at` prueba que sigue conectado).
 *
 * - **La última posición nunca se pierde.** Si falla la red, se guarda como
 *   pendiente y se reintenta; al cerrar la pestaña se manda con `sendBeacon`.
 */

const ENDPOINT = "/api/driver/update-location"

/** Distancia mínima (m) para considerar que se movió de verdad. */
const MIN_DISTANCE_M = 12
/** Giro mínimo (grados) que justifica un envío aunque no se haya movido mucho. */
const MIN_HEADING_DELTA = 25
/** Nunca mandamos dos posiciones separadas por menos de esto. */
const MIN_SEND_INTERVAL_MS = 3_000
/** Descartamos lecturas con error mayor a esto (ruido de torre de celular). */
const MAX_ACCEPTABLE_ACCURACY_M = 200
/** Tras 2 errores seguidos bajamos a baja precisión. */
const ERRORS_BEFORE_DOWNGRADE = 2
/** Cada cuánto reintentamos volver a alta precisión. */
const HIGH_ACCURACY_RETRY_MS = 120_000

export type LocationStatus =
    | "idle"
    | "requesting"
    | "active"
    | "degraded"
    | "error"
    | "denied"
    | "unsupported"

export interface TrackedLocation {
    lat: number
    lng: number
    accuracy: number | null
    speed: number | null
    heading: number | null
    timestamp: Date
}

interface UseDriverLocationOptions {
    driverId: string | null
    enabled?: boolean
    /** Heartbeat: máximo tiempo sin escribir aunque esté quieto (ms). */
    heartbeatMs?: number
    /** Mantener la pantalla encendida mientras se rastrea (Screen Wake Lock). */
    keepScreenAwake?: boolean
    onError?: (error: GeolocationPositionError) => void
}

export function useDriverLocation({
    driverId,
    enabled = true,
    heartbeatMs = 15_000,
    keepScreenAwake = true,
    onError,
}: UseDriverLocationOptions) {
    const [isTracking, setIsTracking] = useState(false)
    const [lastLocation, setLastLocation] = useState<TrackedLocation | null>(null)
    const [error, setError] = useState<GeolocationPositionError | null>(null)
    const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle")
    /** Timestamp del último write confirmado por el servidor. */
    const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)

    const driverIdRef = useRef(driverId)
    const onErrorRef = useRef(onError)
    const watchIdRef = useRef<number | null>(null)
    const heartbeatIdRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const highAccuracyRef = useRef(true)
    const consecutiveErrorsRef = useRef(0)
    const downgradedAtRef = useRef<number | null>(null)
    /** Última posición efectivamente escrita en el servidor. */
    const lastSentRef = useRef<{ lat: number; lng: number; heading: number | null; at: number } | null>(null)
    /** Última lectura del GPS, se haya mandado o no. */
    const latestFixRef = useRef<GeolocationPosition | null>(null)
    /** Posición que falló al enviarse y espera reintento. */
    const pendingRef = useRef<GeolocationPosition | null>(null)
    const inFlightRef = useRef(false)
    const wakeLockRef = useRef<any>(null)
    /** Evita que dos efectos reinicien el watch en simultáneo. */
    const restartRef = useRef<(() => void) | null>(null)

    useEffect(() => {
        driverIdRef.current = driverId
    }, [driverId])
    useEffect(() => {
        onErrorRef.current = onError
    }, [onError])

    // ── Envío ────────────────────────────────────────────────────────────
    const postLocation = useCallback(async (position: GeolocationPosition) => {
        const id = driverIdRef.current
        if (!id) return

        const { latitude, longitude, accuracy, speed, heading } = position.coords

        inFlightRef.current = true
        try {
            const res = await fetch(ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    driverId: id,
                    lat: latitude,
                    lng: longitude,
                    accuracy: accuracy ?? null,
                    speed: speed ?? null,
                    heading: heading ?? null,
                    capturedAt: new Date(position.timestamp).toISOString(),
                }),
                keepalive: true,
            })

            if (!res.ok) throw new Error(`HTTP ${res.status}`)

            lastSentRef.current = {
                lat: latitude,
                lng: longitude,
                heading: heading ?? null,
                at: Date.now(),
            }
            pendingRef.current = null
            setLastSyncedAt(new Date())
            setLastLocation({
                lat: latitude,
                lng: longitude,
                accuracy: accuracy ?? null,
                speed: speed ?? null,
                heading: heading ?? null,
                timestamp: new Date(position.timestamp),
            })
            setError(null)
            setLocationStatus(highAccuracyRef.current ? "active" : "degraded")
        } catch {
            // Guardamos para reintentar en el próximo fix o heartbeat. No
            // marcamos "error" de GPS: el sensor anda, lo que falló es la red.
            pendingRef.current = position
        } finally {
            inFlightRef.current = false
        }
    }, [])

    /** Decide si esta lectura merece una escritura. */
    const shouldSend = useCallback(
        (position: GeolocationPosition, now: number): boolean => {
            const last = lastSentRef.current
            if (!last) return true

            const sinceLast = now - last.at
            if (sinceLast < MIN_SEND_INTERVAL_MS) return false
            if (sinceLast >= heartbeatMs) return true

            const { latitude, longitude, heading } = position.coords
            if (distanceMeters(last.lat, last.lng, latitude, longitude) >= MIN_DISTANCE_M) {
                return true
            }
            if (
                heading != null &&
                last.heading != null &&
                headingDelta(last.heading, heading) >= MIN_HEADING_DELTA
            ) {
                return true
            }
            return false
        },
        [heartbeatMs]
    )

    const handlePosition = useCallback(
        (position: GeolocationPosition) => {
            consecutiveErrorsRef.current = 0
            latestFixRef.current = position
            setError(null)

            // Una lectura con ±500m no aporta nada y hace saltar el pin en el
            // panel. La ignoramos salvo que todavía no tengamos ninguna.
            const accuracy = position.coords.accuracy
            if (
                accuracy != null &&
                accuracy > MAX_ACCEPTABLE_ACCURACY_M &&
                lastSentRef.current != null
            ) {
                return
            }

            if (inFlightRef.current) return
            if (!shouldSend(position, Date.now())) {
                setLocationStatus(highAccuracyRef.current ? "active" : "degraded")
                return
            }

            postLocation(position)
        },
        [postLocation, shouldSend]
    )

    const handleError = useCallback((err: GeolocationPositionError) => {
        setError(err)
        onErrorRef.current?.(err)

        if (err.code === err.PERMISSION_DENIED) {
            setLocationStatus("denied")
            return
        }

        consecutiveErrorsRef.current++
        setLocationStatus("error")

        // POSITION_UNAVAILABLE / TIMEOUT repetidos: casi siempre es iOS sin fix
        // de GPS. Bajamos a baja precisión, que usa WiFi/red y sí responde.
        if (
            highAccuracyRef.current &&
            consecutiveErrorsRef.current >= ERRORS_BEFORE_DOWNGRADE
        ) {
            highAccuracyRef.current = false
            downgradedAtRef.current = Date.now()
            restartRef.current?.()
        }
    }, [])

    // ── Ciclo de vida del watch ──────────────────────────────────────────
    useEffect(() => {
        if (!enabled || !driverId) {
            setIsTracking(false)
            setLocationStatus("idle")
            return
        }

        if (typeof navigator === "undefined" || !navigator.geolocation) {
            setLocationStatus("unsupported")
            return
        }

        let disposed = false

        const clearWatch = () => {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current)
                watchIdRef.current = null
            }
        }

        const startWatch = () => {
            if (disposed) return
            clearWatch()
            setLocationStatus((prev) => (prev === "denied" ? prev : "requesting"))

            watchIdRef.current = navigator.geolocation.watchPosition(
                handlePosition,
                handleError,
                {
                    enableHighAccuracy: highAccuracyRef.current,
                    // Timeout generoso: un timeout corto en iOS dispara el
                    // downgrade antes de que el GPS llegue a fijar posición.
                    timeout: highAccuracyRef.current ? 20_000 : 25_000,
                    // Aceptamos una posición de hasta 10 s para que el primer
                    // fix sea inmediato al abrir la app.
                    maximumAge: 10_000,
                }
            )
        }

        restartRef.current = startWatch
        setIsTracking(true)
        startWatch()

        // Heartbeat: reintenta lo pendiente, prueba volver a alta precisión y
        // garantiza que last_seen_at no envejezca aunque el repartidor esté
        // parado en un semáforo.
        heartbeatIdRef.current = setInterval(() => {
            if (disposed) return

            // ¿Toca reintentar alta precisión?
            if (
                !highAccuracyRef.current &&
                downgradedAtRef.current &&
                Date.now() - downgradedAtRef.current > HIGH_ACCURACY_RETRY_MS
            ) {
                highAccuracyRef.current = true
                downgradedAtRef.current = null
                consecutiveErrorsRef.current = 0
                startWatch()
                return
            }

            if (inFlightRef.current) return

            const pending = pendingRef.current
            if (pending) {
                postLocation(pending)
                return
            }

            const latest = latestFixRef.current
            const last = lastSentRef.current
            if (latest && (!last || Date.now() - last.at >= heartbeatMs)) {
                postLocation(latest)
            }
        }, Math.max(5_000, Math.floor(heartbeatMs / 2)))

        // iOS mata el watch al bloquear la pantalla y no lo reanuda solo.
        const handleVisibility = () => {
            if (document.visibilityState !== "visible" || disposed) return
            consecutiveErrorsRef.current = 0
            startWatch()
        }
        document.addEventListener("visibilitychange", handleVisibility)
        window.addEventListener("focus", handleVisibility)
        window.addEventListener("online", handleVisibility)

        // Último intento de no perder la posición al cerrar/minimizar.
        const flush = () => {
            const id = driverIdRef.current
            const position = pendingRef.current || latestFixRef.current
            if (!id || !position || typeof navigator.sendBeacon !== "function") return

            navigator.sendBeacon(
                ENDPOINT,
                new Blob(
                    [
                        JSON.stringify({
                            driverId: id,
                            lat: position.coords.latitude,
                            lng: position.coords.longitude,
                            accuracy: position.coords.accuracy ?? null,
                            speed: position.coords.speed ?? null,
                            heading: position.coords.heading ?? null,
                            capturedAt: new Date(position.timestamp).toISOString(),
                        }),
                    ],
                    { type: "application/json" }
                )
            )
        }
        window.addEventListener("pagehide", flush)

        return () => {
            disposed = true
            restartRef.current = null
            clearWatch()
            if (heartbeatIdRef.current) {
                clearInterval(heartbeatIdRef.current)
                heartbeatIdRef.current = null
            }
            document.removeEventListener("visibilitychange", handleVisibility)
            window.removeEventListener("focus", handleVisibility)
            window.removeEventListener("online", handleVisibility)
            window.removeEventListener("pagehide", flush)
            setIsTracking(false)
        }
    }, [enabled, driverId, heartbeatMs, handlePosition, handleError, postLocation])

    // ── Wake Lock ────────────────────────────────────────────────────────
    // Sin esto, la pantalla se apaga, iOS suspende la página y el repartidor
    // "desaparece" del panel hasta que vuelve a tocar el celular.
    useEffect(() => {
        if (!keepScreenAwake || !enabled || !driverId) return
        if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return

        let released = false

        const acquire = async () => {
            if (released || document.visibilityState !== "visible") return
            try {
                wakeLockRef.current = await (navigator as any).wakeLock.request("screen")
            } catch {
                // El navegador puede negarlo (batería baja, permiso). No es fatal.
            }
        }

        const onVisibility = () => {
            if (document.visibilityState === "visible") acquire()
        }

        acquire()
        document.addEventListener("visibilitychange", onVisibility)

        return () => {
            released = true
            document.removeEventListener("visibilitychange", onVisibility)
            wakeLockRef.current?.release?.().catch(() => {})
            wakeLockRef.current = null
        }
    }, [keepScreenAwake, enabled, driverId])

    const stopTracking = useCallback(() => {
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current)
            watchIdRef.current = null
        }
        if (heartbeatIdRef.current) {
            clearInterval(heartbeatIdRef.current)
            heartbeatIdRef.current = null
        }
        setIsTracking(false)
        setLocationStatus("idle")
    }, [])

    return {
        isTracking,
        lastLocation,
        lastSyncedAt,
        error,
        locationStatus,
        /** true mientras estemos escribiendo posiciones frescas en el servidor. */
        isLive: locationStatus === "active" || locationStatus === "degraded",
        stopTracking,
    }
}
