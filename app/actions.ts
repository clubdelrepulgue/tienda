"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { canAccessBranch, getAdminScope } from "@/lib/admin-scope"
import { revalidatePath } from "next/cache"
import type { AdminRole, CartItem, DeliveryZone } from "@/lib/types"
import { formatPrice, slugify } from "@/lib/utils"
import { findDeliveryZoneForPoint, getZoneDeliveryFee } from "@/lib/delivery-zones"

type ActionResult<T extends object = {}> = Promise<
    T & {
        success?: boolean
        error?: string
    }
>

const ADMIN_ROLES: AdminRole[] = ["owner", "admin", "operator"]

function isAdminRole(value: string): value is AdminRole {
    return ADMIN_ROLES.includes(value as AdminRole)
}

async function requireGlobalAdmin() {
    const scope = await getAdminScope()
    if (!scope) return { error: "Sesion requerida" }
    if (!scope.isGlobalAdmin) return { error: "Solo un administrador global puede gestionar usuarios" }
    return { scope }
}

function validateAdminAssignment(role: AdminRole, branchId?: string | null) {
    if (role === "operator" && !branchId) {
        return "Los operadores deben tener una sucursal asignada"
    }

    return null
}

function normalizePhone(value: string) {
    return value.replace(/\D/g, "")
}

function toCents(value: number) {
    return Math.round((value + Number.EPSILON) * 100)
}

function mapDeliveryZoneRow(row: any): DeliveryZone {
    return {
        id: row.id,
        branchId: row.sucursal_id,
        name: row.name,
        color: row.color || "#3b82f6",
        coordinates: row.coordinates || [],
        deliveryFee: parseFloat(row.delivery_fee || 0),
        minOrderAmount: parseFloat(row.min_order_amount || 0),
        estimatedTimeMin: row.estimated_time_min,
        isActive: row.is_active,
    }
}

async function assertBranchAccess(branchId: string) {
    const scope = await getAdminScope()

    if (!scope) {
        return { error: "Sesion requerida" }
    }

    if (!canAccessBranch(scope, branchId)) {
        return { error: "No tienes acceso a esta sucursal" }
    }

    return { success: true }
}

async function getExistingBranchForCatalogRow(
    table: "categorias" | "productos" | "modifier_groups" | "upsell_rules",
    id: string
) {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from(table)
        .select("sucursal_id")
        .eq("id", id)
        .single()

    if (error || !data) return null
    return data.sucursal_id as string | null
}

async function setDriverAvailability(supabase: any, driverId: string, isAvailable: boolean) {
    const { error } = await supabase
        .from("drivers")
        .update({ is_available: isAvailable })
        .eq("id", driverId)

    if (error) {
        console.error("Error updating driver availability:", error.message)
    }
}

async function releaseDriverIfIdle(supabase: any, driverId: string) {
    const { data: activeOrders, error } = await supabase
        .from("orders")
        .select("id")
        .eq("driver_id", driverId)
        .in("status", ["ready", "en_route"])
        .limit(1)

    if (error) {
        console.error("Error checking driver active orders:", error.message)
        return
    }

    if (!activeOrders || activeOrders.length === 0) {
        await setDriverAvailability(supabase, driverId, true)
    }
}

// ─── Orders ────────────────────────────────────────────────────

export async function createOrder(formData: {
    customerName: string
    customerPhone: string
    fulfillmentType: "delivery" | "pickup"
    addressText: string
    notes: string
    paymentMethod: "mercadopago" | "cash"
    sucursalId: string
    items: CartItem[]
    subtotal: number
    deliveryFee: number
    total: number
    couponCode?: string
    couponDiscount?: number
    deliveryZoneId?: string
    orderType?: "online" | "pos" | "phone"
    createdBy?: string
    addressLat?: number
    addressLng?: number
}) {
    const supabase = await createClient()

    // Get current user if authenticated (for POS orders)
    const { data: { user } } = await supabase.auth.getUser()

    if (!formData.sucursalId) {
        return { error: "Selecciona una sucursal para el pedido" }
    }

    const { data: branch, error: branchError } = await supabase
        .from("sucursales")
        .select("id, is_open")
        .eq("id", formData.sucursalId)
        .single()

    if (branchError || !branch) {
        return { error: "Sucursal no encontrada" }
    }

    if ((formData.orderType || "online") === "online" && !branch.is_open) {
        return { error: "La sucursal seleccionada esta cerrada" }
    }

    const productIds = Array.from(new Set(formData.items.map((item) => item.productId).filter(Boolean)))
    if (productIds.length === 0) {
        return { error: "El pedido no tiene productos validos" }
    }

    const { data: products, error: productsError } = await supabase
        .from("productos")
        .select("id, sucursal_id, activo")
        .in("id", productIds)

    if (productsError) return { error: productsError.message }
    if (!products || products.length !== productIds.length) {
        return { error: "Hay productos que ya no estan disponibles" }
    }

    const invalidProduct = products.find(
        (product) => product.sucursal_id !== formData.sucursalId || product.activo === false
    )
    if (invalidProduct) {
        return { error: "El carrito contiene productos de otra sucursal o inactivos" }
    }

    // Validate product variants: each product's active variants must be honored,
    // the chosen variant must belong to the product and its price must match.
    const { data: variantRows, error: variantsError } = await supabase
        .from("producto_variantes")
        .select("id, producto_id, nombre, precio, activo")
        .in("producto_id", productIds)
        .eq("activo", true)

    if (variantsError) return { error: variantsError.message }

    const variantsByProduct = new Map<string, { id: string; nombre: string; precio: number }[]>()
    for (const variant of variantRows || []) {
        const arr = variantsByProduct.get(variant.producto_id) || []
        arr.push({ id: variant.id, nombre: variant.nombre, precio: Number(variant.precio) })
        variantsByProduct.set(variant.producto_id, arr)
    }

    for (const item of formData.items) {
        const productVariants = item.productId ? variantsByProduct.get(item.productId) : undefined

        if (productVariants && productVariants.length > 0) {
            if (!item.variantId) {
                return { error: "Selecciona una opción para los productos con variantes" }
            }
            const chosen = productVariants.find((v) => v.id === item.variantId)
            if (!chosen) {
                return { error: "La variante seleccionada ya no está disponible" }
            }
            if (toCents(chosen.precio) !== toCents(item.price)) {
                return { error: "El precio de la variante no coincide" }
            }
        } else if (item.variantId) {
            return { error: "El producto no admite la variante seleccionada" }
        }
    }

    const modifierGroupIds = Array.from(
        new Set(
            formData.items
                .flatMap((item) => item.modifiers || [])
                .map((modifier) => modifier.groupId)
                .filter(Boolean)
        )
    )

    if (modifierGroupIds.length > 0) {
        const { data: groups, error: groupsError } = await supabase
            .from("modifier_groups")
            .select("id, sucursal_id")
            .in("id", modifierGroupIds)

        if (groupsError) return { error: groupsError.message }
        if (!groups || groups.length !== modifierGroupIds.length) {
            return { error: "Hay modificadores que ya no estan disponibles" }
        }

        if (groups.some((group) => group.sucursal_id !== formData.sucursalId)) {
            return { error: "El carrito contiene modificadores de otra sucursal" }
        }
    }

    let resolvedDeliveryZoneId = formData.deliveryZoneId || null

    if (formData.fulfillmentType === "delivery") {
        if (!formData.addressText.trim()) {
            return { error: "Ingresa la dirección de entrega" }
        }

        const { data: zoneRows, error: zonesError } = await supabase
            .from("delivery_zones")
            .select("id, sucursal_id, name, color, coordinates, delivery_fee, min_order_amount, estimated_time_min, is_active")
            .eq("sucursal_id", formData.sucursalId)
            .eq("is_active", true)

        if (zonesError) return { error: zonesError.message }

        const activeZones = (zoneRows || []).map(mapDeliveryZoneRow)

        if (activeZones.length > 0) {
            if (formData.addressLat == null || formData.addressLng == null) {
                return { error: "Marca la ubicación en el mapa para calcular la zona de envío" }
            }

            const matchedZone = findDeliveryZoneForPoint(activeZones, {
                lat: formData.addressLat,
                lng: formData.addressLng,
            })

            if (!matchedZone) {
                return { error: "La ubicación está fuera de las zonas de envío disponibles" }
            }

            if (resolvedDeliveryZoneId && resolvedDeliveryZoneId !== matchedZone.id) {
                return { error: "La ubicación no corresponde a la zona de envío seleccionada" }
            }

            resolvedDeliveryZoneId = matchedZone.id
            const subtotalAfterDiscount = Math.max(0, formData.subtotal - (formData.couponDiscount || 0))
            const expectedDeliveryFee = getZoneDeliveryFee(matchedZone, subtotalAfterDiscount)

            if (toCents(expectedDeliveryFee) !== toCents(formData.deliveryFee)) {
                return { error: "El costo de envío no coincide con la zona seleccionada" }
            }
        } else if (resolvedDeliveryZoneId) {
            return { error: "La zona de envio no corresponde a la sucursal" }
        }
    } else {
        resolvedDeliveryZoneId = null
    }

    const expectedTotal = Math.max(0, formData.subtotal - (formData.couponDiscount || 0)) +
        (formData.fulfillmentType === "delivery" ? formData.deliveryFee : 0)

    if (toCents(expectedTotal) !== toCents(formData.total)) {
        return { error: "El total del pedido no coincide con el subtotal y el envío" }
    }

    const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
            customer_name: formData.customerName,
            customer_phone: formData.customerPhone,
            fulfillment_type: formData.fulfillmentType,
            address_text: formData.addressText,
            notes: formData.notes,
            payment_method: formData.paymentMethod,
            sucursal_id: formData.sucursalId || null,
            subtotal: formData.subtotal,
            delivery_fee: formData.deliveryFee,
            total: formData.total,
            status: "new",
            coupon_code: formData.couponCode || null,
            coupon_discount: formData.couponDiscount || 0,
            delivery_zone_id: resolvedDeliveryZoneId,
            order_type: formData.orderType || "online",
            created_by: formData.createdBy || user?.id || null,
            address_lat: formData.addressLat || null,
            address_lng: formData.addressLng || null,
        })
        .select("id, public_tracking_token, order_number")
        .single()

    if (orderError) {
        return { error: orderError.message }
    }

    // Insert order items
    const orderItems = formData.items.map((item) => ({
        order_id: order.id,
        producto_id: item.productId || null,
        nombre_snapshot: item.name,
        precio_unit: item.price,
        qty: item.quantity,
        modifiers_json: item.modifiers,
        variante_snapshot: item.variantName || null,
        nota: item.note?.trim() || null,
        total: (item.price + item.modifiers.reduce((s, m) => s + m.price, 0)) * item.quantity,
    }))

    const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems)

    if (itemsError) {
        return { error: itemsError.message }
    }

    revalidatePath("/admin/orders")
    revalidatePath("/admin")
    revalidatePath("/admin/kitchen")

    return {
        orderId: order.id,
        trackingToken: order.public_tracking_token,
        orderNumber: order.order_number,
    }
}

export async function updateOrderStatus(
    orderId: string,
    newStatus: string,
    driverId?: string
) {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: "Sesion requerida" }
    }

    const { data: adminUser, error: adminError } = await adminSupabase
        .from("admin_users")
        .select("id, role, sucursal_id")
        .eq("user_id", user.id)
        .single()

    if (adminError || !adminUser) {
        return { error: "No tienes acceso para actualizar pedidos" }
    }

    const { data: existingOrder, error: existingOrderError } = await adminSupabase
        .from("orders")
        .select("sucursal_id, driver_id")
        .eq("id", orderId)
        .single()

    if (existingOrderError || !existingOrder) {
        return { error: "Pedido no encontrado" }
    }

    const isGlobalAdmin = adminUser.role === "owner" || adminUser.role === "admin"
    if (!isGlobalAdmin && adminUser.sucursal_id !== existingOrder.sucursal_id) {
        return { error: "No tienes acceso a este pedido" }
    }

    const updateData: Record<string, any> = { status: newStatus }
    
    if (driverId) {
        updateData.driver_id = driverId
        updateData.driver_assigned_at = new Date().toISOString()
    }

    if (newStatus === "accepted") {
        updateData.accepted_at = new Date().toISOString()
    }

    if (newStatus === "preparing") {
        updateData.preparing_at = new Date().toISOString()
    }

    if (newStatus === "ready") {
        updateData.ready_at = new Date().toISOString()
    }

    if (newStatus === "en_route") {
        updateData.en_route_at = new Date().toISOString()
    }

    if (newStatus === "delivered") {
        updateData.delivered_at = new Date().toISOString()
    }

    if (newStatus === "cancelled") {
        updateData.cancelled_at = new Date().toISOString()
    }

    const { error } = await adminSupabase
        .from("orders")
        .update(updateData)
        .eq("id", orderId)

    if (error) {
        return { error: error.message }
    }

    if (driverId) {
        await setDriverAvailability(adminSupabase, driverId, false)
    }

    if (
        existingOrder.driver_id &&
        (newStatus === "delivered" ||
            newStatus === "cancelled" ||
            (driverId && driverId !== existingOrder.driver_id))
    ) {
        await releaseDriverIfIdle(adminSupabase, existingOrder.driver_id)
    }

    revalidatePath("/admin/orders")
    revalidatePath("/admin")
    revalidatePath("/admin/kitchen")
    revalidatePath("/admin/dispatch")
    revalidatePath("/driver/dashboard")
    return { success: true }
}

export async function assignDriver(orderId: string, driverId: string | null) {
    const supabase = await createClient()

    const { data: order } = await supabase
        .from("orders")
        .select("sucursal_id, driver_id")
        .eq("id", orderId)
        .single()

    if (!order) return { error: "Pedido no encontrado" }

    const access = await assertBranchAccess(order.sucursal_id)
    if ("error" in access) return access

    const { error } = await supabase
        .from("orders")
        .update({
            driver_id: driverId,
            driver_assigned_at: driverId ? new Date().toISOString() : null,
        })
        .eq("id", orderId)

    if (error) return { error: error.message }

    if (driverId) {
        await setDriverAvailability(supabase, driverId, false)
    }

    if (order.driver_id && order.driver_id !== driverId) {
        await releaseDriverIfIdle(supabase, order.driver_id)
    }

    revalidatePath("/admin/orders")
    revalidatePath("/admin/dispatch")
    revalidatePath("/driver/dashboard")
    return { success: true }
}

export async function assignDriverBatch(orderIds: string[], driverId: string) {
    const supabase = await createClient()

    const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("id, sucursal_id, driver_id")
        .in("id", orderIds)

    if (ordersError) return { error: ordersError.message }
    if (!orders || orders.length !== orderIds.length) return { error: "Hay pedidos no encontrados" }

    const scope = await getAdminScope()
    if (!scope) return { error: "Sesion requerida" }
    if (!scope.isGlobalAdmin && orders.some((order) => order.sucursal_id !== scope.branchId)) {
        return { error: "No tienes acceso a todos los pedidos seleccionados" }
    }

    const { error } = await supabase
        .from("orders")
        .update({
            driver_id: driverId,
            driver_assigned_at: new Date().toISOString(),
        })
        .in("id", orderIds)

    if (error) return { error: error.message }

    await setDriverAvailability(supabase, driverId, false)

    const previousDriverIds = Array.from(
        new Set(
            orders
                .map((order) => order.driver_id)
                .filter((id): id is string => !!id && id !== driverId)
        )
    )

    await Promise.all(previousDriverIds.map((id) => releaseDriverIfIdle(supabase, id)))

    revalidatePath("/admin/orders")
    revalidatePath("/admin/dispatch")
    revalidatePath("/driver/dashboard")
    return { success: true }
}

export async function setOrderEnRoute(orderId: string, driverId: string): ActionResult {
    if (!driverId) return { error: "Repartidor requerido" }

    const supabase = createAdminClient()

    const { data: order, error: orderError } = await supabase
        .from("orders")
        .select("id, driver_id, status")
        .eq("id", orderId)
        .maybeSingle()

    if (orderError) return { error: orderError.message }
    if (!order || order.driver_id !== driverId) {
        return { error: "Este pedido no está asignado a este repartidor" }
    }
    if (order.status !== "ready") {
        return { error: "El pedido no está en estado listo" }
    }

    const { error } = await supabase
        .from("orders")
        .update({ status: "en_route", en_route_at: new Date().toISOString() })
        .eq("id", orderId)
        .eq("driver_id", driverId)

    if (error) return { error: error.message }

    revalidatePath("/driver/dashboard")
    return { success: true }
}

export async function completeDriverOrder(orderId: string, driverId: string): ActionResult {
    if (!driverId) {
        return { error: "Repartidor requerido" }
    }

    const supabase = createAdminClient()
    const { data: order, error: orderError } = await supabase
        .from("orders")
        .select("id, driver_id, status")
        .eq("id", orderId)
        .maybeSingle()

    if (orderError) return { error: orderError.message }
    if (!order || order.driver_id !== driverId) {
        return { error: "Este pedido no esta asignado a este repartidor" }
    }
    if (order.status !== "ready" && order.status !== "en_route") {
        return { error: "El pedido no esta listo para entregar" }
    }

    const { error } = await supabase
        .from("orders")
        .update({
            status: "delivered",
            delivered_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .eq("driver_id", driverId)

    if (error) return { error: error.message }

    await releaseDriverIfIdle(supabase, driverId)

    revalidatePath("/admin/orders")
    revalidatePath("/admin/dispatch")
    revalidatePath("/driver/dashboard")
    return { success: true }
}

// ─── Products ──────────────────────────────────────────────────

type ProductVariantInput = {
    nombre: string
    precio: number
    activo?: boolean
}

function sanitizeVariants(variants: ProductVariantInput[] | undefined) {
    return (variants || [])
        .map((v) => ({
            nombre: (v.nombre || "").trim(),
            precio: Number(v.precio),
            activo: v.activo ?? true,
        }))
        .filter((v) => v.nombre.length > 0 && Number.isFinite(v.precio) && v.precio >= 0)
}

export async function createProduct(data: {
    nombre: string
    descripcion?: string
    precio: number
    imageUrl?: string
    images?: string[]
    branchId: string
    categoriaId: string
    activo?: boolean
    modifierGroupIds?: string[]
    variantGroupLabel?: string
    variants?: ProductVariantInput[]
}): ActionResult<{ id?: string }> {
    const supabase = await createClient()

    const access = await assertBranchAccess(data.branchId)
    if ("error" in access) return access

    const { data: category, error: categoryError } = await supabase
        .from("categorias")
        .select("id, sucursal_id")
        .eq("id", data.categoriaId)
        .single()

    if (categoryError || !category || category.sucursal_id !== data.branchId) {
        return { error: "La categoria no corresponde a la sucursal" }
    }

    if (data.modifierGroupIds && data.modifierGroupIds.length > 0) {
        const { data: groups, error: groupsError } = await supabase
            .from("modifier_groups")
            .select("id, sucursal_id")
            .in("id", data.modifierGroupIds)

        if (groupsError) return { error: groupsError.message }
        if (!groups || groups.length !== data.modifierGroupIds.length) {
            return { error: "Hay modificadores no encontrados" }
        }
        if (groups.some((group) => group.sucursal_id !== data.branchId)) {
            return { error: "Los modificadores deben ser de la misma sucursal" }
        }
    }

    const { data: product, error } = await supabase
        .from("productos")
        .insert({
            sucursal_id: data.branchId,
            nombre: data.nombre,
            descripcion: data.descripcion || "",
            precio: data.precio,
            image_url: data.imageUrl || (data.images && data.images.length > 0 ? data.images[0] : ""),
            images: data.images || [],
            categoria_id: data.categoriaId,
            activo: data.activo ?? true,
            variant_group_label: data.variantGroupLabel?.trim() || "Tamaño",
        })
        .select("id")
        .single()

    if (error) return { error: error.message }

    // Insert modifier group links
    if (data.modifierGroupIds && data.modifierGroupIds.length > 0) {
        const links = data.modifierGroupIds.map((gid) => ({
            producto_id: product.id,
            group_id: gid,
        }))
        await supabase.from("producto_modifier_groups").insert(links)
    }

    // Insert variants
    const variants = sanitizeVariants(data.variants)
    if (variants.length > 0) {
        const variantRows = variants.map((v, index) => ({
            producto_id: product.id,
            nombre: v.nombre,
            precio: v.precio,
            activo: v.activo,
            orden: index,
        }))
        const { error: variantErr } = await supabase.from("producto_variantes").insert(variantRows)
        if (variantErr) return { error: variantErr.message }
    }

    revalidatePath("/admin/products")
    return { success: true, id: product.id }
}

export async function updateProduct(
    id: string,
    data: {
        nombre?: string
        descripcion?: string
        precio?: number
        imageUrl?: string
        images?: string[]
        branchId?: string
        categoriaId?: string
        activo?: boolean
        modifierGroupIds?: string[]
        variantGroupLabel?: string
        variants?: ProductVariantInput[]
    }
): ActionResult {
    const supabase = await createClient()
    const existingBranchId = await getExistingBranchForCatalogRow("productos", id)
    if (!existingBranchId) return { error: "Producto no encontrado" }

    const targetBranchId = data.branchId || existingBranchId
    const access = await assertBranchAccess(targetBranchId)
    if ("error" in access) return access

    if (existingBranchId !== targetBranchId) {
        const moveAccess = await assertBranchAccess(existingBranchId)
        if ("error" in moveAccess) return moveAccess
    }

    if (data.categoriaId) {
        const { data: category, error: categoryError } = await supabase
            .from("categorias")
            .select("id, sucursal_id")
            .eq("id", data.categoriaId)
            .single()

        if (categoryError || !category || category.sucursal_id !== targetBranchId) {
            return { error: "La categoria no corresponde a la sucursal" }
        }
    }

    if (data.modifierGroupIds !== undefined && data.modifierGroupIds.length > 0) {
        const { data: groups, error: groupsError } = await supabase
            .from("modifier_groups")
            .select("id, sucursal_id")
            .in("id", data.modifierGroupIds)

        if (groupsError) return { error: groupsError.message }
        if (!groups || groups.length !== data.modifierGroupIds.length) {
            return { error: "Hay modificadores no encontrados" }
        }
        if (groups.some((group) => group.sucursal_id !== targetBranchId)) {
            return { error: "Los modificadores deben ser de la misma sucursal" }
        }
    }

    const updateData: Record<string, any> = {}
    if (data.branchId !== undefined) updateData.sucursal_id = data.branchId
    if (data.nombre !== undefined) updateData.nombre = data.nombre
    if (data.descripcion !== undefined) updateData.descripcion = data.descripcion
    if (data.precio !== undefined) updateData.precio = data.precio
    if (data.imageUrl !== undefined) updateData.image_url = data.imageUrl
    if (data.images !== undefined) updateData.images = data.images
    if (data.categoriaId !== undefined) updateData.categoria_id = data.categoriaId
    if (data.activo !== undefined) updateData.activo = data.activo
    if (data.variantGroupLabel !== undefined) {
        updateData.variant_group_label = data.variantGroupLabel.trim() || "Tamaño"
    }

    if (Object.keys(updateData).length > 0) {
        const { error } = await supabase
            .from("productos")
            .update(updateData)
            .eq("id", id)

        if (error) return { error: error.message }
    }

    if (data.modifierGroupIds !== undefined) {
        await supabase.from("producto_modifier_groups").delete().eq("producto_id", id)

        if (data.modifierGroupIds.length > 0) {
            const links = data.modifierGroupIds.map((gid) => ({
                producto_id: id,
                group_id: gid,
            }))
            const { error: linkErr } = await supabase.from("producto_modifier_groups").insert(links)
            if (linkErr) return { error: linkErr.message }
        }
    }

    // Replace variants wholesale (they are referenced only by name snapshots on orders)
    if (data.variants !== undefined) {
        await supabase.from("producto_variantes").delete().eq("producto_id", id)

        const variants = sanitizeVariants(data.variants)
        if (variants.length > 0) {
            const variantRows = variants.map((v, index) => ({
                producto_id: id,
                nombre: v.nombre,
                precio: v.precio,
                activo: v.activo,
                orden: index,
            }))
            const { error: variantErr } = await supabase.from("producto_variantes").insert(variantRows)
            if (variantErr) return { error: variantErr.message }
        }
    }

    revalidatePath("/admin/products")
    return { success: true }
}

export async function toggleProductActive(id: string): ActionResult {
    const supabase = await createClient()

    // Get current state
    const { data: product } = await supabase
        .from("productos")
        .select("activo, sucursal_id")
        .eq("id", id)
        .single()

    if (!product) return { error: "Producto no encontrado" }

    const access = await assertBranchAccess(product.sucursal_id)
    if ("error" in access) return access

    const { error } = await supabase
        .from("productos")
        .update({ activo: !product.activo })
        .eq("id", id)

    if (error) return { error: error.message }

    revalidatePath("/admin/products")
    return { success: true }
}

// ─── Categories ────────────────────────────────────────────────

export async function createCategory(data: {
    branchId: string
    nombre: string
    slug: string
    orden?: number
}): ActionResult {
    const supabase = await createClient()

    const access = await assertBranchAccess(data.branchId)
    if ("error" in access) return access

    const { error } = await supabase.from("categorias").insert({
        sucursal_id: data.branchId,
        nombre: data.nombre,
        slug: data.slug,
        orden: data.orden || 0,
    })

    if (error) return { error: error.message }

    revalidatePath("/admin/categories")
    revalidatePath("/admin/products")
    return { success: true }
}

export async function updateCategory(
    id: string,
    data: {
        branchId?: string
        nombre?: string
        slug?: string
        orden?: number
    }
): ActionResult {
    const supabase = await createClient()
    const existingBranchId = await getExistingBranchForCatalogRow("categorias", id)
    if (!existingBranchId) return { error: "Categoria no encontrada" }

    const targetBranchId = data.branchId || existingBranchId
    const access = await assertBranchAccess(targetBranchId)
    if ("error" in access) return access

    const updateData: Record<string, any> = {}
    if (data.branchId !== undefined) updateData.sucursal_id = data.branchId
    if (data.nombre !== undefined) updateData.nombre = data.nombre
    if (data.slug !== undefined) updateData.slug = data.slug
    if (data.orden !== undefined) updateData.orden = data.orden

    const { error } = await supabase
        .from("categorias")
        .update(updateData)
        .eq("id", id)

    if (error) return { error: error.message }

    revalidatePath("/admin/categories")
    revalidatePath("/admin/products")
    return { success: true }
}

export async function deleteCategory(id: string): ActionResult {
    const supabase = await createClient()
    const existingBranchId = await getExistingBranchForCatalogRow("categorias", id)
    if (!existingBranchId) return { error: "Categoria no encontrada" }

    const access = await assertBranchAccess(existingBranchId)
    if ("error" in access) return access

    const { error } = await supabase
        .from("categorias")
        .delete()
        .eq("id", id)

    if (error) return { error: error.message }

    revalidatePath("/admin/categories")
    revalidatePath("/admin/products")
    return { success: true }
}

// ─── Modifier Groups ──────────────────────────────────────────

export async function createModifierGroup(data: {
    branchId: string
    nombre: string
    required: boolean
    minSel?: number
    maxSel: number
    orden?: number
    options: { nombre: string; precioExtra: number; orden?: number }[]
    productoIds?: string[]
}): ActionResult<{ id?: string }> {
    const supabase = await createClient()

    const access = await assertBranchAccess(data.branchId)
    if ("error" in access) return access

    if (data.productoIds && data.productoIds.length > 0) {
        const { data: products, error: productsError } = await supabase
            .from("productos")
            .select("id, sucursal_id")
            .in("id", data.productoIds)

        if (productsError) return { error: productsError.message }
        if (!products || products.length !== data.productoIds.length) {
            return { error: "Hay productos no encontrados" }
        }
        if (products.some((product) => product.sucursal_id !== data.branchId)) {
            return { error: "Los productos deben ser de la misma sucursal" }
        }
    }

    const { data: group, error: gErr } = await supabase
        .from("modifier_groups")
        .insert({
            sucursal_id: data.branchId,
            nombre: data.nombre,
            required: data.required,
            min_sel: data.minSel || 0,
            max_sel: data.maxSel,
            orden: data.orden || 0,
        })
        .select("id")
        .single()

    if (gErr) return { error: gErr.message }

    // Insert options
    if (data.options.length > 0) {
        const opts = data.options.map((o, i) => ({
            group_id: group.id,
            nombre: o.nombre,
            precio_extra: o.precioExtra,
            orden: o.orden ?? i,
        }))
        await supabase.from("modifier_options").insert(opts)
    }

    // Link to products
    if (data.productoIds && data.productoIds.length > 0) {
        const links = data.productoIds.map((pid) => ({
            producto_id: pid,
            group_id: group.id,
        }))
        await supabase.from("producto_modifier_groups").insert(links)
    }

    revalidatePath("/admin/modifiers")
    return { success: true, id: group.id }
}

export async function updateModifierGroup(
    id: string,
    data: {
        branchId?: string
        nombre?: string
        required?: boolean
        minSel?: number
        maxSel?: number
        options?: { id?: string; nombre: string; precioExtra: number; orden?: number }[]
    }
): ActionResult {
    const supabase = await createClient()
    const existingBranchId = await getExistingBranchForCatalogRow("modifier_groups", id)
    if (!existingBranchId) return { error: "Grupo no encontrado" }

    const targetBranchId = data.branchId || existingBranchId
    const access = await assertBranchAccess(targetBranchId)
    if ("error" in access) return access

    const updateData: Record<string, any> = {}
    if (data.branchId !== undefined) updateData.sucursal_id = data.branchId
    if (data.nombre !== undefined) updateData.nombre = data.nombre
    if (data.required !== undefined) updateData.required = data.required
    if (data.minSel !== undefined) updateData.min_sel = data.minSel
    if (data.maxSel !== undefined) updateData.max_sel = data.maxSel

    if (Object.keys(updateData).length > 0) {
        const { error } = await supabase
            .from("modifier_groups")
            .update(updateData)
            .eq("id", id)
        if (error) return { error: error.message }
    }

    // Replace options: delete existing, insert new
    if (data.options) {
        await supabase.from("modifier_options").delete().eq("group_id", id)
        if (data.options.length > 0) {
            const opts = data.options.map((o, i) => ({
                group_id: id,
                nombre: o.nombre,
                precio_extra: o.precioExtra,
                orden: o.orden ?? i,
            }))
            await supabase.from("modifier_options").insert(opts)
        }
    }

    revalidatePath("/admin/modifiers")
    return { success: true }
}

// ─── Branches ──────────────────────────────────────────────────

export async function createBranch(data: {
    nombre: string
    slug?: string
    direccion?: string
    logoUrl?: string
    bannerUrl?: string
    brandColor?: string
    accentColor?: string
    heroTitle?: string
    heroSubtitle?: string
    lat?: number
    lng?: number
    isOpen?: boolean
}): ActionResult {
    const supabase = await createClient()
    const scope = await getAdminScope()
    if (!scope) return { error: "Sesion requerida" }
    if (!scope.isGlobalAdmin) return { error: "Solo un admin global puede crear sucursales" }

    const { error } = await supabase.from("sucursales").insert({
        nombre: data.nombre,
        slug: data.slug || slugify(data.nombre),
        direccion: data.direccion || "",
        logo_url: data.logoUrl || "",
        banner_url: data.bannerUrl || "",
        brand_color: data.brandColor || "#E86303",
        accent_color: data.accentColor || "#F97316",
        hero_title: data.heroTitle || "",
        hero_subtitle: data.heroSubtitle || "",
        lat: data.lat,
        lng: data.lng,
        is_open: data.isOpen ?? true,
    })

    if (error) return { error: error.message }

    revalidatePath("/admin/branches")
    return { success: true }
}

export async function updateBranch(
    id: string,
    data: {
        nombre?: string
        slug?: string
        direccion?: string
        logoUrl?: string
        bannerUrl?: string
        brandColor?: string
        accentColor?: string
        heroTitle?: string
        heroSubtitle?: string
        lat?: number | null
        lng?: number | null
        isOpen?: boolean
    }
): ActionResult {
    const supabase = await createClient()
    const access = await assertBranchAccess(id)
    if ("error" in access) return access

    const updateData: Record<string, any> = {}
    if (data.nombre !== undefined) updateData.nombre = data.nombre
    if (data.slug !== undefined) updateData.slug = data.slug
    if (data.slug === undefined && data.nombre !== undefined) updateData.slug = slugify(data.nombre)
    if (data.direccion !== undefined) updateData.direccion = data.direccion
    if (data.logoUrl !== undefined) updateData.logo_url = data.logoUrl
    if (data.bannerUrl !== undefined) updateData.banner_url = data.bannerUrl
    if (data.brandColor !== undefined) updateData.brand_color = data.brandColor
    if (data.accentColor !== undefined) updateData.accent_color = data.accentColor
    if (data.heroTitle !== undefined) updateData.hero_title = data.heroTitle
    if (data.heroSubtitle !== undefined) updateData.hero_subtitle = data.heroSubtitle
    if (data.lat !== undefined) updateData.lat = data.lat
    if (data.lng !== undefined) updateData.lng = data.lng
    if (data.isOpen !== undefined) updateData.is_open = data.isOpen

    const { error } = await supabase
        .from("sucursales")
        .update(updateData)
        .eq("id", id)

    if (error) return { error: error.message }

    revalidatePath("/admin/branches")
    return { success: true }
}

export async function toggleBranchOpen(id: string): ActionResult {
    const supabase = await createClient()
    const access = await assertBranchAccess(id)
    if ("error" in access) return access

    const { data: branch } = await supabase
        .from("sucursales")
        .select("is_open")
        .eq("id", id)
        .single()

    if (!branch) return { error: "Sucursal no encontrada" }

    const { error } = await supabase
        .from("sucursales")
        .update({ is_open: !branch.is_open })
        .eq("id", id)

    if (error) return { error: error.message }

    revalidatePath("/admin/branches")
    return { success: true }
}

// ─── Admin Users ────────────────────────────────────────────────

export async function createAdminUser(data: {
    email: string
    password: string
    name?: string
    role: AdminRole
    branchId?: string | null
}): ActionResult<{ userId?: string }> {
    const globalAccess = await requireGlobalAdmin()
    if ("error" in globalAccess) return globalAccess

    const email = data.email.trim().toLowerCase()
    if (!email) return { error: "Ingresa un email" }
    if (!data.password || data.password.length < 8) {
        return { error: "La contrasena debe tener al menos 8 caracteres" }
    }
    if (!isAdminRole(data.role)) return { error: "Rol invalido" }

    const assignmentError = validateAdminAssignment(data.role, data.branchId)
    if (assignmentError) return { error: assignmentError }

    const adminSupabase = createAdminClient()
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
        email,
        password: data.password,
        email_confirm: true,
        user_metadata: {
            name: data.name?.trim() || email,
        },
    })

    if (authError || !authData.user) {
        return { error: authError?.message || "No se pudo crear el usuario" }
    }

    const { error: adminError } = await adminSupabase
        .from("admin_users")
        .insert({
            user_id: authData.user.id,
            role: data.role,
            sucursal_id: data.role === "operator" ? data.branchId : null,
        })

    if (adminError) {
        await adminSupabase.auth.admin.deleteUser(authData.user.id)
        return { error: adminError.message }
    }

    revalidatePath("/admin/users")
    return { success: true, userId: authData.user.id }
}

export async function updateAdminUserAccess(
    userId: string,
    data: {
        role: AdminRole
        branchId?: string | null
        name?: string
    }
): ActionResult {
    const globalAccess = await requireGlobalAdmin()
    if ("error" in globalAccess) return globalAccess

    if (!isAdminRole(data.role)) return { error: "Rol invalido" }

    const assignmentError = validateAdminAssignment(data.role, data.branchId)
    if (assignmentError) return { error: assignmentError }

    if (globalAccess.scope.userId === userId && data.role === "operator") {
        return { error: "No puedes convertir tu propio usuario global en operador" }
    }

    const adminSupabase = createAdminClient()
    const nextBranchId = data.role === "operator" ? data.branchId : null

    const { error } = await adminSupabase
        .from("admin_users")
        .update({
            role: data.role,
            sucursal_id: nextBranchId,
        })
        .eq("user_id", userId)

    if (error) return { error: error.message }

    if (data.name) {
        const { error: authError } = await adminSupabase.auth.admin.updateUserById(userId, {
            user_metadata: { name: data.name.trim() },
        })

        if (authError) return { error: authError.message }
    }

    revalidatePath("/admin/users")
    return { success: true }
}

export async function removeAdminUserAccess(userId: string): ActionResult {
    const globalAccess = await requireGlobalAdmin()
    if ("error" in globalAccess) return globalAccess

    if (globalAccess.scope.userId === userId) {
        return { error: "No puedes quitar tu propio acceso" }
    }

    const adminSupabase = createAdminClient()
    const { error } = await adminSupabase
        .from("admin_users")
        .delete()
        .eq("user_id", userId)

    if (error) return { error: error.message }

    revalidatePath("/admin/users")
    return { success: true }
}

// ═══════════════════════════════════════════════════════════════
// NUEVAS FEATURES DE NEGOCIO
// ═══════════════════════════════════════════════════════════════

// ─── Coupons ───────────────────────────────────────────────────

export async function validateCoupon(code: string, cartTotal: number) {
    const supabase = await createClient()

    const { data: coupon, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("code", code.toUpperCase())
        .eq("is_active", true)
        .single()

    if (error || !coupon) {
        return { error: "Código de cupón inválido" }
    }

    // Check dates
    if (new Date(coupon.valid_from) > new Date()) {
        return { error: "Este cupón aún no está disponible" }
    }
    if (coupon.valid_until && new Date(coupon.valid_until) < new Date()) {
        return { error: "Este cupón ha expirado" }
    }

    // Check minimum order
    if (cartTotal < (coupon.min_order_amount || 0)) {
        return { error: `Mínimo de compra: ${formatPrice(Number(coupon.min_order_amount))}` }
    }

    // Check usage limit
    if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
        return { error: "Este cupón ha alcanzado su límite de uso" }
    }

    // Calculate discount
    let discount = 0
    if (coupon.discount_type === "percentage") {
        discount = cartTotal * (coupon.discount_value / 100)
        if (coupon.max_discount_amount && discount > coupon.max_discount_amount) {
            discount = coupon.max_discount_amount
        }
    } else {
        discount = coupon.discount_value
    }

    return {
        valid: true,
        discount,
        discountType: coupon.discount_type,
        discountValue: coupon.discount_value,
        code: coupon.code,
    }
}

export async function createCoupon(data: {
    code: string
    description?: string
    discountType: "percentage" | "fixed_amount"
    discountValue: number
    minOrderAmount?: number
    maxDiscountAmount?: number
    usageLimit?: number
    perUserLimit?: number
    validFrom: string
    validUntil?: string
}) {
    const supabase = await createClient()

    const { error } = await supabase.from("coupons").insert({
        code: data.code.toUpperCase(),
        description: data.description,
        discount_type: data.discountType,
        discount_value: data.discountValue,
        min_order_amount: data.minOrderAmount || 0,
        max_discount_amount: data.maxDiscountAmount,
        usage_limit: data.usageLimit,
        per_user_limit: data.perUserLimit || 1,
        valid_from: data.validFrom,
        valid_until: data.validUntil,
    })

    if (error) return { error: error.message }

    revalidatePath("/admin/coupons")
    return { success: true }
}

export async function updateCoupon(
    id: string,
    data: {
        description?: string
        discountType?: "percentage" | "fixed_amount"
        discountValue?: number
        minOrderAmount?: number
        maxDiscountAmount?: number
        usageLimit?: number
        perUserLimit?: number
        validFrom?: string
        validUntil?: string
        isActive?: boolean
    }
) {
    const supabase = await createClient()

    const updateData: Record<string, any> = {}
    if (data.description !== undefined) updateData.description = data.description
    if (data.discountType !== undefined) updateData.discount_type = data.discountType
    if (data.discountValue !== undefined) updateData.discount_value = data.discountValue
    if (data.minOrderAmount !== undefined) updateData.min_order_amount = data.minOrderAmount
    if (data.maxDiscountAmount !== undefined) updateData.max_discount_amount = data.maxDiscountAmount
    if (data.usageLimit !== undefined) updateData.usage_limit = data.usageLimit
    if (data.perUserLimit !== undefined) updateData.per_user_limit = data.perUserLimit
    if (data.validFrom !== undefined) updateData.valid_from = data.validFrom
    if (data.validUntil !== undefined) updateData.valid_until = data.validUntil
    if (data.isActive !== undefined) updateData.is_active = data.isActive

    const { error } = await supabase
        .from("coupons")
        .update(updateData)
        .eq("id", id)

    if (error) return { error: error.message }

    revalidatePath("/admin/coupons")
    return { success: true }
}

export async function deleteCoupon(id: string) {
    const supabase = await createClient()

    const { error } = await supabase.from("coupons").delete().eq("id", id)

    if (error) return { error: error.message }

    revalidatePath("/admin/coupons")
    return { success: true }
}

// ─── Delivery Zones ────────────────────────────────────────────

export async function createDeliveryZone(data: {
    branchId: string
    name: string
    color?: string
    coordinates: { lat: number; lng: number }[]
    deliveryFee: number
    minOrderAmount?: number
    estimatedTimeMin?: number
}): ActionResult {
    const supabase = await createClient()
    const access = await assertBranchAccess(data.branchId)
    if ("error" in access) return access

    const { error } = await supabase.from("delivery_zones").insert({
        sucursal_id: data.branchId,
        name: data.name,
        color: data.color || "#3b82f6",
        coordinates: data.coordinates,
        delivery_fee: data.deliveryFee,
        min_order_amount: data.minOrderAmount || 0,
        estimated_time_min: data.estimatedTimeMin,
    })

    if (error) return { error: error.message }

    revalidatePath("/admin/delivery-zones")
    return { success: true }
}

export async function createDeliveryZones(
    zones: {
        branchId: string
        name: string
        color?: string
        coordinates: { lat: number; lng: number }[]
        deliveryFee: number
        minOrderAmount?: number
        estimatedTimeMin?: number
    }[]
): ActionResult {
    const supabase = await createClient()

    if (zones.length === 0) return { error: "No hay zonas para crear" }
    const scope = await getAdminScope()
    if (!scope) return { error: "Sesion requerida" }
    if (!scope.isGlobalAdmin && zones.some((zone) => zone.branchId !== scope.branchId)) {
        return { error: "No tienes acceso a todas las sucursales seleccionadas" }
    }

    const { error } = await supabase.from("delivery_zones").insert(
        zones.map((zone) => ({
            sucursal_id: zone.branchId,
            name: zone.name,
            color: zone.color || "#3b82f6",
            coordinates: zone.coordinates,
            delivery_fee: zone.deliveryFee,
            min_order_amount: zone.minOrderAmount || 0,
            estimated_time_min: zone.estimatedTimeMin,
        }))
    )

    if (error) return { error: error.message }

    revalidatePath("/admin/delivery-zones")
    revalidatePath("/admin/branches")
    return { success: true }
}

export async function updateDeliveryZone(
    id: string,
    data: {
        name?: string
        color?: string
        coordinates?: { lat: number; lng: number }[]
        deliveryFee?: number
        minOrderAmount?: number
        estimatedTimeMin?: number
        isActive?: boolean
    }
): ActionResult {
    const supabase = await createClient()
    const { data: existingZone } = await supabase
        .from("delivery_zones")
        .select("sucursal_id")
        .eq("id", id)
        .single()

    if (!existingZone) return { error: "Zona no encontrada" }

    const access = await assertBranchAccess(existingZone.sucursal_id)
    if ("error" in access) return access

    const updateData: Record<string, any> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.color !== undefined) updateData.color = data.color
    if (data.coordinates !== undefined) updateData.coordinates = data.coordinates
    if (data.deliveryFee !== undefined) updateData.delivery_fee = data.deliveryFee
    if (data.minOrderAmount !== undefined) updateData.min_order_amount = data.minOrderAmount
    if (data.estimatedTimeMin !== undefined) updateData.estimated_time_min = data.estimatedTimeMin
    if (data.isActive !== undefined) updateData.is_active = data.isActive

    const { error } = await supabase
        .from("delivery_zones")
        .update(updateData)
        .eq("id", id)

    if (error) return { error: error.message }

    revalidatePath("/admin/delivery-zones")
    return { success: true }
}

export async function deleteDeliveryZone(id: string): ActionResult {
    const supabase = await createClient()
    const { data: existingZone } = await supabase
        .from("delivery_zones")
        .select("sucursal_id")
        .eq("id", id)
        .single()

    if (!existingZone) return { error: "Zona no encontrada" }

    const access = await assertBranchAccess(existingZone.sucursal_id)
    if ("error" in access) return access

    const { error } = await supabase.from("delivery_zones").delete().eq("id", id)

    if (error) return { error: error.message }

    revalidatePath("/admin/delivery-zones")
    return { success: true }
}

// ─── Driver Login (bypasses RLS for unauthenticated drivers) ──

export async function driverLogin(phone: string) {
    const normalizedPhone = normalizePhone(phone)

    if (!normalizedPhone) {
        return { error: "Ingresa tu número de teléfono" }
    }

    const supabase = createAdminClient()

    const { data: drivers, error } = await supabase
        .from("drivers")
        .select("id, name, phone")
        .eq("is_active", true)

    if (error) {
        return { error: "Error al validar repartidor" }
    }

    const driver = drivers?.find((item) => normalizePhone(item.phone || "") === normalizedPhone)

    if (!driver) {
        return { error: "Número no registrado o inactivo" }
    }

    return { driver: { id: driver.id, name: driver.name } }
}

// ─── Drivers ───────────────────────────────────────────────────

export async function createDriver(data: {
    name: string
    phone: string
    email?: string
    vehicleType?: "motorcycle" | "bicycle" | "car"
    vehiclePlate?: string
}) {
    const supabase = await createClient()

    const { error } = await supabase.from("drivers").insert({
        name: data.name,
        phone: data.phone,
        email: data.email,
        vehicle_type: data.vehicleType,
        vehicle_plate: data.vehiclePlate,
    })

    if (error) return { error: error.message }

    revalidatePath("/admin/drivers")
    return { success: true }
}

export async function updateDriver(
    id: string,
    data: {
        name?: string
        phone?: string
        email?: string
        vehicleType?: "motorcycle" | "bicycle" | "car"
        vehiclePlate?: string
        isActive?: boolean
        isAvailable?: boolean
    }
) {
    const supabase = await createClient()

    const updateData: Record<string, any> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.phone !== undefined) updateData.phone = data.phone
    if (data.email !== undefined) updateData.email = data.email
    if (data.vehicleType !== undefined) updateData.vehicle_type = data.vehicleType
    if (data.vehiclePlate !== undefined) updateData.vehicle_plate = data.vehiclePlate
    if (data.isActive !== undefined) updateData.is_active = data.isActive
    if (data.isAvailable !== undefined) updateData.is_available = data.isAvailable

    const { error } = await supabase
        .from("drivers")
        .update(updateData)
        .eq("id", id)

    if (error) return { error: error.message }

    revalidatePath("/admin/drivers")
    return { success: true }
}

export async function deleteDriver(id: string) {
    const supabase = await createClient()

    const { error } = await supabase.from("drivers").delete().eq("id", id)

    if (error) return { error: error.message }

    revalidatePath("/admin/drivers")
    return { success: true }
}

export async function updateDriverLocation(
    driverId: string,
    lat: number,
    lng: number,
    extra?: {
        accuracy?: number
        speed?: number | null
        heading?: number | null
        altitude?: number | null
    }
) {
    const supabase = createAdminClient()
    const now = new Date().toISOString()

    // Update current_location on drivers (includes accuracy for UI indicators)
    const { data, error } = await supabase
        .from("drivers")
        .update({
            current_location: {
                lat,
                lng,
                accuracy: extra?.accuracy ?? null,
                heading: extra?.heading ?? null,
                speed: extra?.speed ?? null,
                updated_at: now,
            },
        })
        .eq("id", driverId)
        .select("id")

    if (error) return { error: error.message }
    if (!data || data.length === 0) return { error: "Repartidor no encontrado" }

    // Insert into location history for tracking analytics
    // Fire-and-forget — don't block the response
    supabase
        .from("driver_location_history")
        .insert({
            driver_id: driverId,
            lat,
            lng,
            accuracy: extra?.accuracy ?? null,
            speed: extra?.speed != null ? extra.speed * 3.6 : null, // m/s → km/h
            heading: extra?.heading ?? null,
        })
        .then(({ error: histErr }) => {
            if (histErr) console.error("Error inserting location history:", histErr.message)
        })

    return { success: true }
}

// ─── Upsell Rules ──────────────────────────────────────────────

export async function createUpsellRule(data: {
    branchId: string
    name: string
    triggerProductIds?: string[]
    triggerCategoryIds?: string[]
    suggestedProductIds: string[]
    message?: string
    discountPercentage?: number
    priority?: number
}): ActionResult {
    const supabase = await createClient()

    const access = await assertBranchAccess(data.branchId)
    if ("error" in access) return access

    const relatedProductIds = Array.from(new Set([
        ...(data.triggerProductIds || []),
        ...data.suggestedProductIds,
    ]))

    if (relatedProductIds.length > 0) {
        const { data: products, error: productsError } = await supabase
            .from("productos")
            .select("id, sucursal_id")
            .in("id", relatedProductIds)

        if (productsError) return { error: productsError.message }
        if (!products || products.length !== relatedProductIds.length) {
            return { error: "Hay productos no encontrados" }
        }
        if (products.some((product) => product.sucursal_id !== data.branchId)) {
            return { error: "Las sugerencias deben usar productos de la misma sucursal" }
        }
    }

    const { error } = await supabase.from("upsell_rules").insert({
        sucursal_id: data.branchId,
        name: data.name,
        trigger_product_ids: data.triggerProductIds || [],
        trigger_category_ids: data.triggerCategoryIds || [],
        suggested_product_ids: data.suggestedProductIds,
        message: data.message || "¿Te gustaría agregar esto?",
        discount_percentage: data.discountPercentage || 0,
        priority: data.priority || 0,
    })

    if (error) return { error: error.message }

    revalidatePath("/admin/upsells")
    return { success: true }
}

export async function updateUpsellRule(
    id: string,
    data: {
        branchId?: string
        name?: string
        triggerProductIds?: string[]
        triggerCategoryIds?: string[]
        suggestedProductIds?: string[]
        message?: string
        discountPercentage?: number
        priority?: number
        isActive?: boolean
    }
): ActionResult {
    const supabase = await createClient()
    const existingBranchId = await getExistingBranchForCatalogRow("upsell_rules", id)
    if (!existingBranchId) return { error: "Regla no encontrada" }

    const targetBranchId = data.branchId || existingBranchId
    const access = await assertBranchAccess(targetBranchId)
    if ("error" in access) return access

    const relatedProductIds = Array.from(new Set([
        ...(data.triggerProductIds || []),
        ...(data.suggestedProductIds || []),
    ]))

    if (relatedProductIds.length > 0) {
        const { data: products, error: productsError } = await supabase
            .from("productos")
            .select("id, sucursal_id")
            .in("id", relatedProductIds)

        if (productsError) return { error: productsError.message }
        if (!products || products.length !== relatedProductIds.length) {
            return { error: "Hay productos no encontrados" }
        }
        if (products.some((product) => product.sucursal_id !== targetBranchId)) {
            return { error: "Las sugerencias deben usar productos de la misma sucursal" }
        }
    }

    const updateData: Record<string, any> = {}
    if (data.branchId !== undefined) updateData.sucursal_id = data.branchId
    if (data.name !== undefined) updateData.name = data.name
    if (data.triggerProductIds !== undefined) updateData.trigger_product_ids = data.triggerProductIds
    if (data.triggerCategoryIds !== undefined) updateData.trigger_category_ids = data.triggerCategoryIds
    if (data.suggestedProductIds !== undefined) updateData.suggested_product_ids = data.suggestedProductIds
    if (data.message !== undefined) updateData.message = data.message
    if (data.discountPercentage !== undefined) updateData.discount_percentage = data.discountPercentage
    if (data.priority !== undefined) updateData.priority = data.priority
    if (data.isActive !== undefined) updateData.is_active = data.isActive

    const { error } = await supabase
        .from("upsell_rules")
        .update(updateData)
        .eq("id", id)

    if (error) return { error: error.message }

    revalidatePath("/admin/upsells")
    return { success: true }
}

export async function deleteUpsellRule(id: string): ActionResult {
    const supabase = await createClient()
    const existingBranchId = await getExistingBranchForCatalogRow("upsell_rules", id)
    if (!existingBranchId) return { error: "Regla no encontrada" }

    const access = await assertBranchAccess(existingBranchId)
    if ("error" in access) return access

    const { error } = await supabase.from("upsell_rules").delete().eq("id", id)

    if (error) return { error: error.message }

    revalidatePath("/admin/upsells")
    return { success: true }
}
