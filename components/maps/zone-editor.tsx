"use client"

import { useState, useCallback, useEffect } from "react"
import { Map, useMap, Marker } from "@vis.gl/react-google-maps"
import { Polygon } from "./polygon"
import { Button } from "@/components/ui/button"
import { Undo, Trash2, Crosshair } from "lucide-react"

interface ZoneEditorProps {
    initialCoordinates?: { lat: number; lng: number }[]
    center?: { lat: number; lng: number }
    branchMarker?: { lat: number; lng: number; title?: string }
    zoneColor?: string
    onChange: (coordinates: { lat: number; lng: number }[]) => void
    height?: string
    readOnly?: boolean
}

const defaultCenter = { lat: -34.6037, lng: -58.3816 }

export function ZoneEditor({
    initialCoordinates = [],
    center,
    branchMarker,
    zoneColor = "#3b82f6",
    onChange,
    height = "500px",
    readOnly = false,
}: ZoneEditorProps) {
    const map = useMap()
    const [coordinates, setCoordinates] = useState<{ lat: number; lng: number }[]>(initialCoordinates)
    const [mapCenter, setMapCenter] = useState(center || defaultCenter)
    const [geolocating, setGeolocating] = useState(false)

    // On mount, try geolocation if no explicit center provided
    useEffect(() => {
        if (!center && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
                    setMapCenter(loc)
                    if (map) {
                        map.panTo(loc)
                        map.setZoom(14)
                    }
                },
                () => {
                    // Geolocation denied/unavailable - keep default center
                }
            )
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // Sync with initial coordinates when they change (e.g. editing a zone)
    useEffect(() => {
        if (initialCoordinates.length > 0) {
            setCoordinates(initialCoordinates)
        }
    }, [initialCoordinates])

    // Notify parent of changes
    useEffect(() => {
        onChange(coordinates)
    }, [coordinates]) // eslint-disable-line react-hooks/exhaustive-deps

    // @vis.gl/react-google-maps fires a CustomEvent with detail.latLng
    const handleMapClick = useCallback(
        (e: { detail: { latLng: { lat: number; lng: number } | null } }) => {
            if (readOnly) return
            const latLng = e.detail?.latLng
            if (!latLng) return

            const newPoint = { lat: latLng.lat, lng: latLng.lng }
            setCoordinates((prev) => [...prev, newPoint])
        },
        [readOnly]
    )

    const handleUndo = useCallback(() => {
        setCoordinates((prev) => prev.slice(0, -1))
    }, [])

    const handleClear = useCallback(() => {
        setCoordinates([])
    }, [])

    const handleGeolocate = useCallback(() => {
        if (!navigator.geolocation) return
        setGeolocating(true)
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
                if (map) {
                    map.panTo(loc)
                    map.setZoom(15)
                }
                setGeolocating(false)
            },
            () => setGeolocating(false)
        )
    }, [map])

    return (
        <div className="space-y-3">
            <div className="relative">
                <div style={{ height }} className="rounded-xl overflow-hidden border border-border">
                    <Map
                        defaultCenter={mapCenter}
                        defaultZoom={14}
                        gestureHandling="greedy"
                        disableDefaultUI={false}
                        mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_ID || undefined}
                        onClick={handleMapClick}
                    >
                        {/* Polygon */}
                        {coordinates.length >= 2 && (
                            <Polygon
                                paths={coordinates}
                                strokeColor={zoneColor}
                                fillColor={zoneColor}
                                fillOpacity={coordinates.length >= 3 ? 0.25 : 0.1}
                                strokeWeight={2}
                            />
                        )}

                        {/* Point markers */}
                        {!readOnly &&
                            coordinates.map((coord, index) => (
                                <Marker
                                    key={`point-${index}`}
                                    position={coord}
                                    title={`Punto ${index + 1}`}
                                />
                            ))}

                        {/* Branch marker */}
                        {branchMarker && (
                            <Marker
                                position={{ lat: branchMarker.lat, lng: branchMarker.lng }}
                                title={branchMarker.title || "Sucursal"}
                            />
                        )}
                    </Map>
                </div>

                {/* Geolocation button */}
                <Button
                    variant="outline"
                    size="icon"
                    className="absolute top-3 right-3 h-9 w-9 bg-background/90 backdrop-blur-sm rounded-lg shadow-md"
                    onClick={handleGeolocate}
                    disabled={geolocating}
                    title="Mi ubicación"
                >
                    <Crosshair className={`h-4 w-4 ${geolocating ? "animate-pulse" : ""}`} />
                </Button>

                {/* Instructions overlay */}
                {!readOnly && coordinates.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="bg-background/90 backdrop-blur-sm px-6 py-4 rounded-xl shadow-lg border border-border">
                            <p className="text-sm text-foreground">
                                Haz clic en el mapa para dibujar la zona de delivery
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Controls */}
            {!readOnly && (
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleUndo}
                            disabled={coordinates.length === 0}
                            className="rounded-xl"
                        >
                            <Undo className="h-4 w-4 mr-1" />
                            Deshacer
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleClear}
                            disabled={coordinates.length === 0}
                            className="rounded-xl text-destructive hover:text-destructive"
                        >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Limpiar
                        </Button>
                    </div>
                    <span className="text-sm text-muted-foreground">
                        {coordinates.length} puntos
                    </span>
                </div>
            )}
        </div>
    )
}
