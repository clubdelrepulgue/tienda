import type { CartItem, CartItemModifier, Order } from "./types"
import { DEFAULT_PRODUCT_IMAGE } from "./product-image"

/**
 * Mapeo fila de Postgres → tipos de la app.
 *
 * Vive fuera de `lib/supabase/queries.ts` porque ese módulo importa el cliente
 * de servidor (`next/headers`) y no se puede usar desde un componente cliente.
 * El panel de despacho necesita exactamente este mapeo para aplicar los eventos
 * de Realtime: antes hacía `{ ...order, ...payload.new }`, mezclando las claves
 * snake_case crudas de la base con las camelCase de `Order`. El resultado era
 * que solo se actualizaban los dos campos que el handler copiaba a mano
 * (`status` y `driver_id`); el resto —`ready_at`, `total`, la dirección— entraba
 * como claves basura y la tarjeta seguía mostrando datos viejos hasta el
 * siguiente refetch. Los cronómetros de cada columna, que leen `readyAt`,
 * quedaban congelados.
 */
export function mapOrderItems(items: any[], branchId: string): CartItem[] {
    return items.map((item) => ({
        id: item.id,
        productId: item.producto_id || "",
        branchId,
        name: item.nombre_snapshot,
        image: DEFAULT_PRODUCT_IMAGE,
        price: parseFloat(item.precio_unit),
        quantity: item.qty,
        modifiers: (item.modifiers_json || []) as CartItemModifier[],
        variantName: item.variante_snapshot || undefined,
        note: item.nota || undefined,
    }))
}

export function mapOrder(row: any, items: CartItem[]): Order {
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
        couponCode: row.coupon_code || undefined,
        couponDiscount: row.coupon_discount ? parseFloat(row.coupon_discount) : 0,
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
        orderType: row.order_type || "online",
    }
}
