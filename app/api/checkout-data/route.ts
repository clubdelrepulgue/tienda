import { NextResponse } from "next/server"
import { getBranches, getDeliveryZones } from "@/lib/supabase/queries"

export async function GET() {
    try {
        const [branches, zones] = await Promise.all([
            getBranches(),
            getDeliveryZones(),
        ])

        const openBranches = branches.filter((branch) => branch.isOpen)
        const openBranchIds = new Set(openBranches.map((branch) => branch.id))
        const activeZones = zones.filter((zone) => openBranchIds.has(zone.branchId))

        return NextResponse.json({
            branches: openBranches,
            deliveryZones: activeZones,
        })
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "No se pudieron cargar los datos de checkout" },
            { status: 500 }
        )
    }
}
