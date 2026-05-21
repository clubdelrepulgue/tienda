"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import type { CartItem } from "@/lib/types"

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
            delivery_zone_id: formData.deliveryZoneId || null,
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

    const updateData: Record<string, any> = { status: newStatus }
    
    if (driverId) {
        updateData.driver_id = driverId
        updateData.driver_assigned_at = new Date().toISOString()
    }

    const { error } = await supabase
        .from("orders")
        .update(updateData)
        .eq("id", orderId)

    if (error) {
        return { error: error.message }
    }

    revalidatePath("/admin/orders")
    revalidatePath("/admin")
    revalidatePath("/admin/kitchen")
    revalidatePath("/driver/dashboard")
    return { success: true }
}

export async function assignDriver(orderId: string, driverId: string | null) {
    const supabase = await createClient()

    const { error } = await supabase
        .from("orders")
        .update({
            driver_id: driverId,
            driver_assigned_at: driverId ? new Date().toISOString() : null,
        })
        .eq("id", orderId)

    if (error) return { error: error.message }

    revalidatePath("/admin/orders")
    revalidatePath("/driver/dashboard")
    return { success: true }
}

export async function assignDriverBatch(orderIds: string[], driverId: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from("orders")
        .update({
            driver_id: driverId,
            driver_assigned_at: new Date().toISOString(),
        })
        .in("id", orderIds)

    if (error) return { error: error.message }

    revalidatePath("/admin/orders")
    revalidatePath("/driver/dashboard")
    return { success: true }
}

// ─── Products ──────────────────────────────────────────────────

export async function createProduct(data: {
    nombre: string
    descripcion?: string
    precio: number
    imageUrl?: string
    images?: string[]
    categoriaId: string
    activo?: boolean
    modifierGroupIds?: string[]
}) {
    const supabase = await createClient()

    const { data: product, error } = await supabase
        .from("productos")
        .insert({
            nombre: data.nombre,
            descripcion: data.descripcion || "",
            precio: data.precio,
            image_url: data.imageUrl || (data.images && data.images.length > 0 ? data.images[0] : ""),
            images: data.images || [],
            categoria_id: data.categoriaId,
            activo: data.activo ?? true,
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
        categoriaId?: string
        activo?: boolean
        modifierGroupIds?: string[]
    }
) {
    const supabase = await createClient()

    const updateData: Record<string, any> = {}
    if (data.nombre !== undefined) updateData.nombre = data.nombre
    if (data.descripcion !== undefined) updateData.descripcion = data.descripcion
    if (data.precio !== undefined) updateData.precio = data.precio
    if (data.imageUrl !== undefined) updateData.image_url = data.imageUrl
    if (data.images !== undefined) updateData.images = data.images
    if (data.categoriaId !== undefined) updateData.categoria_id = data.categoriaId
    if (data.activo !== undefined) updateData.activo = data.activo

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

    revalidatePath("/admin/products")
    return { success: true }
}

export async function toggleProductActive(id: string) {
    const supabase = await createClient()

    // Get current state
    const { data: product } = await supabase
        .from("productos")
        .select("activo")
        .eq("id", id)
        .single()

    if (!product) return { error: "Product not found" }

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
    nombre: string
    slug: string
    orden?: number
}) {
    const supabase = await createClient()

    const { error } = await supabase.from("categorias").insert({
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
        nombre?: string
        slug?: string
        orden?: number
    }
) {
    const supabase = await createClient()

    const updateData: Record<string, any> = {}
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

export async function deleteCategory(id: string) {
    const supabase = await createClient()

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
    nombre: string
    required: boolean
    minSel?: number
    maxSel: number
    orden?: number
    options: { nombre: string; precioExtra: number; orden?: number }[]
    productoIds?: string[]
}) {
    const supabase = await createClient()

    const { data: group, error: gErr } = await supabase
        .from("modifier_groups")
        .insert({
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
        nombre?: string
        required?: boolean
        minSel?: number
        maxSel?: number
        options?: { id?: string; nombre: string; precioExtra: number; orden?: number }[]
    }
) {
    const supabase = await createClient()

    const updateData: Record<string, any> = {}
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
    direccion?: string
    lat?: number
    lng?: number
    isOpen?: boolean
}) {
    const supabase = await createClient()

    const { error } = await supabase.from("sucursales").insert({
        nombre: data.nombre,
        direccion: data.direccion || "",
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
        direccion?: string
        lat?: number | null
        lng?: number | null
        isOpen?: boolean
    }
) {
    const supabase = await createClient()

    const updateData: Record<string, any> = {}
    if (data.nombre !== undefined) updateData.nombre = data.nombre
    if (data.direccion !== undefined) updateData.direccion = data.direccion
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

export async function toggleBranchOpen(id: string) {
    const supabase = await createClient()

    const { data: branch } = await supabase
        .from("sucursales")
        .select("is_open")
        .eq("id", id)
        .single()

    if (!branch) return { error: "Branch not found" }

    const { error } = await supabase
        .from("sucursales")
        .update({ is_open: !branch.is_open })
        .eq("id", id)

    if (error) return { error: error.message }

    revalidatePath("/admin/branches")
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
        return { error: `Mínimo de compra: $${coupon.min_order_amount}` }
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
}) {
    const supabase = await createClient()

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
) {
    const supabase = await createClient()

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

export async function deleteDeliveryZone(id: string) {
    const supabase = await createClient()

    const { error } = await supabase.from("delivery_zones").delete().eq("id", id)

    if (error) return { error: error.message }

    revalidatePath("/admin/delivery-zones")
    return { success: true }
}

// ─── Driver Login (bypasses RLS for unauthenticated drivers) ──

export async function driverLogin(phone: string) {
    const normalizedPhone = phone.replace(/\D/g, "")

    if (!normalizedPhone) {
        return { error: "Ingresa tu número de teléfono" }
    }

    const supabase = createAdminClient()

    const { data: driver, error } = await supabase
        .from("drivers")
        .select("id, name")
        .eq("phone", normalizedPhone)
        .eq("is_active", true)
        .single()

    if (error || !driver) {
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
    if (!data || data.length === 0) return { error: "Driver not found" }

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
    name: string
    triggerProductIds?: string[]
    triggerCategoryIds?: string[]
    suggestedProductIds: string[]
    message?: string
    discountPercentage?: number
    priority?: number
}) {
    const supabase = await createClient()

    const { error } = await supabase.from("upsell_rules").insert({
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
        name?: string
        triggerProductIds?: string[]
        triggerCategoryIds?: string[]
        suggestedProductIds?: string[]
        message?: string
        discountPercentage?: number
        priority?: number
        isActive?: boolean
    }
) {
    const supabase = await createClient()

    const updateData: Record<string, any> = {}
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

export async function deleteUpsellRule(id: string) {
    const supabase = await createClient()

    const { error } = await supabase.from("upsell_rules").delete().eq("id", id)

    if (error) return { error: error.message }

    revalidatePath("/admin/upsells")
    return { success: true }
}
