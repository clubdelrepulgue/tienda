// Server-only module (uses the service-role client). Never import from client components.
import { createAdminClient } from "./supabase/admin"
import { normalizePhone } from "./customer"

// Loyalty program: every LOYALTY_TARGET delivered orders earn a personal
// one-use coupon of LOYALTY_DISCOUNT_PERCENT off.
export const LOYALTY_TARGET = 5
export const LOYALTY_DISCOUNT_PERCENT = 20
export const LOYALTY_REWARD_VALID_DAYS = 30

export interface CustomerLoyalty {
  ordersCount: number
  progress: number // 0..LOYALTY_TARGET-1 delivered orders toward the next reward
  target: number
  rewardCouponCode: string | null
}

// Best-effort read: returns null if the customer doesn't exist yet or the
// customers table hasn't been migrated (script 012).
export async function getCustomerLoyalty(phone: string): Promise<CustomerLoyalty | null> {
  const normalized = normalizePhone(phone)
  if (!normalized) return null

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("customers")
      .select("orders_count, loyalty_progress, reward_coupon_code")
      .eq("phone", normalized)
      .maybeSingle()

    if (error || !data) return null

    return {
      ordersCount: data.orders_count ?? 0,
      progress: data.loyalty_progress ?? 0,
      target: LOYALTY_TARGET,
      rewardCouponCode: data.reward_coupon_code || null,
    }
  } catch {
    return null
  }
}
