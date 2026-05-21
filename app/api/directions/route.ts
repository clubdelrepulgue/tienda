import { NextRequest, NextResponse } from "next/server"

// Google Routes API (preferred) with Directions API fallback
// Returns distance, duration, and encoded polyline for rendering on map

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const originLat = searchParams.get("originLat")
    const originLng = searchParams.get("originLng")
    const destLat = searchParams.get("destLat")
    const destLng = searchParams.get("destLng")

    if (!originLat || !originLng || !destLat || !destLng) {
        return NextResponse.json(
            { error: "Missing origin/destination coordinates" },
            { status: 400 }
        )
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey) {
        return NextResponse.json(
            { error: "Google Maps API key not configured" },
            { status: 500 }
        )
    }

    try {
        // Try Routes API first (newer, better)
        const routesResult = await fetchFromRoutesAPI(
            apiKey,
            { lat: parseFloat(originLat), lng: parseFloat(originLng) },
            { lat: parseFloat(destLat), lng: parseFloat(destLng) }
        )

        if (routesResult) {
            return NextResponse.json(routesResult, {
                headers: { "Cache-Control": "public, max-age=30, s-maxage=30" },
            })
        }

        // Fallback to Directions API
        const directionsResult = await fetchFromDirectionsAPI(
            apiKey,
            `${originLat},${originLng}`,
            `${destLat},${destLng}`
        )

        if (directionsResult) {
            return NextResponse.json(directionsResult, {
                headers: { "Cache-Control": "public, max-age=30, s-maxage=30" },
            })
        }

        return NextResponse.json({ error: "No route found" }, { status: 404 })
    } catch (error: any) {
        console.error("Directions API error:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

async function fetchFromRoutesAPI(
    apiKey: string,
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number }
) {
    try {
        const res = await fetch(
            "https://routes.googleapis.com/directions/v2:computeRoutes",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Goog-Api-Key": apiKey,
                    "X-Goog-FieldMask":
                        "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
                },
                body: JSON.stringify({
                    origin: {
                        location: { latLng: { latitude: origin.lat, longitude: origin.lng } },
                    },
                    destination: {
                        location: {
                            latLng: { latitude: destination.lat, longitude: destination.lng },
                        },
                    },
                    travelMode: "TWO_WHEELER",
                    routingPreference: "TRAFFIC_AWARE",
                }),
            }
        )

        if (!res.ok) return null

        const data = await res.json()
        const route = data.routes?.[0]
        if (!route) return null

        const durationSeconds = parseInt(route.duration?.replace("s", "") || "0")

        return {
            distanceMeters: route.distanceMeters,
            distanceKm: +(route.distanceMeters / 1000).toFixed(2),
            durationSeconds,
            durationMinutes: Math.ceil(durationSeconds / 60),
            polyline: route.polyline?.encodedPolyline || null,
            source: "routes_api" as const,
        }
    } catch {
        return null
    }
}

async function fetchFromDirectionsAPI(
    apiKey: string,
    origin: string,
    destination: string
) {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=driving&key=${apiKey}`
    const res = await fetch(url)
    if (!res.ok) return null

    const data = await res.json()
    if (data.status !== "OK" || !data.routes?.[0]) return null

    const route = data.routes[0]
    const leg = route.legs[0]

    return {
        distanceMeters: leg.distance.value,
        distanceKm: +(leg.distance.value / 1000).toFixed(2),
        durationSeconds: leg.duration.value,
        durationMinutes: Math.ceil(leg.duration.value / 60),
        polyline: route.overview_polyline?.points || null,
        source: "directions_api" as const,
    }
}
