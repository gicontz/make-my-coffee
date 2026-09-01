// Unit tests for the pure voucher core. Run with `npm test` (node:test +
// Node's built-in TypeScript stripping — no test framework dependency).
//
// Only lib/vouchers.ts and lib/voucherInput.ts are covered here: they hold the
// discount math and the rule checks, and they're pure, so they're testable
// without a database. The parts that need Postgres (the atomic claim in
// lib/voucherStore.ts) are exercised against the real DB, not mocked.

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  applyVoucher,
  calcVoucherDiscount,
  checkVoucherRules,
  isValidCode,
  normalizeCode,
  voucherLabel,
  type Voucher,
} from '../lib/vouchers.ts'
import { validateVoucherInput } from '../lib/voucherInput.ts'

const BASE: Voucher = {
  id: 1,
  code: 'TEST',
  description: '',
  discount_type: 'percent',
  discount_value: 10,
  max_discount: null,
  min_subtotal: 0,
  max_redemptions: null,
  redemption_count: 0,
  once_per_email: false,
  starts_at: null,
  expires_at: null,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const v = (over: Partial<Voucher> = {}): Voucher => ({ ...BASE, ...over })

/* ── Code normalization ── */

test('normalizeCode uppercases and strips all whitespace', () => {
  assert.equal(normalizeCode('  welcome 10 '), 'WELCOME10')
  assert.equal(normalizeCode('save\t100'), 'SAVE100')
})

test('isValidCode accepts letters, digits, dash and underscore only', () => {
  assert.ok(isValidCode('welcome10'))
  assert.ok(isValidCode('BLACK-FRIDAY_26'))
  assert.ok(!isValidCode('AB'), 'under 3 characters')
  assert.ok(!isValidCode('A'.repeat(33)), 'over 32 characters')
  assert.ok(!isValidCode('50%OFF'), 'punctuation')
})

/* ── Discount math ── */

test('percent discount floors to whole pesos', () => {
  // 15% of ₱449 is ₱67.35 — the customer is charged the peso, never a centavo.
  assert.deepEqual(
    calcVoucherDiscount(v({ discount_type: 'percent', discount_value: 15 }), 449),
    { discount: 67, freeShipping: false }
  )
})

test('percent discount honours max_discount', () => {
  assert.deepEqual(
    calcVoucherDiscount(v({ discount_value: 50, max_discount: 100 }), 1000),
    { discount: 100, freeShipping: false }
  )
})

test('fixed discount never exceeds the subtotal', () => {
  // A ₱500-off voucher on a ₱299 cart takes ₱299, not ₱500 — the order total
  // must never go negative or turn into a refund.
  assert.deepEqual(
    calcVoucherDiscount(v({ discount_type: 'fixed', discount_value: 500 }), 299),
    { discount: 299, freeShipping: false }
  )
})

test('free_shipping takes nothing off the subtotal', () => {
  assert.deepEqual(
    calcVoucherDiscount(v({ discount_type: 'free_shipping', discount_value: 0 }), 1000),
    { discount: 0, freeShipping: true }
  )
})

test('voucherLabel describes each type', () => {
  assert.equal(voucherLabel(v({ discount_value: 10 })), '10% off')
  assert.equal(voucherLabel(v({ discount_value: 10, max_discount: 150 })), '10% off (max ₱150)')
  assert.equal(voucherLabel(v({ discount_type: 'fixed', discount_value: 1000 })), '₱1,000 off')
  assert.equal(voucherLabel(v({ discount_type: 'free_shipping' })), 'Free delivery')
})

/* ── Rule checks ── */

const NOW = new Date('2026-06-15T12:00:00Z')

test('inactive vouchers are rejected', () => {
  assert.match(checkVoucherRules(v({ is_active: false }), 1000, NOW)!, /no longer active/)
})

test('validity window is inclusive of the start and exclusive of the expiry', () => {
  const window = v({ starts_at: '2026-06-15T12:00:00Z', expires_at: '2026-06-20T12:00:00Z' })
  // Exactly at starts_at → live.
  assert.equal(checkVoucherRules(window, 1000, NOW), null)
  assert.match(checkVoucherRules(window, 1000, new Date('2026-06-15T11:59:59Z'))!, /isn’t active yet/)
  // Exactly at expires_at → already over.
  assert.match(checkVoucherRules(window, 1000, new Date('2026-06-20T12:00:00Z'))!, /expired/)
})

test('redemption cap is rejected once reached', () => {
  assert.equal(checkVoucherRules(v({ max_redemptions: 5, redemption_count: 4 }), 1000, NOW), null)
  assert.match(checkVoucherRules(v({ max_redemptions: 5, redemption_count: 5 }), 1000, NOW)!, /fully redeemed/)
})

test('min_subtotal message names the shortfall', () => {
  const err = checkVoucherRules(v({ min_subtotal: 1000 }), 748, NOW)
  assert.match(err!, /₱252 more/)
  // Exactly at the minimum qualifies.
  assert.equal(checkVoucherRules(v({ min_subtotal: 1000 }), 1000, NOW), null)
})

test('applyVoucher returns the priced voucher when every rule passes', () => {
  const result = applyVoucher(v({ code: 'WELCOME10', discount_value: 10 }), 1000, NOW)
  assert.ok(result.ok)
  assert.equal(result.applied.discount, 100)
  assert.equal(result.applied.freeShipping, false)
  assert.equal(result.applied.code, 'WELCOME10')
})

test('applyVoucher reports the first failing rule instead of pricing', () => {
  const result = applyVoucher(v({ is_active: false }), 1000, NOW)
  assert.ok(!result.ok)
  assert.match(result.error, /no longer active/)
})

/* ── Admin input validation ── */

test('validateVoucherInput normalizes the code and defaults the optional fields', () => {
  const parsed = validateVoucherInput({ code: ' welcome 10 ', discount_type: 'percent', discount_value: 10 })
  assert.equal(parsed.error, null)
  assert.equal(parsed.values!.code, 'WELCOME10')
  assert.equal(parsed.values!.minSubtotal, 0)
  assert.equal(parsed.values!.maxRedemptions, null)
  assert.equal(parsed.values!.startsAt, null)
  assert.equal(parsed.values!.isActive, true)
})

test('validateVoucherInput bounds a percentage to 1–100', () => {
  assert.ok(validateVoucherInput({ code: 'AAA', discount_type: 'percent', discount_value: 0 }).error)
  assert.ok(validateVoucherInput({ code: 'AAA', discount_type: 'percent', discount_value: 101 }).error)
  assert.ok(validateVoucherInput({ code: 'AAA', discount_type: 'percent', discount_value: 10.5 }).error)
  assert.equal(validateVoucherInput({ code: 'AAA', discount_type: 'percent', discount_value: 100 }).error, null)
})

test('validateVoucherInput drops a max_discount cap on non-percent vouchers', () => {
  // The cap is meaningless for a fixed ₱ voucher — it must not be persisted as
  // a stale value when admin switches type in the form.
  const parsed = validateVoucherInput({
    code: 'SAVE100', discount_type: 'fixed', discount_value: 100, max_discount: 50,
  })
  assert.equal(parsed.error, null)
  assert.equal(parsed.values!.maxDiscount, null)
})

test('validateVoucherInput rejects an expiry that is not after the start', () => {
  const same = '2026-06-15T12:00:00Z'
  assert.ok(validateVoucherInput({
    code: 'AAA', discount_type: 'percent', discount_value: 10, starts_at: same, expires_at: same,
  }).error)
})

test('validateVoucherInput rejects unusable numbers but accepts blanks as "unset"', () => {
  assert.ok(validateVoucherInput({ code: 'AAA', discount_type: 'percent', discount_value: 10, max_redemptions: 0 }).error)
  assert.ok(validateVoucherInput({ code: 'AAA', discount_type: 'percent', discount_value: 10, max_redemptions: -3 }).error)
  assert.equal(
    validateVoucherInput({ code: 'AAA', discount_type: 'percent', discount_value: 10, max_redemptions: '' }).error,
    null
  )
})

test('validateVoucherInput rejects an unknown discount type', () => {
  assert.ok(validateVoucherInput({ code: 'AAA', discount_type: 'buy_one_get_one', discount_value: 1 }).error)
})
