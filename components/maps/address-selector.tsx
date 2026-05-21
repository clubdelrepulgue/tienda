"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Map, useMap, AdvancedMarker, Pin } from "@vis.gl/react-google-maps"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { MapPin, Search, Navigation } from "lucide-react"
import { toast } from "sonner"
import { Polygon } from "./polygon"

interface AddressSelectorProps {
    value?: { lat: number; lng: number; address: string }
    onChange: (location: { lat: number; lng: number; address: string }) => void
    zones?: {
        id: string
        coordinates: { lat: number; lng: number }[]
        color: string
        name: string
    }[]
    height?: string
    placeholder?: string
}

const defaultCenter = { lat: -34.6037, lng: -58.3816 }

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

// Marcador tradicional que funciona sin Map ID
function TraditionalMarker({
    map,
    position,
    color = "#ef4444",
    title,
}: {
    map: google.maps.Map
    position: google.maps.LatLngLiteral
    color?: string
    title?: string
}) {
    const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null)

    useEffect(() => {
        const pinElement = document.createElement("div")
        pinElement.innerHTML = `
            <svg width="32" height="40" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 24 16 24s16-12 16-24C32 7.163 24.837 0 16 0z" fill="${color}"/>
                <circle cx="16" cy="16" r="8" fill="white"/>
            </svg>
        `
        pinElement.style.cursor = "pointer"

        const marker = new google.maps.marker.AdvancedMarkerElement({
            map,
            position,
            title,
            content: pinElement,
        })

        markerRef.current = marker

        return () => {
            marker.map = null
        }
    }, [map, position, color, title])

    return null
}

export function AddressSelector({
    value,
    onChange,
    zones = [],
    height = "300px",
    placeholder = "Buscar dirección...",
}: AddressSelectorProps) {
    const map = useMap()
    const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(
        value ? { lat: value.lat, lng: value.lng } : null
    )
    const [searchQuery, setSearchQuery] = useState("")
    const [isSearching, setIsSearching] = useState(false)
    const [selectedZone, setSelectedZone] = useState<string | null>(null)
    const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null)
    const hasMapId = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_ID

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

    // Manejar clic en el mapa
    const handleMapClick = useCallback(
        async (e: google.maps.MapMouseEvent) => {
            if (!e.latLng) return

            const lat = e.latLng.lat()
            const lng = e.latLng.lng()

            setMarker({ lat, lng })

            const zone = checkZone(lat, lng)
            const address = await reverseGeocode(lat, lng)

            onChange({
                lat,
                lng,
                address: address || "Ubicación seleccionada",
            })

            if (!zone && zones.length > 0) {
                toast.warning("Esta ubicación está fuera de nuestras zonas de delivery")
            }
        },
        [checkZone, onChange, reverseGeocode, zones]
    )

    // Buscar dirección
    const handleSearch = useCallback(async () => {
        if (!searchQuery.trim()) return

        setIsSearching(true)
        try {
            const geocoder = new google.maps.Geocoder()
            const result = await geocoder.geocode({ address: searchQuery })

            if (result.results && result.results.length > 0) {
                const location = result.results[0].geometry.location
                const lat = location.lat()
                const lng = location.lng()

                setMarker({ lat, lng })
                map?.panTo({ lat, lng })
                map?.setZoom(16)

                const zone = checkZone(lat, lng)
                const address = result.results[0].formatted_address

                onChange({
                    lat,
                    lng,
                    address,
                })

                if (!zone && zones.length > 0) {
                    toast.warning("Esta ubicación está fuera de nuestras zonas de delivery")
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
    }, [searchQuery, map, checkZone, onChange, zones])

    // Usar ubicación actual
    const handleUseCurrentLocation = useCallback(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords
                    setMarker({ lat: latitude, lng: longitude })
                    map?.panTo({ lat: latitude, lng: longitude })
                    map?.setZoom(16)

                    const zone = checkZone(latitude, longitude)
                    const address = await reverseGeocode(latitude, longitude)

                    onChange({
                        lat: latitude,
                        lng: longitude,
                        address: address || "Mi ubicación actual",
                    })

                    if (!zone && zones.length > 0) {
                        toast.warning("Esta ubicación está fuera de nuestras zonas de delivery")
                    }
                },
                (error) => {
                    console.error("Geolocation error:", error)
                    toast.error("No se pudo obtener tu ubicación")
                }
            )
        } else {
            toast.error("Tu navegador no soporta geolocalización")
        }
    }, [map, checkZone, onChange, reverseGeocode, zones])

    const handleMapLoad = useCallback((map: google.maps.Map) => {
        setMapInstance(map)
    }, [])

    return (
        <div className="space-y-3">
            {/* Search bar */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
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

            {/* Map */}
            <div className="relative">
                <div style={{ height }} className="rounded-xl overflow-hidden border border-border">
                    <Map
                        defaultCenter={defaultCenter}
                        defaultZoom={13}
                        gestureHandling="greedy"
                        disableDefaultUI={false}
                        mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_ID || undefined}
                        onClick={handleMapClick}
                        onLoad={handleMapLoad}
                    >
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

                        {/* Marker with Map ID */}
                        {marker && hasMapId && (
                            <AdvancedMarker position={marker} title="Tu ubicación">
                                <Pin
                                    background="#ef4444"
                                    borderColor="#b91c1c"
                                    glyphColor="#ffffff"
                                    scale={1}
                                />
                            </AdvancedMarker>
                        )}

                        {/* Marker without Map ID */}
                        {marker && !hasMapId && mapInstance && (
                            <TraditionalMarker
                                map={mapInstance}
                                position={marker}
                                color="#ef4444"
                                title="Tu ubicación"
                            />
                        )}
                    </Map>
                </div>

                {/* Instructions */}
                {!marker && (
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

            {/* Selected address display */}
            {value?.address && (
                <div className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Dirección:</span>{" "}
                    {value.address}
                </div>
            )}

            {/* Zone indicator */}
            {marker && (
                <div className="flex items-center gap-2">
                    {selectedZone ? (
                        <>
                            <div
                                className="w-3 h-3 rounded-full"
                                style={{
                                    backgroundColor:
                                        zones.find((z) => z.id === selectedZone)?.color ||
                                        "#22c55e",
                                }}
                            />
                            <span className="text-sm text-green-600">
                                Dentro de la zona:{" "}
                                {zones.find((z) => z.id === selectedZone)?.name}
                            </span>
                        </>
                    ) : zones.length > 0 ? (
                        <>
                            <div className="w-3 h-3 rounded-full bg-red-500" />
                            <span className="text-sm text-red-500">
                                Fuera de las zonas de delivery
                            </span>
                        </>
                    ) : null}
                </div>
            )}
        </div>
    )
}
