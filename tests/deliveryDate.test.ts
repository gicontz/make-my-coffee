// The delivery-date rule enforced at checkout and again in POST /api/orders.
//
// Two things here are load-bearing. The bounds are Asia/Manila, not the
// runtime's zone — Vercel runs in UTC, eight hours behind, so trusting the host
// would offer a date the server then rejects for most of a Philippine evening.
// And the earliest date is tomorrow, which is not an arbitrary lead time: the
// slot rule requires a morning *and* an afternoon window, so an order placed
// after about 11am could never be served same-day.

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  MAX_DAYS_AHEAD,
  MIN_LEAD_DAYS,
  earliestDeliveryDate,
  formatDeliveryDate,
  latestDeliveryDate,
  manilaDay,
  validateDeliveryDate,
} from '../lib/deliveryDate.ts'

// 2026-09-19 08:00 UTC is 16:00 the same day in Manila.
const NOW = new Date('2026-09-19T08:00:00.000Z')

test('the day boundary is Manila, whatever zone the host runs in', () => {
  // 17:00 UTC is already the 20th in Manila (UTC+8). A host in UTC would call
  // it the 19th and offer the 20th as "tomorrow" — a date already in the past.
  assert.equal(manilaDay(new Date('2026-09-19T17:00:00.000Z')), '2026-09-20')
  assert.equal(manilaDay(new Date('2026-09-19T15:59:00.000Z')), '2026-09-19')
})

test('the earliest date is tomorrow, the latest is the window end', () => {
  assert.equal(MIN_LEAD_DAYS, 1)
  assert.equal(earliestDeliveryDate(NOW), '2026-09-20')
  assert.equal(latestDeliveryDate(NOW), '2026-10-19')
})

test('bounds cross a month end without arithmetic drift', () => {
  const endOfMonth = new Date('2026-09-30T04:00:00.000Z')
  assert.equal(earliestDeliveryDate(endOfMonth), '2026-10-01')
})

test('a date inside the window is accepted', () => {
  assert.equal(validateDeliveryDate('2026-09-20', NOW), null)
  assert.equal(validateDeliveryDate('2026-10-19', NOW), null)
})

test('today and the past are refused', () => {
  // The slot rule needs a morning and an afternoon window; same-day cannot
  // satisfy it, so today is not merely discouraged but unservable.
  assert.match(validateDeliveryDate('2026-09-19', NOW)!, /earliest/i)
  assert.match(validateDeliveryDate('2026-09-18', NOW)!, /earliest/i)
  assert.match(validateDeliveryDate('2025-01-01', NOW)!, /earliest/i)
})

test('a date past the booking window is refused', () => {
  assert.match(validateDeliveryDate('2026-10-20', NOW)!, new RegExp(String(MAX_DAYS_AHEAD)))
  assert.ok(validateDeliveryDate('2027-09-20', NOW))
})

test('a missing date is refused with something a customer can act on', () => {
  for (const value of ['', '   ', undefined, null]) {
    assert.match(validateDeliveryDate(value, NOW)!, /choose the date/i, String(value))
  }
})

test('junk and impossible dates are refused, not coerced', () => {
  // 2026 is not a leap year, and month 13 does not exist. A Date-based parse
  // would happily roll both forward into a real day.
  for (const value of ['2026-02-30', '2026-13-01', '2026-09-32', 'tomorrow', '20/09/2026', '2026-9-20', 42, {}]) {
    assert.ok(validateDeliveryDate(value, NOW), `${JSON.stringify(value)} must be refused`)
  }
})

test('a valid leap day is still accepted', () => {
  const beforeLeap = new Date('2028-02-20T04:00:00.000Z')
  assert.equal(validateDeliveryDate('2028-02-29', beforeLeap), null)
})

test('formatting never shifts the day it was given', () => {
  // A bare calendar date formatted in a named zone is the classic off-by-one.
  // The stored day and the printed day must be the same day, always.
  for (const iso of ['2026-01-01', '2026-09-20', '2026-12-31']) {
    const out = formatDeliveryDate(iso)
    const [, m, d] = iso.split('-')
    assert.match(out, new RegExp(String(Number(d))), `${iso} → ${out}`)
    assert.match(out, /2026/)
    assert.ok(!out.includes(String(Number(d) - 1)) || Number(d) === 1, `${iso} → ${out} looks shifted`)
  }
})

test('formatting leaves unusable input alone rather than inventing a date', () => {
  assert.equal(formatDeliveryDate('not a date'), 'not a date')
  assert.equal(formatDeliveryDate('2026-02-30'), '2026-02-30')
})
