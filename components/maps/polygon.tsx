"use client"

import { useEffect, useRef } from "react"
import { useMap } from "@vis.gl/react-google-maps"

interface PolygonProps {
    paths: { lat: number; lng: number }[]
    strokeColor?: string
    fillColor?: string
    fillOpacity?: number
    strokeWeight?: number
    clickable?: boolean
    onClick?: () => void
}

export function Polygon({
    paths,
    strokeColor = "#3b82f6",
    fillColor = "#3b82f6",
    fillOpacity = 0.2,
    strokeWeight = 2,
    clickable = false,
    onClick,
}: PolygonProps) {
    const map = useMap()
    const polygonRef = useRef<google.maps.Polygon | null>(null)

    useEffect(() => {
        if (!map) return

        const polygon = new google.maps.Polygon({
            paths,
            strokeColor,
            fillColor,
            fillOpacity,
            strokeWeight,
            clickable,
            map,
        })

        polygonRef.current = polygon

        if (clickable && onClick) {
            polygon.addListener("click", onClick)
        }

        return () => {
            polygon.setMap(null)
        }
    }, [map, paths, strokeColor, fillColor, fillOpacity, strokeWeight, clickable, onClick])

    return null
}
