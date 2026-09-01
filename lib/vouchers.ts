// Pure, client-safe voucher logic — no DB access, no secrets. Safe to import
// from both server code and the 'use client' checkout page.
//
// Same split as lib/shipping.ts vs lib/shippingQuote.ts (decision.md D9): the
// discount *math* and the rule checks live here so checkout can render an
// accurate preview, while every lookup/claim against Postgres lives in the
// server-only lib/voucherStore.ts.

export type DiscountType = 'percent' | 'fixed' | 'free_shipping'

export const DISCOUNT_TYPES: DiscountType[] = ['percent', 'fixed', 'free_shipping']

// Mirrors a `vouchers` row. Dates arrive from the DB as ISO strings.
export interface Voucher {
  id: number
  code: string
  description: string
  discount_type: DiscountType
  discount_value: number
  max_discount: number | null
  min_subtotal: number
  max_redemptions: number | null
  redemption_count: number
  once_per_email: boolean
  starts_at: string | null
  expires_at: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// What a voucher is worth against a specific cart. `freeShipping` is kept
// separate from `discount` because it can't be priced until the shipping quote
// exists — POST /api/orders resolves it after getShippingFee().
export interface VoucherDiscount {
  discount: number
  freeShipping: boolean
}

// The shape both POST /api/vouchers/validate and POST /api/orders work with.
export interface AppliedVoucher extends VoucherDiscount {
  id: number
  code: string
  description: string
  label: string
}

// Codes are stored and compared normalized, so "welcome10", " WELCOME10 " and
// "WELCOME10" are one voucher. Interior spaces go too — customers retyping a
// code off a poster add them freely.
export function normalizeCode(code: string): string {
  return code.replace(/\s+/g, '').toUpperCase()
}

// A code is only valid if it survives normalization intact-ish: letters,
// digits, dash and underscore. Keeps admin from creating codes that can't be
// typed back in, and keeps junk out of the lookup.
export const CODE_PATTERN = /^[A-Z0-9_-]{3,32}$/

export function isValidCode(code: string): boolean {
  return CODE_PATTERN.test(normalizeCode(code))
}

// Short human label for the voucher's value — used on the checkout chip, the
// admin list, the order emails and the admin order card.
export function voucherLabel(v: Pick<Voucher, 'discount_type' | 'discount_value' | 'max_discount'>): string {
  switch (v.discount_type) {
    case 'percent':
      return `${v.discount_value}% off${v.max_discount ? ` (max ₱${v.max_discount.toLocaleString()})` : ''}`
    case 'fixed':
      return `₱${v.discount_value.toLocaleString()} off`
    case 'free_shipping':
      return 'Free delivery'
  }
}

// What the voucher takes off *this* subtotal. Never exceeds the subtotal (a
// ₱500-off voucher on a ₱299 cart discounts ₱299, not ₱500 — the order total
// floors at the shipping fee, it never goes negative or turns into a refund).
export function calcVoucherDiscount(v: Voucher, subtotal: number): VoucherDiscount {
  if (v.discount_type === 'free_shipping') {
    return { discount: 0, freeShipping: true }
  }

  const raw =
    v.discount_type === 'percent'
      ? Math.floor((subtotal * v.discount_value) / 100)
      : v.discount_value

  const capped = v.max_discount != null ? Math.min(raw, v.max_discount) : raw

  return { discount: Math.max(0, Math.min(capped, subtotal)), freeShipping: false }
}

// Every rule that can be judged from the voucher row + the cart alone. The two
// that can't — "is the per-email slot still free" and "did someone else take
// the last redemption a millisecond ago" — are enforced atomically in
// lib/voucherStore.ts at claim time, not here.
//
// `now` is injectable so this stays pure and testable. All timestamps are
// TIMESTAMPTZ, so these comparisons are absolute — no timezone assumption.
export function checkVoucherRules(v: Voucher, subtotal: number, now: Date = new Date()): string | null {
  if (!v.is_active) return 'This voucher is no longer active.'

  if (v.starts_at && now < new Date(v.starts_at)) return 'This voucher isn’t active yet.'
  if (v.expires_at && now >= new Date(v.expires_at)) return 'This voucher has expired.'

  if (v.max_redemptions != null && v.redemption_count >= v.max_redemptions) {
    return 'This voucher has been fully redeemed.'
  }

  if (subtotal < v.min_subtotal) {
    const short = v.min_subtotal - subtotal
    return `Spend ₱${short.toLocaleString()} more to use this voucher (₱${v.min_subtotal.toLocaleString()} minimum).`
  }

  return null
}

// Convenience for the two callers that need "check, then price" in one step.
export type ApplyResult =
  | { ok: false; error: string }
  | { ok: true; applied: AppliedVoucher }

export function applyVoucher(v: Voucher, subtotal: number, now: Date = new Date()): ApplyResult {
  const error = checkVoucherRules(v, subtotal, now)
  if (error) return { ok: false, error }

  return {
    ok: true,
    applied: {
      id: v.id,
      code: v.code,
      description: v.description,
      label: voucherLabel(v),
      ...calcVoucherDiscount(v, subtotal),
    },
  }
}
