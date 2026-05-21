import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const driverId = searchParams.get("driverId")

    if (!driverId) {
        return NextResponse.json({ error: "Driver ID required" }, { status: 400 })
    }

    try {
        const supabase = await createClient()

        // Get orders assigned to this driver
        const { data: orders, error: oErr } = await supabase
            .from("orders")
            .select("*")
            .eq("driver_id", driverId)
            .in("status", ["ready", "delivered"])
            .order("driver_assigned_at", { ascending: false })
            .limit(20)

        if (oErr) throw oErr
        if (!orders || orders.length === 0) return NextResponse.json([])

        // Get order items
        const orderIds = orders.map((o) => o.id)
        const { data: items, error: iErr } = await supabase
            .from("order_items")
            .select("*")
            .in("order_id", orderIds)

        if (iErr) throw iErr

        // Group items by order
        const itemsByOrder = new Map<string, any[]>()
        for (const item of items || []) {
            const arr = itemsByOrder.get(item.order_id) || []
            arr.push(item)
            itemsByOrder.set(item.order_id, arr)
        }

        // Map orders
        const mappedOrders = orders.map((row) => ({
            id: row.id,
            orderNumber: row.order_number,
            trackingToken: row.public_tracking_token,
            customerName: row.customer_name,
            customerPhone: row.customer_phone || "",
            address: row.address_text || "",
            deliveryNotes: row.notes || "",
            deliveryMethod: row.fulfillment_type,
            paymentMethod: row.payment_method,
            items: (itemsByOrder.get(row.id) || []).map((item: any) => ({
                id: item.id,
                productId: item.producto_id || "",
                name: item.nombre_snapshot,
                image: "/images/classic-burger.jpg",
                price: parseFloat(item.precio_unit),
                quantity: item.qty,
                modifiers: (item.modifiers_json || []) as any[],
            })),
            subtotal: parseFloat(row.subtotal),
            deliveryFee: parseFloat(row.delivery_fee),
            total: parseFloat(row.total),
            status: row.status,
            createdAt: row.created_at,
            branchId: row.sucursal_id || "",
            addressLat: row.address_lat ? parseFloat(row.address_lat) : null,
            addressLng: row.address_lng ? parseFloat(row.address_lng) : null,
        }))

        return NextResponse.json(mappedOrders)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
