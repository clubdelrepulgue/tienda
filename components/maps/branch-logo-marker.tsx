"use client"

import { useEffect, useState } from "react"
import { Marker } from "@vis.gl/react-google-maps"

export interface BranchLogoMarkerProps {
    position: { lat: number; lng: number }
    title?: string
    logoUrl?: string
    /** Diámetro del círculo del logo en px (tamaño lógico en el mapa). */
    size?: number
    /** Color del borde y la punta del pin. */
    accentColor?: string
    zIndex?: number
}

// Factor de supersampling: renderizamos grande y lo mostramos chico => nítido.
const RENDER_SCALE = 3

/**
 * Dibuja un pin con forma de gota suave (líneas tangentes al círculo) cuyo
 * círculo superior contiene el logo recortado en redondo. Devuelve un data URL
 * de alta resolución para usar como `icon` de un Marker clásico — funciona sin Map ID.
 */
function buildLogoPin(
    logo: HTMLImageElement,
    size: number,
    accentColor: string
): { url: string; width: number; height: number; anchorX: number; anchorY: number } {
    const s = RENDER_SCALE
    const border = Math.max(3, Math.round(size * 0.1)) * s
    const r = (size / 2) * s
    const tailLen = r * 0.95 // qué tan abajo llega la punta respecto al centro
    const pad = Math.round(6 * s) // margen para la sombra

    const cx = pad + r
    const cy = pad + r
    const tipY = cy + r + tailLen
    const width = pad * 2 + r * 2
    const height = tipY + pad

    const canvas = document.createElement("canvas")
    canvas.width = Math.ceil(width)
    canvas.height = Math.ceil(height)
    const ctx = canvas.getContext("2d")!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = "high"

    // Geometría de la gota: tangentes desde la punta P al círculo.
    const d = tipY - cy // distancia centro -> punta
    const beta = Math.acos(r / d)
    const a1 = Math.PI / 2 - beta
    const a2 = Math.PI / 2 + beta

    // Forma exterior (color de acento) con sombra, una sola vez.
    ctx.save()
    ctx.shadowColor = "rgba(0,0,0,0.35)"
    ctx.shadowBlur = 5 * s
    ctx.shadowOffsetY = 2 * s
    ctx.beginPath()
    ctx.arc(cx, cy, r, a1, a2, true) // arco superior del círculo
    ctx.lineTo(cx, tipY) // baja a la punta
    ctx.closePath()
    ctx.fillStyle = accentColor
    ctx.fill()
    ctx.restore()

    // Aro blanco interior (sin sombra).
    ctx.beginPath()
    ctx.arc(cx, cy, r - border / 2, 0, Math.PI * 2)
    ctx.fillStyle = "#ffffff"
    ctx.fill()

    // Logo recortado en círculo, con object-fit: cover.
    const inner = r - border
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, inner, 0, Math.PI * 2)
    ctx.clip()

    const ratio = logo.width / logo.height
    let dw = inner * 2
    let dh = inner * 2
    if (ratio > 1) dw = dh * ratio
    else dh = dw / ratio
    ctx.drawImage(logo, cx - dw / 2, cy - dh / 2, dw, dh)
    ctx.restore()

    return {
        url: canvas.toDataURL("image/png"),
        width: Math.ceil(width) / s, // tamaño lógico (mostrado en el mapa)
        height: Math.ceil(height) / s,
        anchorX: cx / s,
        anchorY: tipY / s, // la punta toca la coordenada exacta
    }
}

export function BranchLogoMarker({
    position,
    title = "Sucursal",
    logoUrl = "/assets/brand/logo.jpeg",
    size = 50,
    accentColor = "#ffffff",
    zIndex = 20,
}: BranchLogoMarkerProps) {
    const [icon, setIcon] = useState<google.maps.Icon | null>(null)

    useEffect(() => {
        let cancelled = false
        const img = new Image()
        img.crossOrigin = "anonymous"
        img.src = logoUrl
        img.onload = () => {
            if (cancelled) return
            try {
                const pin = buildLogoPin(img, size, accentColor)
                setIcon({
                    url: pin.url,
                    scaledSize: new google.maps.Size(pin.width, pin.height),
                    anchor: new google.maps.Point(pin.anchorX, pin.anchorY),
                })
            } catch {
                setIcon(null) // si algo falla, cae al pin por defecto
            }
        }
        return () => {
            cancelled = true
        }
    }, [logoUrl, size, accentColor])

    return (
        <Marker
            position={position}
            title={title}
            zIndex={zIndex}
            icon={icon || undefined}
        />
    )
}
