"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { updateDriverLocation } from "@/app/actions"

interface UseDriverLocationOptions {
    driverId: string | null
    enabled?: boolean
    interval?: number // ms
    onError?: (error: GeolocationPositionError) => void
}

export function useDriverLocation({
    driverId,
    enabled = true,
    interval = 10000,
    onError,
}: UseDriverLocationOptions) {
    const [isTracking, setIsTracking] = useState(false)
    const [lastLocation, setLastLocation] = useState<{
        lat: number
        lng: number
        accuracy: number | null
        speed: number | null
        heading: number | null
        timestamp: Date
    } | null>(null)
    const [error, setError] = useState<GeolocationPositionError | null>(null)
    const [locationStatus, setLocationStatus] = useState<
        "idle" | "requesting" | "active" | "error" | "fallback"
    >("idle")

    // Refs to avoid stale closures in geolocation callbacks
    const driverIdRef = useRef(driverId)
    const onErrorRef = useRef(onError)
    const intervalRef = useRef<NodeJS.Timeout | null>(null)
    const watchIdRef = useRef<number | null>(null)
    const consecutiveErrorsRef = useRef(0)

    useEffect(() => {
        driverIdRef.current = driverId
    }, [driverId])
    useEffect(() => {
        onErrorRef.current = onError
    }, [onError])

    const sendLocation = useCallback(async (position: GeolocationPosition) => {
        const id = driverIdRef.current
        if (!id) return

        const { latitude, longitude, accuracy, speed, heading, altitude } =
            position.coords

        try {
            const result = await updateDriverLocation(id, latitude, longitude, {
                accuracy,
                speed,
                heading,
                altitude,
            })

            if (result.error) {
                console.error("Error updating location in DB:", result.error)
                setLocationStatus("error")
            } else {
                consecutiveErrorsRef.current = 0
                setLastLocation({
                    lat: latitude,
                    lng: longitude,
                    accuracy,
                    speed,
                    heading,
                    timestamp: new Date(),
                })
                setError(null)
                setLocationStatus("active")
            }
        } catch (err) {
            console.error("Error sending location:", err)
            setLocationStatus("error")
        }
    }, [])

    // Google Geolocation API fallback (when GPS fails — indoor, etc.)
    const fallbackToGoogleGeolocation = useCallback(async () => {
        const id = driverIdRef.current
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        if (!id || !apiKey) return

        try {
            const res = await fetch(
                `https://www.googleapis.com/geolocation/v1/geolocate?key=${apiKey}`,
                { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
            )
            if (!res.ok) return

            const data = await res.json()
            if (!data.location) return

            const result = await updateDriverLocation(
                id,
                data.location.lat,
                data.location.lng,
                { accuracy: data.accuracy }
            )

            if (!result.error) {
                setLastLocation({
                    lat: data.location.lat,
                    lng: data.location.lng,
                    accuracy: data.accuracy,
                    speed: null,
                    heading: null,
                    timestamp: new Date(),
                })
                setLocationStatus("fallback")
            }
        } catch {
            // Silently fail — GPS will retry
        }
    }, [])

    const handleError = useCallback(
        (err: GeolocationPositionError) => {
            consecutiveErrorsRef.current++
            setError(err)
            setLocationStatus("error")
            onErrorRef.current?.(err)

            // After 3 consecutive GPS failures, try Google Geolocation fallback
            if (consecutiveErrorsRef.current >= 3) {
                fallbackToGoogleGeolocation()
            }
        },
        [fallbackToGoogleGeolocation]
    )

    const stopTracking = useCallback(() => {
        setIsTracking(false)

        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current)
            watchIdRef.current = null
        }

        if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
        }
    }, [])

    useEffect(() => {
        if (!enabled || !driverId || !navigator.geolocation) {
            stopTracking()
            return
        }

        setIsTracking(true)
        setLocationStatus("requesting")

        const geoOptions: PositionOptions = {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0,
        }

        // Get initial position
        navigator.geolocation.getCurrentPosition(sendLocation, handleError, geoOptions)

        // Watch for continuous updates
        watchIdRef.current = navigator.geolocation.watchPosition(
            sendLocation,
            handleError,
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
        )

        // Backup interval
        intervalRef.current = setInterval(() => {
            navigator.geolocation.getCurrentPosition(sendLocation, handleError, {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 5000,
            })
        }, interval)

        return () => {
            stopTracking()
        }
    }, [enabled, driverId, interval, sendLocation, handleError, stopTracking])

    return {
        isTracking,
        lastLocation,
        error,
        locationStatus,
        startTracking: () => {}, // kept for API compat
        stopTracking,
    }
}
