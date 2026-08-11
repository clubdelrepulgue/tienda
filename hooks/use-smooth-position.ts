"use client"

import { useEffect, useRef, useState } from "react"
import { distanceMeters } from "@/lib/geolocation"

/**
 * Interpola la posición de un marcador entre dos lecturas de GPS.
 *
 * El repartidor manda una posición cada pocos segundos. Si el marcador salta de
 * golpe a cada actualización, el mapa se ve entrecortado y da la sensación de
 * que el repartidor "se desconecta y aparece en otro lado". Animando el tramo
 * intermedio a 60fps el movimiento se lee como continuo, sin pedir un solo
 * punto extra al GPS ni una llamada más a Google.
 *
 * Es puramente cosmético: el estado que se muestra en texto (distancia, ETA,
 * "actualizado hace X") sigue usando la posición real, no la interpolada.
 */

export interface SmoothPoint {
    lat: number
    lng: number
}

/** Más lejos que esto asumimos un salto real (reconexión, GPS recuperado). */
const TELEPORT_THRESHOLD_M = 500
/** Duración de la animación: un poco menos que el intervalo típico de envío. */
const DEFAULT_DURATION_MS = 1200

function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3)
}

export function useSmoothPosition(
    target: SmoothPoint | null | undefined,
    durationMs: number = DEFAULT_DURATION_MS
): SmoothPoint | null {
    const [display, setDisplay] = useState<SmoothPoint | null>(target ?? null)
    const frameRef = useRef<number | null>(null)
    const fromRef = useRef<SmoothPoint | null>(target ?? null)
    const startedAtRef = useRef(0)

    useEffect(() => {
        if (!target) return

        const from = fromRef.current

        // Primera posición, o un salto tan grande que animarlo sería absurdo:
        // colocamos el marcador directamente.
        if (
            !from ||
            distanceMeters(from.lat, from.lng, target.lat, target.lng) > TELEPORT_THRESHOLD_M
        ) {
            fromRef.current = target
            setDisplay(target)
            return
        }

        // Movimiento imperceptible: evitamos animar (y re-renderizar) de más.
        if (distanceMeters(from.lat, from.lng, target.lat, target.lng) < 0.5) {
            return
        }

        const origin = from
        startedAtRef.current = performance.now()

        const step = (nowTs: number) => {
            const elapsed = nowTs - startedAtRef.current
            const t = Math.min(1, elapsed / durationMs)
            const eased = easeOutCubic(t)

            const next = {
                lat: origin.lat + (target.lat - origin.lat) * eased,
                lng: origin.lng + (target.lng - origin.lng) * eased,
            }

            setDisplay(next)
            fromRef.current = next

            if (t < 1) {
                frameRef.current = requestAnimationFrame(step)
            } else {
                fromRef.current = target
                frameRef.current = null
            }
        }

        if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
        frameRef.current = requestAnimationFrame(step)

        return () => {
            if (frameRef.current !== null) {
                cancelAnimationFrame(frameRef.current)
                frameRef.current = null
            }
        }
    }, [target?.lat, target?.lng, durationMs]) // eslint-disable-line react-hooks/exhaustive-deps

    // Pausamos la animación con la pestaña oculta: rAF ya no dispara y no tiene
    // sentido dejar un frame pendiente que se ejecute al volver.
    useEffect(() => {
        const onHidden = () => {
            if (document.visibilityState === "hidden" && frameRef.current !== null) {
                cancelAnimationFrame(frameRef.current)
                frameRef.current = null
                if (target) {
                    fromRef.current = target
                    setDisplay(target)
                }
            }
        }
        document.addEventListener("visibilitychange", onHidden)
        return () => document.removeEventListener("visibilitychange", onHidden)
    }, [target])

    return display
}
