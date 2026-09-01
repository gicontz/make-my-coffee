// Input parsing/validation for admin voucher create + edit. Lives in lib/
// rather than in the route file because Next's App Router type-checks
// route.ts modules and rejects exports that aren't route handlers or config.

import { DISCOUNT_TYPES, isValidCode, normalizeCode, type DiscountType } from './vouchers.ts'

// Parses an optional positive-integer field. Returns `undefined` for "the
// client sent something unusable", which the callers turn into a 400 —
// distinct from `null`, which means "explicitly cleared / unlimited".
function optionalPositiveInt(value: unknown): number | null | undefined {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0) return undefined
  return n
}

function optionalTimestamp(value: unknown): string | null | undefined {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') return undefined
  const d = new Date(value)
  return isNaN(d.getTime()) ? undefined : d.toISOString()
}

// Shared by POST (create) and PATCH (edit). Returns a message on rejection.
export function validateVoucherInput(body: Record<string, unknown>) {
  const code = normalizeCode(String(body.code ?? ''))
  if (!isValidCode(code)) {
    return { error: 'Code must be 3–32 characters: letters, numbers, dash or underscore.' }
  }

  const discountType = String(body.discount_type ?? '') as DiscountType
  if (!DISCOUNT_TYPES.includes(discountType)) {
    return { error: 'Pick a discount type.' }
  }

  let discountValue = 0
  if (discountType === 'percent') {
    discountValue = Number(body.discount_value)
    if (!Number.isInteger(discountValue) || discountValue < 1 || discountValue > 100) {
      return { error: 'Percentage must be a whole number between 1 and 100.' }
    }
  } else if (discountType === 'fixed') {
    discountValue = Number(body.discount_value)
    if (!Number.isInteger(discountValue) || discountValue < 1) {
      return { error: 'Peso amount must be a whole number of at least ₱1.' }
    }
  }

  // A cap only means anything for percent vouchers — a fixed ₱ voucher is
  // already its own cap. Dropped rather than rejected so switching type in the
  // admin form doesn't strand an unusable value in the row.
  const maxDiscount = discountType === 'percent' ? optionalPositiveInt(body.max_discount) : null
  if (maxDiscount === undefined) return { error: 'Max discount must be a positive whole number, or blank.' }

  const minSubtotal = body.min_subtotal === '' || body.min_subtotal == null ? 0 : Number(body.min_subtotal)
  if (!Number.isInteger(minSubtotal) || minSubtotal < 0) {
    return { error: 'Minimum spend must be a whole number of ₱0 or more.' }
  }

  const maxRedemptions = optionalPositiveInt(body.max_redemptions)
  if (maxRedemptions === undefined) return { error: 'Redemption limit must be a positive whole number, or blank.' }

  const startsAt = optionalTimestamp(body.starts_at)
  if (startsAt === undefined) return { error: 'Start date is not a valid date/time.' }

  const expiresAt = optionalTimestamp(body.expires_at)
  if (expiresAt === undefined) return { error: 'Expiry date is not a valid date/time.' }

  if (startsAt && expiresAt && new Date(expiresAt) <= new Date(startsAt)) {
    return { error: 'Expiry must be after the start date.' }
  }

  return {
    error: null,
    values: {
      code,
      description: String(body.description ?? '').trim().slice(0, 200),
      discountType,
      discountValue,
      maxDiscount,
      minSubtotal,
      maxRedemptions,
      oncePerEmail: body.once_per_email === true,
      startsAt,
      expiresAt,
      isActive: body.is_active !== false,
    },
  }
}
