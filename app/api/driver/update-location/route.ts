import { NextRequest, NextResponse } from "next/server"
import { updateDriverLocation } from "@/app/actions"

// Este endpoint recibe muchas escrituras chicas (una cada pocos segundos por
// repartidor en turno), así que no debe cachearse ni prerenderizarse.
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
    try {
        // `navigator.sendBeacon` manda un Blob: el content-type puede venir como
        // text/plain, así que parseamos el body crudo en lugar de request.json().
        const raw = await request.text()
        if (!raw) {
            return NextResponse.json({ error: "Empty body" }, { status: 400 })
        }

        let body: any
        try {
            body = JSON.parse(raw)
        } catch {
            return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
        }

        const { driverId, lat, lng, accuracy, speed, heading, capturedAt } = body

        if (!driverId || typeof lat !== "number" || typeof lng !== "number") {
            return NextResponse.json(
                { error: "Missing required fields: driverId, lat, lng" },
                { status: 400 }
            )
        }

        if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
            return NextResponse.json({ error: "Invalid lat" }, { status: 400 })
        }
        if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
            return NextResponse.json({ error: "Invalid lng" }, { status: 400 })
        }

        // Un `capturedAt` del futuro (reloj del celular adelantado) bloquearía
        // todas las posiciones siguientes por la comparación de monotonía.
        const captured = capturedAt ? new Date(capturedAt) : new Date()
        const safeCapturedAt =
            Number.isNaN(captured.getTime()) || captured.getTime() > Date.now() + 60_000
                ? new Date()
                : captured

        const result = await updateDriverLocation(driverId, lat, lng, {
            accuracy: typeof accuracy === "number" ? accuracy : null,
            speed: typeof speed === "number" ? speed : null,
            heading: typeof heading === "number" ? heading : null,
            capturedAt: safeCapturedAt.toISOString(),
        })

        if (result.error) {
            return NextResponse.json({ error: result.error }, { status: 400 })
        }

        return NextResponse.json(
            { success: true, stale: result.stale === true },
            { headers: { "Cache-Control": "no-store" } }
        )
    } catch (error: any) {
        console.error("[Driver Location API]", error)
        return NextResponse.json(
            { error: error.message || "Failed to update location" },
            { status: 500 }
        )
    }
}
