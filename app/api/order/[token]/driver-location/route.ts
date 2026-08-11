import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(
    _request: NextRequest,
    context: { params: Promise<{ token: string }> }
) {
    const { token } = await context.params

    if (!token) {
        return NextResponse.json({ error: "Token requerido" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: order, error: orderError } = await supabase
        .from("orders")
        .select("id, status, driver_id")
        .eq("public_tracking_token", token)
        .maybeSingle()

    if (orderError) {
        return NextResponse.json({ error: orderError.message }, { status: 400 })
    }

    if (!order) {
        return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 })
    }

    if (order.status !== "en_route" || !order.driver_id) {
        return NextResponse.json({ location: null })
    }

    const { data: driver, error: driverError } = await supabase
        .from("drivers")
        .select("current_location, last_seen_at")
        .eq("id", order.driver_id)
        .eq("is_active", true)
        .maybeSingle()

    if (driverError) {
        // La migración 016 puede no estar aplicada: reintentamos sin last_seen_at
        // antes de dejar al cliente sin seguimiento.
        if (driverError.code === "42703") {
            const { data: basic } = await supabase
                .from("drivers")
                .select("current_location")
                .eq("id", order.driver_id)
                .eq("is_active", true)
                .maybeSingle()

            return NextResponse.json(
                { location: basic?.current_location ?? null, lastSeenAt: null },
                { headers: { "Cache-Control": "no-store" } }
            )
        }
        return NextResponse.json({ error: driverError.message }, { status: 400 })
    }

    // `lastSeenAt` deja que el cliente distinga "el repartidor está parado en un
    // semáforo" de "perdimos su señal", que en el mapa se ven exactamente igual.
    return NextResponse.json(
        {
            location: driver?.current_location ?? null,
            lastSeenAt: driver?.last_seen_at ?? null,
        },
        { headers: { "Cache-Control": "no-store" } }
    )
}
