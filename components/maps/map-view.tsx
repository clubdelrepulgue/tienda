"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Map, useMap, AdvancedMarker, Pin, MapControl, ControlPosition } from "@vis.gl/react-google-maps"
import { Polygon } from "./polygon"

export interface MapMarker {
    id: string
    lat: number
    lng: number
    title?: string
    icon?: "branch" | "driver" | "customer" | "default"
    color?: string
    onClick?: () => void
}

export interface MapZone {
    id: string
    coordinates: { lat: number; lng: number }[]
    color?: string
    fillOpacity?: number
    onClick?: () => void
}

interface MapViewProps {
    center?: { lat: number; lng: number }
    zoom?: number
    markers?: MapMarker[]
    zones?: MapZone[]
    onMapClick?: (lat: number, lng: number) => void
    onMapLoad?: (map: google.maps.Map) => void
    height?: string
    className?: string
    showCurrentLocation?: boolean
}

const defaultCenter = { lat: -34.6037, lng: -58.3816 } // Buenos Aires

function CurrentLocationButton() {
    const map = useMap()

    const handleClick = useCallback(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords
                    map?.panTo({ lat: latitude, lng: longitude })
                    map?.setZoom(16)
                },
                (error) => {
                    console.error("Error getting location:", error)
                }
            )
        }
    }, [map])

    return (
        <button
            onClick={handleClick}
            className="bg-white p-2 rounded-lg shadow-md hover:bg-gray-50 transition-colors"
            title="Ir a mi ubicación"
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="3" fill="currentColor" />
            </svg>
        </button>
    )
}

// Marcador tradicional que funciona sin Map ID
function TraditionalMarker({
    map,
    position,
    title,
    color = "#3b82f6",
    onClick,
}: {
    map: google.maps.Map
    position: google.maps.LatLngLiteral
    title?: string
    color?: string
    onClick?: () => void
}) {
    const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null)

    useEffect(() => {
        // Crear el elemento del pin con el color
        const pinElement = document.createElement("div")
        pinElement.innerHTML = `
            <svg width="32" height="40" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 24 16 24s16-12 16-24C32 7.163 24.837 0 16 0z" fill="${color}"/>
                <circle cx="16" cy="16" r="8" fill="white"/>
            </svg>
        `
        pinElement.style.cursor = "pointer"

        // Crear el marcador avanzado con elemento personalizado
        const marker = new google.maps.marker.AdvancedMarkerElement({
            map,
            position,
            title,
            content: pinElement,
        })

        if (onClick) {
            marker.addListener("click", onClick)
        }

        markerRef.current = marker

        return () => {
            marker.map = null
        }
    }, [map, position, title, color, onClick])

    return null
}

export function MapView({
    center = defaultCenter,
    zoom = 13,
    markers = [],
    zones = [],
    onMapClick,
    onMapLoad,
    height = "400px",
    className = "",
    showCurrentLocation = true,
}: MapViewProps) {
    const [selectedMarker, setSelectedMarker] = useState<string | null>(null)
    const [map, setMap] = useState<google.maps.Map | null>(null)
    const hasMapId = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_ID

    const handleMapClick = useCallback(
        (e: google.maps.MapMouseEvent) => {
            if (e.latLng && onMapClick) {
                onMapClick(e.latLng.lat(), e.latLng.lng())
            }
        },
        [onMapClick]
    )

    const handleMapLoad = useCallback(
        (mapInstance: google.maps.Map) => {
            setMap(mapInstance)
            onMapLoad?.(mapInstance)
        },
        [onMapLoad]
    )

    const getPinConfig = (marker: MapMarker) => {
        const colors = {
            branch: marker.color || "#3b82f6",
            driver: marker.color || "#22c55e",
            customer: marker.color || "#ef4444",
            default: marker.color || "#3b82f6",
        }
        return {
            background: colors[marker.icon || "default"],
            borderColor: colors[marker.icon || "default"],
            glyphColor: "#ffffff",
        }
    }

    return (
        <div style={{ height }} className={`rounded-xl overflow-hidden ${className}`}>
            <Map
                defaultCenter={center}
                defaultZoom={zoom}
                gestureHandling="greedy"
                disableDefaultUI={false}
                mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_ID || undefined}
                onClick={handleMapClick}
                onLoad={handleMapLoad}
            >
                {/* Render zones */}
                {zones.map((zone) => (
                    <Polygon
                        key={zone.id}
                        paths={zone.coordinates}
                        strokeColor={zone.color || "#3b82f6"}
                        fillColor={zone.color || "#3b82f6"}
                        fillOpacity={zone.fillOpacity ?? 0.2}
                        strokeWeight={2}
                        clickable={!!zone.onClick}
                        onClick={zone.onClick}
                    />
                ))}

                {/* Render markers - use AdvancedMarker with Pin if Map ID exists, otherwise use traditional markers */}
                {hasMapId ? (
                    // Usar AdvancedMarker con Pin (requiere Map ID)
                    markers.map((marker) => (
                        <AdvancedMarker
                            key={marker.id}
                            position={{ lat: marker.lat, lng: marker.lng }}
                            title={marker.title}
                            onClick={() => {
                                setSelectedMarker(marker.id)
                                marker.onClick?.()
                            }}
                        >
                            <Pin {...getPinConfig(marker)} />
                        </AdvancedMarker>
                    ))
                ) : (
                    // Usar marcadores tradicionales (funciona sin Map ID)
                    map &&
                    markers.map((marker) => (
                        <TraditionalMarker
                            key={marker.id}
                            map={map}
                            position={{ lat: marker.lat, lng: marker.lng }}
                            title={marker.title}
                            color={
                                marker.icon === "driver"
                                    ? marker.color || "#22c55e"
                                    : marker.icon === "customer"
                                    ? marker.color || "#ef4444"
                                    : marker.color || "#3b82f6"
                            }
                            onClick={() => {
                                setSelectedMarker(marker.id)
                                marker.onClick?.()
                            }}
                        />
                    ))
                )}

                {/* Current location button */}
                {showCurrentLocation && (
                    <MapControl position={ControlPosition.RIGHT_BOTTOM}>
                        <div className="mb-4 mr-4">
                            <CurrentLocationButton />
                        </div>
                    </MapControl>
                )}
            </Map>
        </div>
    )
}
