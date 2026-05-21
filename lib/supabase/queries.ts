import { createClient } from "./server"
import type { Category, Product, ModifierGroup, ModifierOption, Order, Branch, CartItem, CartItemModifier, Coupon, DeliveryZone, Driver, UpsellRule } from "../types"

// ─── Catalog Queries ───────────────────────────────────────────

export async function getCategories(): Promise<Category[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from("categorias")
        .select("*")
        .order("orden", { ascending: true })

    if (error) throw error
    if (!data) return []

    return data.map((row) => ({
        id: row.id,
        name: row.nombre,
        slug: row.slug,
        order: row.orden,
    }))
}

export async function getProducts(): Promise<Product[]> {
    const supabase = await createClient()

    // Get products
    const { data: productos, error: pErr } = await supabase
        .from("productos")
        .select("*")
        .eq("activo", true)
        .order("created_at", { ascending: true })

    if (pErr) throw pErr
    if (!productos) return []

    // Get modifier group links
    const { data: links, error: lErr } = await supabase
        .from("producto_modifier_groups")
        .select("*")

    if (lErr) throw lErr

    const linksByProduct = new Map<string, string[]>()
    for (const link of links || []) {
        const arr = linksByProduct.get(link.producto_id) || []
        arr.push(link.group_id)
        linksByProduct.set(link.producto_id, arr)
    }

    return productos.map((row) => ({
        id: row.id,
        name: row.nombre,
        description: row.descripcion || "",
        price: parseFloat(row.precio),
        image: (row.images && row.images.length > 0) ? row.images[0] : (row.image_url || "/images/classic-burger.jpg"),
        images: row.images && row.images.length > 0 ? row.images : (row.image_url ? [row.image_url] : []),
        categoryId: row.categoria_id,
        active: row.activo,
        modifierGroups: linksByProduct.get(row.id) || [],
    }))
}

export async function getAllProducts(): Promise<Product[]> {
    const supabase = await createClient()

    const { data: productos, error: pErr } = await supabase
        .from("productos")
        .select("*")
        .order("created_at", { ascending: true })

    if (pErr) throw pErr
    if (!productos) return []

    const { data: links, error: lErr } = await supabase
        .from("producto_modifier_groups")
        .select("*")

    if (lErr) throw lErr

    const linksByProduct = new Map<string, string[]>()
    for (const link of links || []) {
        const arr = linksByProduct.get(link.producto_id) || []
        arr.push(link.group_id)
        linksByProduct.set(link.producto_id, arr)
    }

    return productos.map((row) => ({
        id: row.id,
        name: row.nombre,
        description: row.descripcion || "",
        price: parseFloat(row.precio),
        image: (row.images && row.images.length > 0) ? row.images[0] : (row.image_url || "/images/classic-burger.jpg"),
        images: row.images && row.images.length > 0 ? row.images : (row.image_url ? [row.image_url] : []),
        categoryId: row.categoria_id,
        active: row.activo,
        modifierGroups: linksByProduct.get(row.id) || [],
    }))
}

export async function getModifierGroups(): Promise<ModifierGroup[]> {
    const supabase = await createClient()

    const { data: groups, error: gErr } = await supabase
        .from("modifier_groups")
        .select("*")
        .order("orden", { ascending: true })

    if (gErr) throw gErr
    if (!groups) return []

    const { data: options, error: oErr } = await supabase
        .from("modifier_options")
        .select("*")
        .eq("activo", true)
        .order("orden", { ascending: true })

    if (oErr) throw oErr

    const optionsByGroup = new Map<string, ModifierOption[]>()
    for (const opt of options || []) {
        const arr = optionsByGroup.get(opt.group_id) || []
        arr.push({
            id: opt.id,
            name: opt.nombre,
            price: parseFloat(opt.precio_extra),
        })
        optionsByGroup.set(opt.group_id, arr)
    }

    return groups.map((row) => ({
        id: row.id,
        name: row.nombre,
        required: row.required,
        maxSelections: row.max_sel,
        options: optionsByGroup.get(row.id) || [],
    }))
}

export async function getBranches(): Promise<Branch[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from("sucursales")
        .select("*")
        .order("created_at", { ascending: true })

    if (error) throw error
    if (!data) return []

    return data.map((row) => ({
        id: row.id,
        name: row.nombre,
        address: row.direccion || "",
        lat: row.lat ? parseFloat(row.lat) : null,
        lng: row.lng ? parseFloat(row.lng) : null,
        isOpen: row.is_open,
    }))
}

// ─── Order Queries ─────────────────────────────────────────────

function mapOrderItems(items: any[]): CartItem[] {
    return items.map((item) => ({
        id: item.id,
        productId: item.producto_id || "",
        name: item.nombre_snapshot,
        image: "/images/classic-burger.jpg",
        price: parseFloat(item.precio_unit),
        quantity: item.qty,
        modifiers: (item.modifiers_json || []) as CartItemModifier[],
    }))
}

function mapOrder(row: any, items: CartItem[]): Order {
    return {
        id: row.id,
        orderNumber: row.order_number,
        trackingToken: row.public_tracking_token,
        customerName: row.customer_name,
        customerPhone: row.customer_phone || "",
        address: row.address_text || "",
        deliveryNotes: row.notes || "",
        deliveryMethod: row.fulfillment_type,
        paymentMethod: row.payment_method,
        items,
        subtotal: parseFloat(row.subtotal),
        deliveryFee: parseFloat(row.delivery_fee),
        total: parseFloat(row.total),
        status: row.status,
        createdAt: row.created_at,
        acceptedAt: row.accepted_at,
        preparingAt: row.preparing_at,
        readyAt: row.ready_at,
        deliveredAt: row.delivered_at,
        cancelledAt: row.cancelled_at,
        branchId: row.sucursal_id || "",
        addressLat: row.address_lat != null ? parseFloat(row.address_lat) : null,
        addressLng: row.address_lng != null ? parseFloat(row.address_lng) : null,
        driverId: row.driver_id || null,
        deliveryZoneId: row.delivery_zone_id || null,
    }
}

export async function getOrders(): Promise<Order[]> {
    const supabase = await createClient()

    const { data: orders, error: oErr } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })

    if (oErr) throw oErr
    if (!orders || orders.length === 0) return []

    const orderIds = orders.map((o) => o.id)
    const { data: allItems, error: iErr } = await supabase
        .from("order_items")
        .select("*")
        .in("order_id", orderIds)

    if (iErr) throw iErr

    const itemsByOrder = new Map<string, any[]>()
    for (const item of allItems || []) {
        const arr = itemsByOrder.get(item.order_id) || []
        arr.push(item)
        itemsByOrder.set(item.order_id, arr)
    }

    return orders.map((row) => {
        const rawItems = itemsByOrder.get(row.id) || []
        return mapOrder(row, mapOrderItems(rawItems))
    })
}

export async function getOrdersByStatus(statuses: string[]): Promise<Order[]> {
    const supabase = await createClient()

    const { data: orders, error: oErr } = await supabase
        .from("orders")
        .select("*")
        .in("status", statuses)
        .order("created_at", { ascending: true })

    if (oErr) throw oErr
    if (!orders || orders.length === 0) return []

    const orderIds = orders.map((o) => o.id)
    const { data: allItems, error: iErr } = await supabase
        .from("order_items")
        .select("*")
        .in("order_id", orderIds)

    if (iErr) throw iErr

    const itemsByOrder = new Map<string, any[]>()
    for (const item of allItems || []) {
        const arr = itemsByOrder.get(item.order_id) || []
        arr.push(item)
        itemsByOrder.set(item.order_id, arr)
    }

    return orders.map((row) => {
        const rawItems = itemsByOrder.get(row.id) || []
        return mapOrder(row, mapOrderItems(rawItems))
    })
}

export async function getOrderByToken(token: string): Promise<Order | null> {
    const supabase = await createClient()

    // Use SECURITY DEFINER functions that bypass RLS for public order tracking
    const { data: orderData, error: orderError } = await supabase
        .rpc("get_order_by_token", { p_token: token })

    if (orderError || !orderData || (Array.isArray(orderData) && orderData.length === 0)) {
        return null
    }

    const row = Array.isArray(orderData) ? orderData[0] : orderData
    if (!row) return null

    const { data: itemsData } = await supabase
        .rpc("get_order_items_by_token", { p_token: token })

    return mapOrder(row, mapOrderItems(itemsData || []))
}

export async function getOrderById(id: string): Promise<Order | null> {
    const supabase = await createClient()

    const { data: order, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", id)
        .single()

    if (error || !order) return null

    const { data: items } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", id)

    return mapOrder(order, mapOrderItems(items || []))
}

// ═══════════════════════════════════════════════════════════════
// NUEVAS QUERIES DE NEGOCIO
// ═══════════════════════════════════════════════════════════════

// ─── Coupons ───────────────────────────────────────────────────

export async function getCoupons(): Promise<Coupon[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .order("created_at", { ascending: false })

    if (error) throw error
    if (!data) return []

    return data.map((row) => ({
        id: row.id,
        code: row.code,
        description: row.description,
        discountType: row.discount_type,
        discountValue: parseFloat(row.discount_value),
        minOrderAmount: parseFloat(row.min_order_amount || 0),
        maxDiscountAmount: row.max_discount_amount ? parseFloat(row.max_discount_amount) : undefined,
        usageLimit: row.usage_limit,
        usageCount: row.usage_count || 0,
        perUserLimit: row.per_user_limit || 1,
        validFrom: row.valid_from,
        validUntil: row.valid_until,
        applicableTo: row.applicable_to || [],
        excludedProducts: row.excluded_products || [],
        isActive: row.is_active,
    }))
}

// ─── Delivery Zones ────────────────────────────────────────────

export async function getDeliveryZones(branchId?: string): Promise<DeliveryZone[]> {
    const supabase = await createClient()

    let query = supabase
        .from("delivery_zones")
        .select("*")
        .eq("is_active", true)

    if (branchId) {
        query = query.eq("sucursal_id", branchId)
    }

    const { data, error } = await query.order("name", { ascending: true })

    if (error) throw error
    if (!data) return []

    return data.map((row) => ({
        id: row.id,
        branchId: row.sucursal_id,
        name: row.name,
        color: row.color || "#3b82f6",
        coordinates: row.coordinates || [],
        deliveryFee: parseFloat(row.delivery_fee),
        minOrderAmount: parseFloat(row.min_order_amount || 0),
        estimatedTimeMin: row.estimated_time_min,
        isActive: row.is_active,
    }))
}

export async function getAllDeliveryZones(): Promise<DeliveryZone[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from("delivery_zones")
        .select("*")
        .order("name", { ascending: true })

    if (error) throw error
    if (!data) return []

    return data.map((row) => ({
        id: row.id,
        branchId: row.sucursal_id,
        name: row.name,
        color: row.color || "#3b82f6",
        coordinates: row.coordinates || [],
        deliveryFee: parseFloat(row.delivery_fee),
        minOrderAmount: parseFloat(row.min_order_amount || 0),
        estimatedTimeMin: row.estimated_time_min,
        isActive: row.is_active,
    }))
}

// ─── Drivers ───────────────────────────────────────────────────

export async function getDrivers(): Promise<Driver[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from("drivers")
        .select("*")
        .order("name", { ascending: true })

    if (error) throw error
    if (!data) return []

    return data.map((row) => ({
        id: row.id,
        userId: row.user_id,
        name: row.name,
        phone: row.phone,
        email: row.email,
        vehicleType: row.vehicle_type,
        vehiclePlate: row.vehicle_plate,
        isActive: row.is_active,
        isAvailable: row.is_available,
        currentLocation: row.current_location,
    }))
}

export async function getAvailableDrivers(): Promise<Driver[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from("drivers")
        .select("*")
        .eq("is_active", true)
        .eq("is_available", true)
        .order("name", { ascending: true })

    if (error) throw error
    if (!data) return []

    return data.map((row) => ({
        id: row.id,
        userId: row.user_id,
        name: row.name,
        phone: row.phone,
        email: row.email,
        vehicleType: row.vehicle_type,
        vehiclePlate: row.vehicle_plate,
        isActive: row.is_active,
        isAvailable: row.is_available,
        currentLocation: row.current_location,
    }))
}

export async function getDriverByUserId(userId: string): Promise<Driver | null> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from("drivers")
        .select("*")
        .eq("user_id", userId)
        .single()

    if (error || !data) return null

    return {
        id: data.id,
        userId: data.user_id,
        name: data.name,
        phone: data.phone,
        email: data.email,
        vehicleType: data.vehicle_type,
        vehiclePlate: data.vehicle_plate,
        isActive: data.is_active,
        isAvailable: data.is_available,
        currentLocation: data.current_location,
    }
}

export async function getDriverDeliveries(driverId: string): Promise<Order[]> {
    const supabase = await createClient()

    const { data: orders, error: oErr } = await supabase
        .from("orders")
        .select("*")
        .eq("driver_id", driverId)
        .in("status", ["ready", "delivered"])
        .order("driver_assigned_at", { ascending: false })

    if (oErr) throw oErr
    if (!orders || orders.length === 0) return []

    const orderIds = orders.map((o) => o.id)
    const { data: allItems, error: iErr } = await supabase
        .from("order_items")
        .select("*")
        .in("order_id", orderIds)

    if (iErr) throw iErr

    const itemsByOrder = new Map<string, any[]>()
    for (const item of allItems || []) {
        const arr = itemsByOrder.get(item.order_id) || []
        arr.push(item)
        itemsByOrder.set(item.order_id, arr)
    }

    return orders.map((row) => {
        const rawItems = itemsByOrder.get(row.id) || []
        return mapOrder(row, mapOrderItems(rawItems))
    })
}

// ─── Upsells ───────────────────────────────────────────────────

export async function getUpsellRules(): Promise<UpsellRule[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from("upsell_rules")
        .select("*")
        .eq("is_active", true)
        .order("priority", { ascending: false })

    if (error) throw error
    if (!data) return []

    return data.map((row) => ({
        id: row.id,
        name: row.name,
        triggerProductIds: row.trigger_product_ids || [],
        triggerCategoryIds: row.trigger_category_ids || [],
        suggestedProductIds: row.suggested_product_ids || [],
        message: row.message,
        discountPercentage: row.discount_percentage || 0,
        priority: row.priority || 0,
        isActive: row.is_active,
    }))
}

export async function getAllUpsellRules(): Promise<UpsellRule[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from("upsell_rules")
        .select("*")
        .order("priority", { ascending: false })

    if (error) throw error
    if (!data) return []

    return data.map((row) => ({
        id: row.id,
        name: row.name,
        triggerProductIds: row.trigger_product_ids || [],
        triggerCategoryIds: row.trigger_category_ids || [],
        suggestedProductIds: row.suggested_product_ids || [],
        message: row.message,
        discountPercentage: row.discount_percentage || 0,
        priority: row.priority || 0,
        isActive: row.is_active,
    }))
}
