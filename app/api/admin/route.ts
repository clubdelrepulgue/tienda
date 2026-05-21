import { NextRequest, NextResponse } from "next/server"
import { 
    getCategories, 
    getAllProducts, 
    getModifierGroups, 
    getBranches, 
    getOrders,
    getCoupons,
    getAllDeliveryZones,
    getDrivers,
    getAllUpsellRules,
    getOrdersByStatus
} from "@/lib/supabase/queries"

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type")

    try {
        switch (type) {
            case "categories":
                return NextResponse.json(await getCategories())
            case "products":
                return NextResponse.json(await getAllProducts())
            case "modifiers":
                return NextResponse.json(await getModifierGroups())
            case "branches":
                return NextResponse.json(await getBranches())
            case "orders":
                return NextResponse.json(await getOrders())
            case "coupons":
                return NextResponse.json(await getCoupons())
            case "delivery-zones":
                return NextResponse.json(await getAllDeliveryZones())
            case "drivers":
                return NextResponse.json(await getDrivers())
            case "upsells":
                return NextResponse.json(await getAllUpsellRules())
            case "kitchen-orders":
                // Orders for kitchen display: new, accepted, preparing, ready
                return NextResponse.json(await getOrdersByStatus(["new", "accepted", "preparing", "ready"]))
            case "dispatch": {
                // All data needed for the dispatch view
                const [dispatchOrders, zones, availableDrivers] = await Promise.all([
                    getOrders(),
                    getAllDeliveryZones(),
                    getDrivers(),
                ])
                return NextResponse.json({ orders: dispatchOrders, zones, drivers: availableDrivers })
            }
            default:
                return NextResponse.json({ error: "Invalid type" }, { status: 400 })
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
