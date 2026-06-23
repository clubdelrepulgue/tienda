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

    if (order.status !== "ready" || !order.driver_id) {
        return NextResponse.json({ location: null })
    }

    const { data: driver, error: driverError } = await supabase
        .from("drivers")
        .select("current_location")
        .eq("id", order.driver_id)
        .eq("is_active", true)
        .maybeSingle()

    if (driverError) {
        return NextResponse.json({ error: driverError.message }, { status: 400 })
    }

    return NextResponse.json({ location: driver?.current_location ?? null })
}
