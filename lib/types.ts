export interface Category {
  id: string
  name: string
  slug: string
  order: number
}

export interface ModifierOption {
  id: string
  name: string
  price: number
}

export interface ModifierGroup {
  id: string
  name: string
  required: boolean
  maxSelections: number
  options: ModifierOption[]
}

export interface Product {
  id: string
  name: string
  description: string
  price: number
  image: string
  images: string[]
  categoryId: string
  active: boolean
  modifierGroups: string[] // IDs of modifier groups
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
  name: string
  image: string
  price: number
  quantity: number
  modifiers: CartItemModifier[]
}

export type OrderStatus = "new" | "accepted" | "preparing" | "ready" | "delivered" | "cancelled"

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
  status: OrderStatus
  createdAt: string
  acceptedAt?: string
  preparingAt?: string
  readyAt?: string
  deliveredAt?: string
  cancelledAt?: string
  branchId: string
  addressLat?: number | null
  addressLng?: number | null
  driverId?: string | null
  deliveryZoneId?: string | null
}

export interface Branch {
  id: string
  name: string
  address: string
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
  isAvailable: boolean
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
  name: string
  triggerProductIds: string[]
  triggerCategoryIds: string[]
  suggestedProductIds: string[]
  message: string
  discountPercentage: number
  priority: number
  isActive: boolean
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
