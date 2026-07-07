"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { normalizePhone } from "@/lib/customer"
import { LOYALTY_TARGET } from "@/lib/loyalty"
import type { CustomerLoyalty } from "@/lib/loyalty"

export interface AccountOrderSummary {
    id: string
    orderNumber?: number
    trackingToken: string
    createdAt: string
    total: number
    status: string
    fulfillmentType: string
    branchName: string
    branchSlug: string
    itemCount: number
}

export interface AccountData {
    profile: {
        name: string
        email: string
        avatarUrl: string
    }
    customer: {
        phone: string
        name: string
    } | null
    loyalty: CustomerLoyalty | null
    orders: AccountOrderSummary[]
    needsPhone: boolean
}

function isMissingRelationError(error: any) {
    // 42P01 = missing table, 42703 = missing column (scripts/012-013 not run yet)
    return error?.code === "42P01" || error?.code === "42703"
}

function profileFromUser(user: any) {
    const meta = user.user_metadata || {}
    return {
        name: meta.full_name || meta.name || user.email || "",
        email: user.email || "",
        avatarUrl: meta.avatar_url || meta.picture || "",
    }
}

// Link the logged-in Google account to the customer record keyed by phone.
// Loyalty and order history carry over: the customer row is the same one
// guest checkouts have been feeding all along.
export async function linkCustomerAccount(phone?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: "Iniciá sesión para vincular tu cuenta" }

    const admin = createAdminClient()

    try {
        const { data: existing, error: existingError } = await admin
            .from("customers")
            .select("id, phone")
            .eq("auth_user_id", user.id)
            .maybeSingle()

        if (existingError) throw existingError
        if (existing) return { success: true, phone: existing.phone }

        const normalized = normalizePhone(phone || "")
        if (!normalized) return { success: false, needsPhone: true }

        const profile = profileFromUser(user)

        const { data: byPhone, error: byPhoneError } = await admin
            .from("customers")
            .select("id, auth_user_id, name")
            .eq("phone", normalized)
            .maybeSingle()

        if (byPhoneError) throw byPhoneError

        if (byPhone) {
            if (byPhone.auth_user_id && byPhone.auth_user_id !== user.id) {
                return { error: "Ese teléfono ya está asociado a otra cuenta de Google" }
            }

            const { error: linkError } = await admin
                .from("customers")
                .update({
                    auth_user_id: user.id,
                    name: byPhone.name || profile.name || null,
                })
                .eq("id", byPhone.id)
                .is("auth_user_id", null)

            if (linkError) throw linkError
            return { success: true, phone: normalized }
        }

        const { error: insertError } = await admin.from("customers").insert({
            phone: normalized,
            name: profile.name || null,
            auth_user_id: user.id,
        })

        if (insertError) throw insertError
        return { success: true, phone: normalized }
    } catch (error: any) {
        if (isMissingRelationError(error)) {
            return { error: "El sistema de cuentas todavía no está habilitado" }
        }
        console.error("Error linking customer account:", error?.message || error)
        return { error: "No se pudo vincular la cuenta" }
    }
}

export async function getAccountData(): Promise<{ error: string } | AccountData> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: "Sesión requerida" }

    const admin = createAdminClient()
    const profile = profileFromUser(user)

    let customerRow: any = null
    try {
        const { data, error } = await admin
            .from("customers")
            .select("id, phone, name, orders_count, loyalty_progress, reward_coupon_code")
            .eq("auth_user_id", user.id)
            .maybeSingle()

        if (error) throw error
        customerRow = data
    } catch (error: any) {
        if (!isMissingRelationError(error)) {
            console.error("Error loading customer:", error?.message || error)
        }
        return { profile, customer: null, loyalty: null, orders: [], needsPhone: true }
    }

    if (!customerRow) {
        return { profile, customer: null, loyalty: null, orders: [], needsPhone: true }
    }

    const loyalty: CustomerLoyalty = {
        ordersCount: customerRow.orders_count ?? 0,
        progress: customerRow.loyalty_progress ?? 0,
        target: LOYALTY_TARGET,
        rewardCouponCode: customerRow.reward_coupon_code || null,
    }

    let orders: AccountOrderSummary[] = []
    try {
        const [{ data: orderRows, error: ordersError }, { data: branchRows }] = await Promise.all([
            admin
                .from("orders")
                .select("id, order_number, public_tracking_token, created_at, total, status, fulfillment_type, sucursal_id, order_items(count)")
                .eq("customer_id", customerRow.id)
                .order("created_at", { ascending: false })
                .limit(20),
            admin.from("sucursales").select("id, nombre, slug"),
        ])

        if (ordersError) throw ordersError

        const branchById = new Map<string, { nombre: string; slug: string }>(
            (branchRows || []).map((b: any) => [b.id, { nombre: b.nombre, slug: b.slug }])
        )

        orders = (orderRows || []).map((row: any) => ({
            id: row.id,
            orderNumber: row.order_number,
            trackingToken: row.public_tracking_token,
            createdAt: row.created_at,
            total: parseFloat(row.total),
            status: row.status,
            fulfillmentType: row.fulfillment_type,
            branchName: branchById.get(row.sucursal_id)?.nombre || "",
            branchSlug: branchById.get(row.sucursal_id)?.slug || "",
            itemCount: Array.isArray(row.order_items) ? row.order_items[0]?.count ?? 0 : 0,
        }))
    } catch (error: any) {
        if (!isMissingRelationError(error)) {
            console.error("Error loading account orders:", error?.message || error)
        }
    }

    return {
        profile,
        customer: { phone: customerRow.phone, name: customerRow.name || profile.name },
        loyalty,
        orders,
        needsPhone: false,
    }
}
