"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { Map, AdvancedMarker, Marker, useMap } from "@vis.gl/react-google-maps"
import { Card, CardContent } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { Navigation, Clock, Bike, Home, Gauge } from "lucide-react"
import { BranchLogoMarker } from "./branch-logo-marker"

interface LiveTrackingMapProps {
    orderId: string
    driverId?: string
    trackingToken?: string
    destination: { lat: number; lng: number; address: string }
    branchLocation?: { lat: number; lng: number; logo?: string; accentColor?: string }
    initialDriverLocation?: {
        lat: number
        lng: number
        accuracy?: number | null
        heading?: number | null
        speed?: number | null
    } | null
    height?: string
    /**
     * Increment this value to (re)fit the map viewport to the full route
     * (driver → destination → branch). Used by the "Navegar" action so the
     * driver stays inside the app instead of jumping to an external maps tab.
     */
    focusSignal?: number
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

const routeCache = new globalThis.Map<string, { route: RouteInfo; cachedAt: number }>()
const ROUTE_CACHE_MS = 60_000
const ROUTE_MIN_DISTANCE_KM = 0.15

// --- Distinct pin icons (SVG data URIs) for the classic <Marker> fallback ---
// These are used when there's no Map ID (AdvancedMarker unavailable), so each
// point — destination, driver, restaurant — is clearly distinguishable.
function pinDataUri(color: string, glyph: string): string {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='52' viewBox='0 0 40 52'>
  <defs><filter id='s' x='-30%' y='-20%' width='160%' height='150%'>
    <feDropShadow dx='0' dy='1.5' stdDeviation='1.5' flood-opacity='0.35'/></filter></defs>
  <path filter='url(#s)' fill='${color}' stroke='#ffffff' stroke-width='2.5'
    d='M20 3C11.7 3 5 9.7 5 18c0 10.5 15 29 15 29s15-18.5 15-29C35 9.7 28.3 3 20 3z'/>
  <g transform='translate(20 18)'>${glyph}</g>
</svg>`
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

const GLYPH_HOME =
    "<path fill='#fff' d='M0 -8 L-8 -0.5 H-5.3 V8 H-1.7 V1.5 H1.7 V8 H5.3 V-0.5 H8 Z'/>"
const GLYPH_BIKE =
    "<g fill='none' stroke='#fff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='-5.5' cy='3.5' r='3.6'/><circle cx='5.5' cy='3.5' r='3.6'/><path d='M-5.5 3.5 L-1.5 -4.5 L5.5 3.5 M-1.5 -4.5 L2 -4.5'/></g>"
const ICON_DESTINATION = pinDataUri("#ef4444", GLYPH_HOME)
const ICON_DRIVER = pinDataUri("#16a34a", GLYPH_BIKE)

// Wrap a data URI as a google.maps icon with proper size/anchor once the API is
// loaded; falls back to the bare URL string before then.
function markerIcon(dataUri: string) {
    if (typeof google === "undefined" || !google.maps) return dataUri
    return {
        url: dataUri,
        scaledSize: new google.maps.Size(40, 52),
        anchor: new google.maps.Point(20, 50),
    }
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
        if (!map) {
            console.warn('[RoutePolyline] Map not ready')
            return
        }
        if (!encodedPath) {
            console.warn('[RoutePolyline] No encoded path provided')
            return
        }

        console.log('[RoutePolyline] Rendering polyline, encoded path length:', encodedPath.length)

        // Clean up previous polyline
        polylineRef.current?.setMap(null)

        try {
            const path = decodePolyline(encodedPath)
            console.log('[RoutePolyline] Decoded', path.length, 'points')

            polylineRef.current = new google.maps.Polyline({
                path,
                geodesic: true,
                strokeColor: "#3b82f6",
                strokeOpacity: 0.8,
                strokeWeight: 5,
                map,
            })

            console.log('[RoutePolyline] Polyline created successfully')
        } catch (err) {
            console.error('[RoutePolyline] Error creating polyline:', err)
        }

        return () => {
            polylineRef.current?.setMap(null)
        }
    }, [map, encodedPath])

    return null
}

// Fits the map viewport to the given points whenever `signal` changes.
// Only runs when signal is explicitly incremented (via "Navegar" button).
function MapFocuser({
    signal,
    points,
}: {
    signal: number
    points: google.maps.LatLngLiteral[]
}) {
    const map = useMap()
    const pointsRef = useRef(points)
    pointsRef.current = points
    const autoFittedRef = useRef(false)

    // First time we know both ends of the trip, frame the whole route instead of
    // sitting at a fixed zoom — otherwise the map looks cramped and off-center.
    useEffect(() => {
        if (!map || autoFittedRef.current || points.length < 2) return

        autoFittedRef.current = true
        const bounds = new google.maps.LatLngBounds()
        points.forEach((p) => bounds.extend(p))
        map.fitBounds(bounds, 64)
    }, [map, points])

    useEffect(() => {
        if (!map || !signal) return

        const pts = pointsRef.current
        if (pts.length === 0) {
            console.warn('[MapFocuser] No points to focus on')
            return
        }

        console.log('[MapFocuser] Focusing on', pts.length, 'points, signal:', signal)

        // Single point: center and zoom in
        if (pts.length === 1) {
            map.setCenter(pts[0])
            map.setZoom(16)
            return
        }

        // Multiple points: fit bounds with padding
        const bounds = new google.maps.LatLngBounds()
        pts.forEach((p) => bounds.extend(p))

        // Fit with 56px padding on all sides
        setTimeout(() => {
            map.fitBounds(bounds, 56)
        }, 50)
    }, [map, signal])

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

// Human-friendly relative time in Spanish (e.g. "hace 5 s", "hace 3 min")
function formatRelative(from: Date, nowMs: number): string {
    const seconds = Math.max(0, Math.round((nowMs - from.getTime()) / 1000))
    if (seconds < 10) return "ahora mismo"
    if (seconds < 60) return `hace ${seconds} s`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `hace ${minutes} min`
    const hours = Math.floor(minutes / 60)
    return `hace ${hours} h`
}

// Compact metric tile. Stacked (icon → label → value) so three of them fit on a
// phone without truncating either the label or the value.
function StatTile({
    icon: Icon,
    iconClassName,
    label,
    value,
}: {
    icon: typeof Navigation
    iconClassName: string
    label: string
    value: string
}) {
    return (
        <Card className="rounded-xl min-w-0">
            <CardContent className="p-3 flex flex-col items-center gap-1.5 text-center">
                <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${iconClassName}`}
                >
                    <Icon className="h-4 w-4" />
                </div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none">
                    {label}
                </p>
                <p className="font-bold text-base leading-none whitespace-nowrap">{value}</p>
            </CardContent>
        </Card>
    )
}

export function LiveTrackingMap({
    orderId,
    driverId,
    trackingToken,
    destination,
    branchLocation,
    initialDriverLocation,
    height = "350px",
    focusSignal = 0,
}: LiveTrackingMapProps) {
    const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null)
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
    const [now, setNow] = useState(() => Date.now())
    const [route, setRoute] = useState<RouteInfo | null>(null)
    const [branchLogo, setBranchLogo] = useState<string | null>(null)
    const [branchAccentColor, setBranchAccentColor] = useState<string | null>(null)
    const hasMapId = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_ID
    const lastRouteRequestRef = useRef<{ key: string; requestedAt: number } | null>(null)
    // Tracks origin of the last route actually fetched from the API (for distance threshold)
    const lastRouteOriginRef = useRef<{ lat: number; lng: number } | null>(null)

    // Fetch real route from Directions API
    const fetchRoute = useCallback(
        async (driverLat: number, driverLng: number) => {
            const originLat = driverLat.toFixed(4)
            const originLng = driverLng.toFixed(4)
            const destLat = destination.lat.toFixed(4)
            const destLng = destination.lng.toFixed(4)
            const cacheKey = `${originLat},${originLng}:${destLat},${destLng}`
            const now = Date.now()
            const cached = routeCache.get(cacheKey)

            if (cached && now - cached.cachedAt < ROUTE_CACHE_MS) {
                console.log('[fetchRoute] Using cached route')
                setRoute(cached.route)
                return
            }

            const lastRequest = lastRouteRequestRef.current
            if (
                lastRequest?.key === cacheKey &&
                now - lastRequest.requestedAt < ROUTE_CACHE_MS
            ) {
                console.log('[fetchRoute] Recent request in progress, skipping')
                return
            }

            // Skip re-fetch if driver moved less than 150m since last route — route is still accurate enough
            const lastOrigin = lastRouteOriginRef.current
            if (lastOrigin) {
                const movedKm = haversineDistance(lastOrigin.lat, lastOrigin.lng, driverLat, driverLng)
                if (movedKm < ROUTE_MIN_DISTANCE_KM) {
                    console.log('[fetchRoute] Driver moved < 150m, skipping')
                    return
                }
            }

            lastRouteRequestRef.current = { key: cacheKey, requestedAt: now }
            console.log('[fetchRoute] Fetching route from', { originLat, originLng }, 'to', { destLat, destLng })

            try {
                const params = new URLSearchParams({
                    originLat,
                    originLng,
                    destLat,
                    destLng,
                })
                const res = await fetch(`/api/directions?${params}`)
                if (!res.ok) {
                    const errorText = await res.text()
                    console.error('[fetchRoute] API error:', res.status, errorText)
                    throw new Error(`API error: ${res.status}`)
                }

                const data = await res.json()
                console.log('[fetchRoute] Got response:', data)

                const nextRoute = {
                    distanceKm: data.distanceKm,
                    durationMinutes: data.durationMinutes,
                    polyline: data.polyline,
                }
                routeCache.set(cacheKey, { route: nextRoute, cachedAt: now })
                lastRouteOriginRef.current = { lat: driverLat, lng: driverLng }
                setRoute(nextRoute)
                console.log('[fetchRoute] Route set:', nextRoute)
            } catch (err) {
                console.error('[fetchRoute] Error:', err)
                // Fallback to Haversine
                const dist = haversineDistance(
                    driverLat,
                    driverLng,
                    destination.lat,
                    destination.lng
                )
                const fallbackRoute = {
                    distanceKm: +dist.toFixed(2),
                    durationMinutes: Math.ceil((dist / 15) * 60),
                    polyline: null,
                }
                setRoute(fallbackRoute)
                console.log('[fetchRoute] Using Haversine fallback:', fallbackRoute)
            }
        },
        [destination.lat, destination.lng]
    )

    // Load branch branding if not provided in props
    useEffect(() => {
        if (branchLocation?.logo && branchLocation?.accentColor) {
            setBranchLogo(branchLocation.logo)
            setBranchAccentColor(branchLocation.accentColor)
            return
        }

        const supabase = createClient()
        const loadBranchBranding = async () => {
            const { data } = await supabase
                .from("sucursales")
                .select("logo_url, accent_color")
                .limit(1)
                .single()

            if (data) {
                setBranchLogo(data.logo_url || "/assets/brand/logo.jpeg")
                setBranchAccentColor(data.accent_color || "#f97316")
            }
        }

        loadBranchBranding()
    }, [branchLocation])

    // Subscribe to driver location updates
    useEffect(() => {
        if (!initialDriverLocation) return

        const location: DriverLocation = {
            lat: initialDriverLocation.lat,
            lng: initialDriverLocation.lng,
            accuracy: initialDriverLocation.accuracy ?? null,
            heading: initialDriverLocation.heading ?? null,
            speed: initialDriverLocation.speed ?? null,
            updatedAt: new Date().toISOString(),
        }

        setDriverLocation(location)
        setLastUpdated(new Date())
        fetchRoute(location.lat, location.lng)
    }, [initialDriverLocation, fetchRoute])

    useEffect(() => {
        if (driverLocation || !branchLocation) return

        fetchRoute(branchLocation.lat, branchLocation.lng)
    }, [branchLocation, driverLocation, fetchRoute])

    // Ticking clock so the "last updated" label stays fresh without a new fetch
    useEffect(() => {
        if (!lastUpdated) return
        const interval = window.setInterval(() => setNow(Date.now()), 1000)
        return () => window.clearInterval(interval)
    }, [lastUpdated])

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
            if (trackingToken) {
                const res = await fetch(`/api/order/${encodeURIComponent(trackingToken)}/driver-location`, {
                    cache: "no-store",
                })
                if (!res.ok) return

                const data = await res.json()
                if (data.location) {
                    const location = parseLocation(data.location)
                    setDriverLocation(location)
                    setLastUpdated(new Date(location.updatedAt))
                    fetchRoute(location.lat, location.lng)
                }
                return
            }

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

        if (trackingToken) {
            const interval = window.setInterval(fetchDriverLocation, 10000)
            return () => {
                window.clearInterval(interval)
            }
        }

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
                        setLastUpdated(location.updatedAt ? new Date(location.updatedAt) : new Date())
                        fetchRoute(location.lat, location.lng)
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [driverId, fetchRoute, trackingToken])

    const center = driverLocation
        ? {
              lat: (driverLocation.lat + destination.lat) / 2,
              lng: (driverLocation.lng + destination.lng) / 2,
          }
        : destination

    // Points the "Navegar" action fits the viewport to
    const focusPoints: google.maps.LatLngLiteral[] = []
    if (driverLocation) focusPoints.push({ lat: driverLocation.lat, lng: driverLocation.lng })
    focusPoints.push({ lat: destination.lat, lng: destination.lng })
    if (branchLocation) focusPoints.push(branchLocation)

    // Format speed for display
    const speedDisplay =
        driverLocation?.speed != null
            ? `${(driverLocation.speed * 3.6).toFixed(0)} km/h`
            : null

    return (
        <div className="space-y-3">
            {/* Stats cards */}
            {driverLocation && (
                <div className={`grid gap-2 ${speedDisplay ? "grid-cols-3" : "grid-cols-2"}`}>
                    <StatTile
                        icon={Navigation}
                        iconClassName="bg-primary/10 text-primary"
                        label="Distancia"
                        value={route ? `${route.distanceKm} km` : "--"}
                    />
                    <StatTile
                        icon={Clock}
                        iconClassName="bg-green-500/10 text-green-600"
                        label="Llegada"
                        value={route ? `~${route.durationMinutes} min` : "--"}
                    />
                    {speedDisplay && (
                        <StatTile
                            icon={Gauge}
                            iconClassName="bg-orange-500/10 text-orange-600"
                            label="Velocidad"
                            value={speedDisplay}
                        />
                    )}
                </div>
            )}

            {/* Map */}
            <div style={{ height }} className="rounded-xl overflow-hidden border border-border">
                <Map
                    defaultCenter={center}
                    defaultZoom={14}
                    gestureHandling="greedy"
                    // The default Google chrome (Map/Satellite tabs, pegman, compass,
                    // fullscreen) eats most of a phone-sized map — keep it clean and
                    // rely on pinch/drag, which `greedy` already allows.
                    disableDefaultUI
                    clickableIcons={false}
                    mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_ID || undefined}
                >
                    {/* Fit-to-route on "Navegar" */}
                    <MapFocuser signal={focusSignal} points={focusPoints} />

                    {/* Route polyline */}
                    {route?.polyline && <RoutePolyline encodedPath={route.polyline} />}

                    {/* Driver marker */}
                    {driverLocation && hasMapId && (
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
                    {driverLocation && !hasMapId && (
                        <Marker
                            position={{ lat: driverLocation.lat, lng: driverLocation.lng }}
                            title="Repartidor"
                            icon={markerIcon(ICON_DRIVER)}
                            zIndex={3}
                        />
                    )}

                    {/* Destination marker */}
                    {hasMapId ? (
                        <AdvancedMarker
                            position={{ lat: destination.lat, lng: destination.lng }}
                            title="Destino de entrega"
                        >
                            <div className="h-10 w-10 rounded-full bg-red-500 flex items-center justify-center shadow-lg border-2 border-white">
                                <Home className="h-5 w-5 text-white" />
                            </div>
                        </AdvancedMarker>
                    ) : (
                        <Marker
                            position={{ lat: destination.lat, lng: destination.lng }}
                            title="Destino de entrega"
                            icon={markerIcon(ICON_DESTINATION)}
                            zIndex={2}
                        />
                    )}

                    {/* Branch marker with logo */}
                    {branchLocation && branchLogo && (
                        <BranchLogoMarker
                            position={{ lat: branchLocation.lat, lng: branchLocation.lng }}
                            title="El Club del Repulge"
                            logoUrl={branchLogo}
                            size={44}
                            accentColor={branchAccentColor || "#f97316"}
                            zIndex={1}
                        />
                    )}
                </Map>
            </div>

            {/* Last updated */}
            {lastUpdated && (
                <div className="flex flex-col items-center justify-center gap-1">
                    <div className="flex items-center justify-center gap-1.5">
                        <span className="relative flex h-1.5 w-1.5 shrink-0">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-green-500/60 animate-ping" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
                        </span>
                        <p className="text-[11px] text-muted-foreground">
                            Actualizado {formatRelative(lastUpdated, now)}
                            {driverLocation?.accuracy != null &&
                                ` · ±${Math.round(driverLocation.accuracy)}m`}
                        </p>
                    </div>
                    {now - lastUpdated.getTime() > 90000 && (
                        <p className="text-xs text-amber-600 dark:text-amber-500">
                            Esperando señal del repartidor…
                        </p>
                    )}
                </div>
            )}

            {!driverLocation && driverId && (
                <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground">
                        {branchLocation
                            ? "Mostrando ruta desde la sucursal hasta que el GPS esté activo..."
                            : "Esperando ubicación del repartidor..."}
                    </p>
                </div>
            )}
        </div>
    )
}
