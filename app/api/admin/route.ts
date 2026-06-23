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
import { getAdminScope, getEffectiveBranchId } from "@/lib/admin-scope"
import { createAdminClient } from "@/lib/supabase/admin"
import type { AdminUserAccount } from "@/lib/types"

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type")
    const requestedBranchId = searchParams.get("branchId")

    try {
        const scope = await getAdminScope()
        const branchId = getEffectiveBranchId(scope, requestedBranchId)

        switch (type) {
            case "session": {
                const branches = await getBranches()
                const visibleBranches = scope?.isGlobalAdmin
                    ? branches
                    : branches.filter((branch) => branch.id === scope?.branchId)

                return NextResponse.json({
                    scope,
                    branches: visibleBranches,
                    activeBranchId: branchId && branchId !== "__no_branch_access__"
                        ? branchId
                        : visibleBranches[0]?.id || null,
                })
            }
            case "categories":
                return NextResponse.json(await getCategories(branchId))
            case "products":
                return NextResponse.json(await getAllProducts(branchId))
            case "modifiers":
                return NextResponse.json(await getModifierGroups(branchId))
            case "branches":
                if (scope?.isGlobalAdmin) return NextResponse.json(await getBranches())
                return NextResponse.json((await getBranches()).filter((branch) => branch.id === scope?.branchId))
            case "orders":
                return NextResponse.json(await getOrders({ branchId }))
            case "coupons":
                return NextResponse.json(await getCoupons())
            case "delivery-zones":
                return NextResponse.json(
                    (await getAllDeliveryZones()).filter((zone) => !branchId || zone.branchId === branchId)
                )
            case "drivers":
                return NextResponse.json(await getDrivers())
            case "upsells":
                return NextResponse.json(await getAllUpsellRules(branchId))
            case "kitchen-orders":
                // Orders for kitchen display: new, accepted, preparing, ready
                return NextResponse.json(await getOrdersByStatus(["new", "accepted", "preparing", "ready"], branchId))
            case "dispatch": {
                // All data needed for the dispatch view
                const [dispatchOrders, zones, availableDrivers] = await Promise.all([
                    getOrders({ branchId }),
                    getAllDeliveryZones(),
                    getDrivers(),
                ])
                return NextResponse.json({
                    orders: dispatchOrders,
                    zones: branchId ? zones.filter((zone) => zone.branchId === branchId) : zones,
                    drivers: availableDrivers,
                })
            }
            case "scope": {
                return NextResponse.json(scope)
            }
            case "admin-users": {
                if (!scope?.isGlobalAdmin) {
                    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
                }

                const adminSupabase = createAdminClient()
                const [{ data: adminRows, error: adminRowsError }, authUsers, branches] = await Promise.all([
                    adminSupabase
                        .from("admin_users")
                        .select("id, user_id, role, sucursal_id, created_at")
                        .order("created_at", { ascending: true }),
                    adminSupabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
                    getBranches(),
                ])

                if (adminRowsError) throw adminRowsError
                if (authUsers.error) throw authUsers.error

                const usersById = new Map(authUsers.data.users.map((user) => [user.id, user]))
                const branchesById = new Map(branches.map((branch) => [branch.id, branch]))

                const accounts: AdminUserAccount[] = (adminRows || []).map((row: any) => {
                    const user = usersById.get(row.user_id)
                    const name = typeof user?.user_metadata?.name === "string"
                        ? user.user_metadata.name
                        : ""

                    return {
                        id: row.id,
                        userId: row.user_id,
                        email: user?.email || "Sin email",
                        name,
                        role: row.role,
                        branchId: row.sucursal_id || null,
                        branchName: row.sucursal_id ? branchesById.get(row.sucursal_id)?.name || null : null,
                        emailConfirmed: Boolean(user?.email_confirmed_at),
                        lastSignInAt: user?.last_sign_in_at || null,
                        createdAt: row.created_at,
                    }
                })

                return NextResponse.json({ users: accounts, branches })
            }
            default:
                return NextResponse.json({ error: "Tipo invalido" }, { status: 400 })
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
