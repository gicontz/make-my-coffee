// Weekly subscriptions (#38) — the pure half. Schema in
// lib/migrations/0013_add_subscriptions.sql; the database half is
// lib/subscriptionStore.ts.
//
// Relative imports with extensions, like lib/email.ts, so
// tests/subscriptions.test.ts can load this under
// `node --experimental-strip-types`.
//
// ⚠️ PAYMENT IS NOT BUILT, AND SIGN-UP IS NOT OFFERED, ON PURPOSE.
// There is no way to charge a customer weekly yet (decision.md D15): no
// gateway (#21), and whether PayMongo can charge GCash/Maya on a schedule —
// rather than cards only — is unconfirmed. A subscription collected by COD or
// a weekly QR re-scan is worse than none (the issue says so outright). So this
// module has the schedule, the price and the customer's own controls, and
// nothing creates a subscription row. Don't add a sign-up path without the
// billing that goes with it.

import { MAX_DAYS_AHEAD, addDays, earliestDeliveryDate, validateDeliveryDate } from './deliveryDate.ts'
import { siteUrl } from './siteUrl.ts'

/** Off the bottle subtotal of every subscription delivery. */
export const SUBSCRIPTION_DISCOUNT_PERCENT = 10

/** Weekly. Every delivery lands on the same weekday as the first. */
export const CADENCE_DAYS = 7

/** Mirrors the CHECK constraint in migration 0013 — the test pins the pair. */
export const SUBSCRIPTION_STATUSES = ['active', 'paused', 'cancelled'] as const
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number]

export const SUBSCRIPTION_ACTIONS = ['pause', 'resume', 'skip', 'cancel'] as const
export type SubscriptionAction = (typeof SUBSCRIPTION_ACTIONS)[number]

export function isSubscriptionAction(value: unknown): value is SubscriptionAction {
  return typeof value === 'string' && (SUBSCRIPTION_ACTIONS as readonly string[]).includes(value)
}

// ── Price ─────────────────────────────────────────────────────────────────

/**
 * Pesos off one delivery's bottles. Floored, like a percentage voucher
 * (lib/vouchers.ts), so rounding never gives away a peso the rate didn't.
 *
 * Bottles only. Delivery is quoted live per order from the pin and is never
 * discounted by this, and the free-delivery threshold is judged on the
 * subtotal *before* this comes off — same rule as a voucher, so subscribing
 * can never be what tips a basket out of free delivery.
 */
export function subscriptionDiscount(subtotal: number): number {
  return Math.floor((subtotal * SUBSCRIPTION_DISCOUNT_PERCENT) / 100)
}

// ── Schedule ──────────────────────────────────────────────────────────────
//
// A subscription stores one date: `next_delivery_date`, the next delivery
// that has not been turned into an order yet. Everything else is derived.
//
// Every date this module hands out passes validateDeliveryDate() at the moment
// it is computed — the same rule checkout and POST /api/orders enforce. That is
// the issue's requirement, and the tests sweep a month of clock times,
// including the Manila evening hours where a UTC host would disagree, to hold
// it there.

function daysFrom(from: string, to: string): number {
  const [y1, m1, d1] = from.split('-').map(Number)
  const [y2, m2, d2] = to.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000)
}

/**
 * The first date on this subscription's weekly cadence that can still be
 * delivered — `anchor` itself if it is far enough ahead, otherwise rolled
 * forward a whole number of weeks, so the weekday never drifts.
 *
 * This is what a stored date means when it is read: a date that has slipped
 * into the past (a paused subscription, or an order run that didn't happen)
 * is never offered as-is.
 */
export function nextOnCadence(anchor: string, now = new Date()): string {
  const earliest = earliestDeliveryDate(now)
  const behind = daysFrom(anchor, earliest)
  if (behind <= 0) return anchor
  return addDays(anchor, Math.ceil(behind / CADENCE_DAYS) * CADENCE_DAYS)
}

export interface ScheduleState {
  status: SubscriptionStatus
  /** YYYY-MM-DD, the next delivery not yet ordered. */
  nextDeliveryDate: string
}

export type ActionResult =
  | { ok: true; value: ScheduleState; changed: boolean }
  | { ok: false; error: string }

/**
 * The customer's own controls: pause, resume, skip one week, cancel.
 *
 * The issue is blunt about why these are customer-side: the KPI is
 * subscription share of orders, and a subscription that needs an email to a
 * human to leave is a complaint generator, not revenue. So each one is a
 * button, takes effect at once, and asks nothing.
 *
 * Repeating the action you just took (a double click, two tabs) succeeds
 * without changing anything, rather than erroring at someone who got what
 * they asked for.
 */
export function applySubscriptionAction(
  state: ScheduleState,
  action: SubscriptionAction,
  now = new Date(),
): ActionResult {
  const unchanged = { ok: true as const, value: state, changed: false }

  if (state.status === 'cancelled') {
    return action === 'cancel'
      ? unchanged
      : { ok: false, error: 'This subscription has been cancelled. You can start a new one from the shop.' }
  }

  switch (action) {
    case 'cancel':
      return { ok: true, value: { ...state, status: 'cancelled' }, changed: true }

    case 'pause':
      if (state.status === 'paused') return unchanged
      return { ok: true, value: { ...state, status: 'paused' }, changed: true }

    case 'resume': {
      if (state.status === 'active') return unchanged
      // Back on the same weekday, at the first date that can still be served.
      const next = nextOnCadence(state.nextDeliveryDate, now)
      return { ok: true, value: { status: 'active', nextDeliveryDate: next }, changed: true }
    }

    case 'skip': {
      if (state.status === 'paused') {
        return { ok: false, error: 'Your subscription is paused, so there is no delivery to skip. Resume it first.' }
      }
      const skipped = addDays(nextOnCadence(state.nextDeliveryDate, now), CADENCE_DAYS)
      // Skips stack, but only as far as the booking window checkout allows.
      // Further than that, pausing says what the customer means.
      if (validateDeliveryDate(skipped, now) !== null) {
        return {
          ok: false,
          error: `Deliveries can only be moved up to ${MAX_DAYS_AHEAD} days ahead. To stop them for longer, pause instead.`,
        }
      }
      return { ok: true, value: { ...state, nextDeliveryDate: skipped }, changed: true }
    }
  }
}

/** The date to show the customer: the stored one, read as the cadence means it. */
export function upcomingDelivery(state: ScheduleState, now = new Date()): string | null {
  return state.status === 'active' ? nextOnCadence(state.nextDeliveryDate, now) : null
}

/**
 * What the holder of a manage link may see: their first name, what they get,
 * when, and what it costs before delivery. Never the email, phone, address or
 * pin — a forwarded email should not hand those to whoever it reaches.
 */
export interface SubscriptionView {
  firstName: string
  status: SubscriptionStatus
  /** The next delivery, or null while paused or cancelled. */
  nextDeliveryDate: string | null
  slotLabels: string[]
  items: { name: string; quantity: number }[]
  /** Bottles at today's catalog prices, before the subscription discount. */
  subtotal: number
  discount: number
}

// ── Manage link ───────────────────────────────────────────────────────────
//
// A bearer link (lib/linkToken.ts), derived rather than random so that every
// weekly email can carry the same one. Bumping `manage_token_version` on the
// row revokes it and mints a new one.

export function manageTokenMessage(subscriptionId: number, version: number): string {
  return `subscription-manage:v${version}:${subscriptionId}`
}

export function subscriptionManageUrl(token: string): string {
  return `${siteUrl()}/subscription#${token}`
}
