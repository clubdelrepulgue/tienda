"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { Map, AdvancedMarker, Pin, useMap } from "@vis.gl/react-google-maps"
import { Card, CardContent } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { Navigation, Clock, Bike, MapPin, Gauge } from "lucide-react"

interface LiveTrackingMapProps {
    orderId: string
    driverId?: string
    destination: { lat: number; lng: number; address: string }
    branchLocation?: { lat: number; lng: number }
    height?: string
}

interface DriverLocation {
    lat: number
    lng: number
    accuracy: number | null
    heading: number | null
    speed: number | null
    updatedAt: string
}

interface RouteInfo {
    distanceKm: number
    durationMinutes: number
    polyline: string | null
}

// Decode Google encoded polyline into LatLng array
function decodePolyline(encoded: string): google.maps.LatLngLiteral[] {
    const points: google.maps.LatLngLiteral[] = []
    let index = 0
    let lat = 0
    let lng = 0

    while (index < encoded.length) {
        let shift = 0
        let result = 0
        let byte: number

        do {
            byte = encoded.charCodeAt(index++) - 63
            result |= (byte & 0x1f) << shift
            shift += 5
        } while (byte >= 0x20)

        lat += result & 1 ? ~(result >> 1) : result >> 1

        shift = 0
        result = 0

        do {
            byte = encoded.charCodeAt(index++) - 63
            result |= (byte & 0x1f) << shift
            shift += 5
        } while (byte >= 0x20)

        lng += result & 1 ? ~(result >> 1) : result >> 1

        points.push({ lat: lat / 1e5, lng: lng / 1e5 })
    }

    return points
}

// Component to render polyline on the map
function RoutePolyline({ encodedPath }: { encodedPath: string }) {
    const map = useMap()
    const polylineRef = useRef<google.maps.Polyline | null>(null)

    useEffect(() => {
        if (!map || !encodedPath) return

        // Clean up previous polyline
        polylineRef.current?.setMap(null)

        const path = decodePolyline(encodedPath)

        polylineRef.current = new google.maps.Polyline({
            path,
            geodesic: true,
            strokeColor: "#3b82f6",
            strokeOpacity: 0.8,
            strokeWeight: 5,
            map,
        })

        return () => {
            polylineRef.current?.setMap(null)
        }
    }, [map, encodedPath])

    return null
}

// Haversine fallback when Directions API is unavailable
function haversineDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
): number {
    const R = 6371
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLng = ((lng2 - lng1) * Math.PI) / 180
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2)
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function LiveTrackingMap({
    orderId,
    driverId,
    destination,
    branchLocation,
    height = "350px",
}: LiveTrackingMapProps) {
    const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null)
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
    const [route, setRoute] = useState<RouteInfo | null>(null)
    const [routeLoading, setRouteLoading] = useState(false)
    const hasMapId = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_ID

    // Fetch real route from Directions API
    const fetchRoute = useCallback(
        async (driverLat: number, driverLng: number) => {
            setRouteLoading(true)
            try {
                const params = new URLSearchParams({
                    originLat: driverLat.toString(),
                    originLng: driverLng.toString(),
                    destLat: destination.lat.toString(),
                    destLng: destination.lng.toString(),
                })
                const res = await fetch(`/api/directions?${params}`)
                if (!res.ok) throw new Error("Route fetch failed")

                const data = await res.json()
                setRoute({
                    distanceKm: data.distanceKm,
                    durationMinutes: data.durationMinutes,
                    polyline: data.polyline,
                })
            } catch {
                // Fallback to Haversine
                const dist = haversineDistance(
                    driverLat,
                    driverLng,
                    destination.lat,
                    destination.lng
                )
                setRoute({
                    distanceKm: +dist.toFixed(2),
                    durationMinutes: Math.ceil((dist / 15) * 60),
                    polyline: null,
                })
            } finally {
                setRouteLoading(false)
            }
        },
        [destination.lat, destination.lng]
    )

    // Subscribe to driver location updates
    useEffect(() => {
        if (!driverId) return

        const supabase = createClient()

        const parseLocation = (loc: any): DriverLocation => ({
            lat: parseFloat(loc.lat),
            lng: parseFloat(loc.lng),
            accuracy: loc.accuracy != null ? parseFloat(loc.accuracy) : null,
            heading: loc.heading != null ? parseFloat(loc.heading) : null,
            speed: loc.speed != null ? parseFloat(loc.speed) : null,
            updatedAt: loc.updated_at,
        })

        const fetchDriverLocation = async () => {
            const { data } = await supabase
                .from("drivers")
                .select("current_location")
                .eq("id", driverId)
                .single()

            if (data?.current_location) {
                const location = parseLocation(data.current_location)
                setDriverLocation(location)
                setLastUpdated(new Date(location.updatedAt))
                fetchRoute(location.lat, location.lng)
            }
        }

        fetchDriverLocation()

        const channel = supabase
            .channel(`driver-location-${driverId}`)
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "drivers",
                    filter: `id=eq.${driverId}`,
                },
                (payload) => {
                    const loc = (payload.new as any).current_location
                    if (loc) {
                        const location = parseLocation(loc)
                        setDriverLocation(location)
                        setLastUpdated(new Date())
                        fetchRoute(location.lat, location.lng)
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [driverId, fetchRoute])

    const center = driverLocation
        ? {
              lat: (driverLocation.lat + destination.lat) / 2,
              lng: (driverLocation.lng + destination.lng) / 2,
          }
        : destination

    // Format speed for display
    const speedDisplay =
        driverLocation?.speed != null
            ? `${(driverLocation.speed * 3.6).toFixed(0)} km/h`
            : null

    return (
        <div className="space-y-4">
            {/* Stats cards */}
            {driverLocation && (
                <div className={`grid gap-3 ${speedDisplay ? "grid-cols-3" : "grid-cols-2"}`}>
                    <Card className="rounded-xl">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <Navigation className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Distancia</p>
                                <p className="font-bold text-lg">
                                    {route ? `${route.distanceKm} km` : "--"}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="rounded-xl">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                                <Clock className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Llegada estimada</p>
                                <p className="font-bold text-lg">
                                    {route ? `~${route.durationMinutes} min` : "--"}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                    {speedDisplay && (
                        <Card className="rounded-xl">
                            <CardContent className="p-4 flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                                    <Gauge className="h-5 w-5 text-orange-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Velocidad</p>
                                    <p className="font-bold text-lg">{speedDisplay}</p>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}

            {/* Map */}
            <div style={{ height }} className="rounded-xl overflow-hidden border border-border">
                <Map
                    defaultCenter={center}
                    defaultZoom={14}
                    gestureHandling="greedy"
                    disableDefaultUI={false}
                    mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_ID || undefined}
                >
                    {/* Route polyline */}
                    {route?.polyline && <RoutePolyline encodedPath={route.polyline} />}

                    {/* Driver marker */}
                    {driverLocation && (
                        <AdvancedMarker
                            position={{ lat: driverLocation.lat, lng: driverLocation.lng }}
                            title="Repartidor"
                        >
                            <div className="relative">
                                {/* Accuracy circle indicator */}
                                {driverLocation.accuracy != null && driverLocation.accuracy > 30 && (
                                    <div
                                        className="absolute rounded-full bg-green-500/15 border border-green-500/30"
                                        style={{
                                            width: `${Math.min(driverLocation.accuracy, 80)}px`,
                                            height: `${Math.min(driverLocation.accuracy, 80)}px`,
                                            top: "50%",
                                            left: "50%",
                                            transform: "translate(-50%, -50%)",
                                        }}
                                    />
                                )}
                                <div className="absolute -inset-2 bg-green-500/30 rounded-full animate-ping" />
                                <div
                                    className="relative h-10 w-10 rounded-full bg-green-500 flex items-center justify-center shadow-lg border-2 border-white transition-transform"
                                    style={
                                        driverLocation.heading != null
                                            ? { transform: `rotate(${driverLocation.heading}deg)` }
                                            : undefined
                                    }
                                >
                                    {driverLocation.heading != null ? (
                                        <Navigation className="h-5 w-5 text-white" />
                                    ) : (
                                        <Bike className="h-5 w-5 text-white" />
                                    )}
                                </div>
                            </div>
                        </AdvancedMarker>
                    )}

                    {/* Destination marker */}
                    <AdvancedMarker
                        position={{ lat: destination.lat, lng: destination.lng }}
                        title="Tu ubicación"
                    >
                        <div className="h-10 w-10 rounded-full bg-red-500 flex items-center justify-center shadow-lg border-2 border-white">
                            <MapPin className="h-5 w-5 text-white" />
                        </div>
                    </AdvancedMarker>

                    {/* Branch marker */}
                    {branchLocation && (
                        <AdvancedMarker
                            position={{ lat: branchLocation.lat, lng: branchLocation.lng }}
                            title="Restaurante"
                        >
                            <Pin
                                background="#1f2937"
                                borderColor="#000000"
                                glyphColor="#ffffff"
                                scale={1.2}
                            />
                        </AdvancedMarker>
                    )}
                </Map>
            </div>

            {/* Last updated */}
            {lastUpdated && (
                <div className="flex items-center justify-center gap-2">
                    <p className="text-xs text-muted-foreground">
                        Última actualización: {lastUpdated.toLocaleTimeString()}
                    </p>
                    {driverLocation?.accuracy != null && (
                        <span className="text-xs text-muted-foreground">
                            (±{Math.round(driverLocation.accuracy)}m)
                        </span>
                    )}
                </div>
            )}

            {!driverLocation && driverId && (
                <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground">
                        Esperando ubicación del repartidor...
                    </p>
                </div>
            )}
        </div>
    )
}
