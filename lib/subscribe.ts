// Email signups (#39): the welcome code, the consent wording, and when the
// running-low reminder is due.
//
// Pure and client-safe — the signup form renders SIGNUP_CONSENT from here and
// POST /api/subscribe stores the same string, so the wording a person agreed to
// and the wording on record cannot drift apart. Everything touching Postgres is
// in the server-only lib/subscriberStore.ts (same split as lib/vouchers.ts vs
// lib/voucherStore.ts).
//
// ⚠️ This is a marketing list, so it is consent-gated on its own. Accepting
// analytics or advertising cookies is not agreeing to be emailed, and neither
// is placing an order: the only way onto the list is the signup form. /privacy
// says so, and is wrong the moment anything else adds an address.

// Relative, with extensions, so tests/subscribe.test.ts can load this under
// plain `node --experimental-strip-types` (see lib/email.ts).
import { DAYS_FROM_DELIVERY } from './freshness.ts'
import { MIN_LEAD_DAYS, addDays, manilaDay } from './deliveryDate.ts'

// ── The welcome code ──────────────────────────────────────────────────────

/** Pesos off, issued once per email address on signup. */
export const WELCOME_DISCOUNT = 50

/** Days the code stays good, counted in Manila calendar days from signup. */
export const WELCOME_VOUCHER_DAYS = 30

/** What the customer sees on the checkout chip once the code is applied. */
export const WELCOME_VOUCHER_DESCRIPTION = `Welcome offer — ₱${WELCOME_DISCOUNT} off`

export const WELCOME_CODE_PREFIX = 'HELLO-'

// No 0/O, 1/I/L: these codes get read off a phone screen and typed back in.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_BODY_LENGTH = 8

/**
 * A fresh, unguessable code — 31^8 ≈ 8.5e11 bodies, so walking
 * /api/vouchers/validate for live ones is not a strategy.
 *
 * Rejection sampling rather than `byte % 31`: 256 is not a multiple of 31, and
 * the modulo would make the first eight letters measurably likelier. `random`
 * is injectable so the test can check the bias handling deterministically.
 */
export function generateWelcomeCode(
  random: (n: number) => Uint8Array = n => crypto.getRandomValues(new Uint8Array(n))
): string {
  const limit = 256 - (256 % CODE_ALPHABET.length)
  let body = ''
  while (body.length < CODE_BODY_LENGTH) {
    const bytes = random(CODE_BODY_LENGTH * 2)
    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i]
      if (byte >= limit) continue
      body += CODE_ALPHABET[byte % CODE_ALPHABET.length]
      if (body.length === CODE_BODY_LENGTH) break
    }
  }
  return WELCOME_CODE_PREFIX + body
}

/**
 * The code is good through the end of `lastDay` in Manila, and stops at the
 * following midnight there. Ending on a day boundary is what lets the email
 * say "until Wed, 11 Nov" and mean it — an instant 30 × 24h after signup would
 * expire mid-afternoon on a day the customer was told it was still valid.
 */
export function welcomeVoucherWindow(now = new Date()): { lastDay: string; expiresAt: string } {
  const lastDay = addDays(manilaDay(now), WELCOME_VOUCHER_DAYS)
  // PH has had no DST since 1978, so +08:00 is Manila all year (decision.md D11).
  return { lastDay, expiresAt: `${addDays(lastDay, 1)}T00:00:00+08:00` }
}

// ── The signup ────────────────────────────────────────────────────────────

/**
 * What the person is agreeing to, in full, shown beside the button and stored
 * verbatim on their row as the record of consent.
 *
 * Every kind of email the list will ever receive is named here. Sending a kind
 * that isn't — a newsletter, a partner's offer — needs this wording changed
 * first, and only reaches people who signed up after it changed.
 */
export const SIGNUP_CONSENT =
  `We’ll email you a ₱${WELCOME_DISCOUNT}-off code, a reminder when a delivered order is probably running low, ` +
  'and the occasional offer. Every email has a one-click unsubscribe.'

/** Where on the site an address was given. Recorded with the consent. */
export const SIGNUP_SOURCES = ['home'] as const
export type SignupSource = (typeof SIGNUP_SOURCES)[number]

export function isSignupSource(v: unknown): v is SignupSource {
  return typeof v === 'string' && (SIGNUP_SOURCES as readonly string[]).includes(v)
}

/**
 * New addresses accepted per rolling day, site-wide.
 *
 * POST /api/subscribe is public, and every new address costs a voucher row and
 * an outbound email. Unbounded, a script feeding it invented addresses would
 * bounce enough mail to damage the sending domain's reputation — which takes
 * the order emails down with it. Past the ceiling the form says to try
 * tomorrow; nothing already subscribed is affected.
 */
export const MAX_SIGNUPS_PER_DAY = 200

export const MAX_EMAIL_LENGTH = 254

/** Deliberately loose: one @, something either side, a dot in the domain. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function isValidEmail(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(v.trim())
}

/**
 * The identity of an address: "Ana@Example.com " and "ana@example.com" are one
 * subscriber with one welcome code. Orders are matched to subscribers on the
 * same key, in SQL as `lower(trim(email))`.
 */
export function emailKey(email: string): string {
  return email.trim().toLowerCase()
}

// ── The running-low reminder ──────────────────────────────────────────────
//
// One email per delivered order, timed from two things the code already knows
// — how many shots were in it (lib/products.ts, snapshotted onto the order) and
// the day it arrived (orders.delivery_date) — so nobody is asked anything.

/**
 * The pace the timing assumes: a coffee a day. It is the one assumption in
 * here, and it only ever brings a reminder *earlier* — the freshness window
 * below caps it, so no order is reminded later than its best-before allows.
 */
export const SHOTS_PER_DAY = 1

/**
 * How many days late a reminder may still go out. Covers a missed cron run,
 * and stops the first run after launch from mailing every order in history.
 */
export const REMINDER_GRACE_DAYS = 2

/** Shots in an order's items snapshot. Anything malformed counts as none. */
export function totalShots(items: unknown): number {
  if (!Array.isArray(items)) return 0
  return items.reduce((sum: number, item) => {
    const shots = Number((item as { shots?: unknown })?.shots)
    const qty = Number((item as { quantity?: unknown })?.quantity)
    return Number.isFinite(shots) && Number.isFinite(qty) && shots > 0 && qty > 0 ? sum + shots * qty : sum
  }, 0)
}

/**
 * The day to send the reminder for an order delivered on `deliveryDate`.
 *
 * The bottle lasts `shots ÷ SHOTS_PER_DAY` days, but never past the freshness
 * window — past it the coffee is beyond its best whatever is left. The
 * reminder goes `MIN_LEAD_DAYS` before that, because the earliest a new order
 * can arrive is tomorrow: reminding on the day it runs out guarantees a gap.
 */
export function reminderDueDate(deliveryDate: string, shots: number): string {
  const lasts = Math.min(Math.max(1, Math.ceil(shots / SHOTS_PER_DAY)), DAYS_FROM_DELIVERY)
  return addDays(deliveryDate, Math.max(0, lasts - MIN_LEAD_DAYS))
}

/** Due today, or up to REMINDER_GRACE_DAYS overdue. ISO dates compare as strings. */
export function isReminderDue(dueDate: string, today: string): boolean {
  return dueDate <= today && dueDate >= addDays(today, -REMINDER_GRACE_DAYS)
}

/**
 * The oldest delivery date that could still be due on `today` — the largest
 * possible offset plus the grace. Bounds the candidate query so the job reads
 * days of orders, not the whole table.
 */
export function oldestDeliveryStillDue(today: string): string {
  return addDays(today, -(DAYS_FROM_DELIVERY - MIN_LEAD_DAYS + REMINDER_GRACE_DAYS))
}

/** Counts for the admin strip on /admin/vouchers. */
export interface SubscriberSummary {
  subscribed: number
  unsubscribed: number
  welcomeIssued: number
  welcomeRedeemed: number
  remindersSent: number
}

/** Unsubscribe tokens are 32 url-safe characters (24 random bytes). */
export function isUnsubscribeToken(v: unknown): v is string {
  return typeof v === 'string' && /^[A-Za-z0-9_-]{32}$/.test(v)
}
