import { NextRequest, NextResponse } from "next/server"
import { getOrderByToken } from "@/lib/supabase/queries"

export async function GET(
    _request: NextRequest,
    context: { params: Promise<{ token: string }> }
) {
    const { token } = await context.params

    if (!token) {
        return NextResponse.json({ error: "Token requerido" }, { status: 400 })
    }

    const order = await getOrderByToken(token).catch(() => null)

    if (!order) {
        return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 })
    }

    return NextResponse.json(order)
}
