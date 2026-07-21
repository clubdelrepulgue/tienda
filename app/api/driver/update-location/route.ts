import { NextRequest, NextResponse } from "next/server"
import { updateDriverLocation } from "@/app/actions"

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { driverId, lat, lng, accuracy, speed, heading } = body

        if (!driverId || typeof lat !== "number" || typeof lng !== "number") {
            return NextResponse.json(
                { error: "Missing required fields: driverId, lat, lng" },
                { status: 400 }
            )
        }

        const result = await updateDriverLocation(driverId, lat, lng, {
            accuracy: accuracy ?? undefined,
            speed: speed ?? null,
            heading: heading ?? null,
        })

        if (result.error) {
            return NextResponse.json({ error: result.error }, { status: 400 })
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error("[Driver Location API]", error)
        return NextResponse.json(
            { error: error.message || "Failed to update location" },
            { status: 500 }
        )
    }
}
