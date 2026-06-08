"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Map, Marker, useMap } from "@vis.gl/react-google-maps"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { MapPin, Search, Navigation } from "lucide-react"
import { toast } from "sonner"
import { Polygon } from "./polygon"

interface AddressSelectorProps {
    value?: { lat: number; lng: number; address: string }
    onChange: (location: { lat: number; lng: number; address: string }) => void
    onAddressChange?: (address: string) => void
    zones?: {
        id: string
        coordinates: { lat: number; lng: number }[]
        color: string
        name: string
    }[]
    height?: string
    placeholder?: string
    defaultCenter?: { lat: number; lng: number }
    searchCenter?: { lat: number; lng: number }
    searchRadiusKm?: number
    branchMarker?: { lat: number; lng: number; title?: string }
    showInstructions?: boolean
    simpleMap?: boolean
    reverseGeocodeOnSelect?: boolean
    lazyMap?: boolean
}

const fallbackCenter = { lat: -34.6037, lng: -58.3816 }

function MapInstanceSync({
    onMapReady,
}: {
    onMapReady: (map: google.maps.Map) => void
}) {
    const map = useMap()

    useEffect(() => {
        if (map) onMapReady(map)
    }, [map, onMapReady])

    return null
}

// Función para verificar si un punto está dentro de un polígono (point-in-polygon)
function isPointInPolygon(
    point: { lat: number; lng: number },
    polygon: { lat: number; lng: number }[]
): boolean {
    if (!polygon || polygon.length < 3) return false
    let inside = false
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].lng
        const yi = polygon[i].lat
        const xj = polygon[j].lng
        const yj = polygon[j].lat
        const intersect =
            yi > point.lat !== yj > point.lat &&
            point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi
        if (intersect) inside = !inside
    }
    return inside
}

export function AddressSelector({
    value,
    onChange,
    onAddressChange,
    zones = [],
    height = "300px",
    placeholder = "Buscar dirección...",
    defaultCenter,
    searchCenter,
    searchRadiusKm = 25,
    branchMarker,
    showInstructions = true,
    simpleMap = false,
    reverseGeocodeOnSelect = false,
    lazyMap = false,
}: AddressSelectorProps) {
    const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(
        value ? { lat: value.lat, lng: value.lng } : null
    )
    const [searchQuery, setSearchQuery] = useState("")
    const [isSearching, setIsSearching] = useState(false)
    const [selectedZone, setSelectedZone] = useState<string | null>(null)
    const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null)
    const [mapVisible, setMapVisible] = useState(!lazyMap)
    // Pending pan/zoom to apply once the map mounts (used when lazyMap triggers map open)
    const pendingPanRef = useRef<{ lat: number; lng: number; zoom: number } | null>(null)
    const mapCenter = defaultCenter || branchMarker || fallbackCenter
    const geocodeCenter = searchCenter || mapCenter

    // Geocodificación inversa para obtener dirección
    const reverseGeocode = useCallback(async (lat: number, lng: number): Promise<string> => {
        try {
            const geocoder = new google.maps.Geocoder()
            const result = await geocoder.geocode({ location: { lat, lng } })

            if (result.results && result.results.length > 0) {
                return result.results[0].formatted_address
            }
            return ""
        } catch (error) {
            console.error("Geocoding error:", error)
            return ""
        }
    }, [])

    // Verificar si el punto está dentro de alguna zona
    const checkZone = useCallback(
        (lat: number, lng: number) => {
            const point = { lat, lng }
            for (const zone of zones) {
                if (isPointInPolygon(point, zone.coordinates)) {
                    setSelectedZone(zone.id)
                    return zone
                }
            }
            setSelectedZone(null)
            return null
        },
        [zones]
    )

    const selectPoint = useCallback(
        async (lat: number, lng: number, providedAddress?: string) => {
            setMarker({ lat, lng })

            const zone = checkZone(lat, lng)
            const address =
                providedAddress ||
                (reverseGeocodeOnSelect ? await reverseGeocode(lat, lng) : "")
            const resolvedAddress = address || "Ubicación seleccionada"

            setSearchQuery(resolvedAddress)
            onAddressChange?.(resolvedAddress)

            onChange({
                lat,
                lng,
                address: resolvedAddress,
            })

            if (!zone && zones.length > 0) {
                toast.warning("Esta ubicación está fuera de nuestras zonas de delivery")
            }
        },
        [checkZone, onChange, reverseGeocode, reverseGeocodeOnSelect, zones]
    )

    // Manejar clic en el mapa
    const handleMapClick = useCallback(
        async (e: { detail?: { latLng?: { lat: number; lng: number } | null } }) => {
            const latLng = e.detail?.latLng
            if (!latLng) return

            const lat = latLng.lat
            const lng = latLng.lng
            await selectPoint(lat, lng)
        },
        [selectPoint]
    )

    const handleMarkerDragEnd = useCallback(
        async (position: google.maps.LatLngLiteral) => {
            await selectPoint(position.lat, position.lng)
        },
        [selectPoint]
    )

    // Buscar dirección
    const handleSearch = useCallback(async () => {
        if (!searchQuery.trim()) return

        setIsSearching(true)
        try {
            const geocoder = new google.maps.Geocoder()
            const radiusDegrees = searchRadiusKm / 111
            const bounds = new google.maps.LatLngBounds(
                {
                    lat: geocodeCenter.lat - radiusDegrees,
                    lng: geocodeCenter.lng - radiusDegrees,
                },
                {
                    lat: geocodeCenter.lat + radiusDegrees,
                    lng: geocodeCenter.lng + radiusDegrees,
                }
            )
            const result = await geocoder.geocode({
                address: searchQuery,
                bounds,
                region: "UY",
                componentRestrictions: { country: "UY" },
            })

            if (result.results && result.results.length > 0) {
                const location = result.results[0].geometry.location
                const lat = location.lat()
                const lng = location.lng()
                const address = result.results[0].formatted_address

                await selectPoint(lat, lng, address)

                // Auto-open map after successful search so user can confirm pin
                if (!mapVisible) {
                    pendingPanRef.current = { lat, lng, zoom: 16 }
                    setMapVisible(true)
                } else {
                    mapInstance?.panTo({ lat, lng })
                    mapInstance?.setZoom(16)
                }
            } else {
                toast.error("No se encontró la dirección")
            }
        } catch (error) {
            console.error("Search error:", error)
            toast.error("Error al buscar la dirección")
        } finally {
            setIsSearching(false)
        }
    }, [searchQuery, geocodeCenter, mapInstance, mapVisible, searchRadiusKm, selectPoint])

    // Usar ubicación actual
    const handleUseCurrentLocation = useCallback(() => {
        if (!navigator.geolocation) {
            toast.error("Tu navegador no soporta geolocalización")
            return
        }

        if (!window.isSecureContext) {
            toast.error("Para usar GPS abrí la web con HTTPS o desde localhost. En IP local con http el navegador lo bloquea.")
            return
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords

                await selectPoint(latitude, longitude, "Mi ubicación actual")

                // Auto-open map so user sees their pin
                if (!mapVisible) {
                    pendingPanRef.current = { lat: latitude, lng: longitude, zoom: 16 }
                    setMapVisible(true)
                } else {
                    mapInstance?.panTo({ lat: latitude, lng: longitude })
                    mapInstance?.setZoom(16)
                }
            },
            (error) => {
                console.error("Geolocation error:", error)
                const message =
                    error.code === error.PERMISSION_DENIED
                        ? "El navegador no tiene permiso para usar tu ubicación. Habilitalo en la barra de dirección."
                        : "No se pudo obtener tu ubicación. Probá buscar la dirección o mover el pin."
                toast.error(message)
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
        )
    }, [mapInstance, mapVisible, selectPoint])

    const handleMapReady = useCallback((map: google.maps.Map) => {
        setMapInstance(map)
        // Apply deferred pan/zoom (happens when map was opened lazily after a search/GPS)
        if (pendingPanRef.current) {
            map.panTo({ lat: pendingPanRef.current.lat, lng: pendingPanRef.current.lng })
            map.setZoom(pendingPanRef.current.zoom)
            pendingPanRef.current = null
        }
    }, [])

    useEffect(() => {
        if (!mapInstance || marker) return
        mapInstance.panTo(mapCenter)
        mapInstance.setZoom(branchMarker ? 13 : 12)
    }, [branchMarker, mapInstance, mapCenter, marker])

    return (
        <div className="space-y-3">
            {/* Search bar */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value)
                            onAddressChange?.(e.target.value)
                        }}
                        placeholder={placeholder}
                        className="pl-10 rounded-xl"
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    />
                </div>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={handleSearch}
                    disabled={isSearching}
                    className="rounded-xl"
                >
                    <Search className="h-4 w-4" />
                </Button>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={handleUseCurrentLocation}
                    className="rounded-xl"
                    title="Usar mi ubicación"
                >
                    <Navigation className="h-4 w-4" />
                </Button>
            </div>

            {/* Map — lazy: only mounts when mapVisible is true */}
            {mapVisible ? (
                <div className="relative">
                    <div style={{ height }} className="rounded-xl overflow-hidden border border-border">
                        <Map
                            defaultCenter={mapCenter}
                            defaultZoom={branchMarker ? 13 : 12}
                            gestureHandling="greedy"
                            disableDefaultUI={simpleMap}
                            zoomControl={!simpleMap}
                            fullscreenControl={!simpleMap}
                            streetViewControl={false}
                            mapTypeControl={!simpleMap}
                            mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_ID || undefined}
                            onClick={handleMapClick}
                        >
                            <MapInstanceSync onMapReady={handleMapReady} />

                            {/* Show zones */}
                            {zones.map((zone) => (
                                <Polygon
                                    key={zone.id}
                                    paths={zone.coordinates}
                                    strokeColor={zone.color}
                                    fillColor={zone.color}
                                    fillOpacity={selectedZone === zone.id ? 0.35 : 0.15}
                                    strokeWeight={selectedZone === zone.id ? 3 : 1}
                                />
                            ))}

                            {/* Branch marker */}
                            {branchMarker && (
                                <Marker
                                    position={{ lat: branchMarker.lat, lng: branchMarker.lng }}
                                    title={branchMarker.title || "Sucursal"}
                                    zIndex={20}
                                />
                            )}

                            {/* Customer marker */}
                            {marker && (
                                <Marker
                                    position={marker}
                                    title="Tu ubicación"
                                    draggable
                                    onDragEnd={(event) => {
                                        const lat = event.latLng?.lat()
                                        const lng = event.latLng?.lng()
                                        if (lat == null || lng == null) return
                                        handleMarkerDragEnd({ lat, lng })
                                    }}
                                />
                            )}
                        </Map>
                    </div>

                    {/* Instructions */}
                    {showInstructions && !marker && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="bg-background/90 backdrop-blur-sm px-4 py-3 rounded-xl shadow-lg border border-border">
                                <div className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-primary" />
                                    <p className="text-sm text-foreground">
                                        Haz clic en el mapa para seleccionar tu ubicación
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setMapVisible(true)}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors py-5 text-sm"
                >
                    <MapPin className="h-4 w-4" />
                    Ver mapa para confirmar ubicación
                </button>
            )}
        </div>
    )
}
