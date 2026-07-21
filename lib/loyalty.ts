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

/**
 * Confirm a reward code is still spendable before showing it. A code that was
 * deleted, deactivated, expired or already used renders as "invalid" at
 * checkout, so it's worse than showing nothing — clear the reference and let
 * the customer see their progress bar instead.
 *
 * Returns the code if it's still good, null otherwise.
 */
export async function resolveRewardCoupon(
  supabase: ReturnType<typeof createAdminClient>,
  normalizedPhone: string,
  code: string | null
): Promise<string | null> {
  if (!code) return null

  try {
    const { data: coupon, error } = await supabase
      .from("coupons")
      .select("usage_limit, usage_count, valid_until, is_active")
      .eq("code", code)
      .maybeSingle()

    if (error) return code // can't tell — don't hide a reward on a transient failure

    const stillValid =
      !!coupon &&
      coupon.is_active !== false &&
      (!coupon.valid_until || new Date(coupon.valid_until) > new Date()) &&
      (!coupon.usage_limit || (coupon.usage_count ?? 0) < coupon.usage_limit)

    if (stillValid) return code

    await supabase
      .from("customers")
      .update({ reward_coupon_code: null })
      .eq("phone", normalizedPhone)
      .eq("reward_coupon_code", code)

    return null
  } catch {
    return code
  }
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
      rewardCouponCode: await resolveRewardCoupon(supabase, normalized, data.reward_coupon_code || null),
    }
  } catch {
    return null
  }
}
