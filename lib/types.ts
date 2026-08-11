export interface Category {
  id: string
  branchId: string
  name: string
  slug: string
  order: number
}

export interface ModifierOption {
  id: string
  name: string
  price: number
}

export interface ProductVariant {
  id: string
  name: string
  price: number
  active: boolean
  order: number
}

export interface ModifierGroup {
  id: string
  branchId: string
  name: string
  required: boolean
  maxSelections: number
  options: ModifierOption[]
}

export interface Product {
  id: string
  branchId: string
  name: string
  description: string
  price: number
  image: string
  images: string[]
  categoryId: string
  active: boolean
  modifierGroups: string[] // IDs of modifier groups
  variantGroupLabel: string // label for the variant selector (e.g. "Tamaño", "Carnes")
  variants: ProductVariant[] // size/options; when present, the chosen variant replaces `price`
}

export interface CartItemModifier {
  groupId: string
  groupName: string
  optionId: string
  optionName: string
  price: number
}

export interface CartItem {
  id: string // unique cart item id
  productId: string
  branchId: string
  name: string
  image: string
  price: number // unit price already resolved to the chosen variant (if any)
  quantity: number
  modifiers: CartItemModifier[]
  variantId?: string
  variantName?: string
  note?: string // optional free-text comment for this line
}

export type OrderStatus = "new" | "accepted" | "preparing" | "ready" | "en_route" | "delivered" | "cancelled"

export type DeliveryMethod = "delivery" | "pickup" | "dine_in"

export type PaymentMethod = "mercadopago" | "cash"

export interface Order {
  id: string
  orderNumber?: number
  trackingToken?: string
  customerName: string
  customerPhone: string
  address: string
  deliveryNotes: string
  deliveryMethod: DeliveryMethod
  paymentMethod: PaymentMethod
  items: CartItem[]
  subtotal: number
  deliveryFee: number
  total: number
  couponCode?: string
  couponDiscount?: number
  status: OrderStatus
  createdAt: string
  acceptedAt?: string
  preparingAt?: string
  readyAt?: string
  enRouteAt?: string
  deliveredAt?: string
  cancelledAt?: string
  branchId: string
  addressLat?: number | null
  addressLng?: number | null
  driverId?: string | null
  deliveryZoneId?: string | null
  orderType?: OrderType
}

export interface Branch {
  id: string
  slug: string
  name: string
  address: string
  logoUrl: string
  bannerUrl: string
  brandColor: string
  accentColor: string
  heroTitle: string
  heroSubtitle: string
  lat: number | null
  lng: number | null
  isOpen: boolean
}

// ============================================
// NEW BUSINESS FEATURES
// ============================================

export type OrderType = "online" | "pos" | "phone"

export interface Coupon {
  id: string
  code: string
  description?: string
  discountType: "percentage" | "fixed_amount"
  discountValue: number
  minOrderAmount: number
  maxDiscountAmount?: number
  usageLimit?: number
  usageCount: number
  perUserLimit: number
  validFrom: string
  validUntil?: string
  applicableTo: string[] // product IDs
  excludedProducts: string[] // product IDs
  isActive: boolean
}

export interface DeliveryZone {
  id: string
  branchId: string
  name: string
  color: string
  coordinates: { lat: number; lng: number }[] // polygon
  deliveryFee: number
  minOrderAmount: number
  estimatedTimeMin?: number
  isActive: boolean
}

export interface Driver {
  id: string
  userId?: string
  name: string
  phone: string
  email?: string
  vehicleType?: "motorcycle" | "bicycle" | "car"
  vehiclePlate?: string
  isActive: boolean
  /** Ocupado/libre. NO significa conectado — ver lib/driver-presence.ts */
  isAvailable: boolean
  /** El repartidor entró en turno desde su app (migración 016). */
  isOnShift?: boolean
  shiftStartedAt?: string | null
  /** Último ping recibido: la fuente de verdad de "está conectado". */
  lastSeenAt?: string | null
  currentLocation?: {
    lat: number
    lng: number
    accuracy: number | null
    heading: number | null
    speed: number | null
    updatedAt: string
  }
}

export interface UpsellRule {
  id: string
  branchId: string
  name: string
  triggerProductIds: string[]
  triggerCategoryIds: string[]
  suggestedProductIds: string[]
  message: string
  discountPercentage: number
  priority: number
  isActive: boolean
}

export type AdminRole = "owner" | "admin" | "operator"

export interface AdminScope {
  userId: string
  role: AdminRole
  branchId: string | null
  isGlobalAdmin: boolean
}

export interface AdminUserAccount {
  id: string
  userId: string
  email: string
  name: string
  role: AdminRole
  branchId: string | null
  branchName: string | null
  emailConfirmed: boolean
  lastSignInAt: string | null
  createdAt: string
}

export interface OrderStatusHistory {
  id: string
  orderId: string
  status: OrderStatus
  changedBy?: string
  changedByName?: string
  notes?: string
  createdAt: string
}

// Extended Order con nuevos campos
export interface OrderExtended extends Order {
  couponCode?: string
  couponDiscount: number
  deliveryZoneId?: string
  driverId?: string
  driverAssignedAt?: string
  driverNotes?: string
  pickupCode?: string
  orderType: OrderType
  createdBy?: string
}
