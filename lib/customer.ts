// Customer identity helpers. The customer key is the normalized phone —
// no login required. When social login lands, customers.auth_user_id links
// an auth user to the same record without migrating anything.

/**
 * Normalize a phone to a stable customer key: digits only, without the
 * Uruguay country code (598) or a leading trunk zero.
 * "099 123 456", "+598 99 123 456" and "59899123456" all map to "99123456".
 */
export function normalizePhone(phone: string): string {
  let digits = (phone || "").replace(/\D+/g, "")

  if (digits.startsWith("00598")) digits = digits.slice(5)
  else if (digits.startsWith("598") && digits.length > 9) digits = digits.slice(3)

  if (digits.startsWith("0")) digits = digits.slice(1)

  return digits
}
