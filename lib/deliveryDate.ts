// The delivery *date* a customer asks for at checkout, alongside the time
// windows in lib/deliverySlots.ts.
//
// Pure and client-safe: the checkout page, POST /api/orders and the emails all
// read the same bounds, so the calendar the customer sees and the dates the
// server accepts cannot drift apart.
//
// Every boundary is Asia/Manila, explicitly. The runtime default is UTC on
// Vercel, which is eight hours behind — trusting it would make "tomorrow"
// resolve to today for most of a Philippine evening, and the customer would be
// offered a date the server then rejects.

/** Asia/Manila calendar date as YYYY-MM-DD. */
export function manilaDay(now = new Date()): string {
  // en-CA formats as YYYY-MM-DD, which is also what <input type="date">
  // exchanges and what Postgres accepts for a DATE column — one representation
  // end to end, no parsing in between.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(now)
}

/**
 * Days between ordering and the earliest delivery.
 *
 * One, not zero, and it is not an arbitrary lead time: the slot rule requires
 * at least one morning *and* one afternoon window (lib/deliverySlots.ts), so an
 * order placed after about 11am could never satisfy it for the same day. The
 * earliest date a customer can actually be served is therefore tomorrow.
 */
export const MIN_LEAD_DAYS = 1

/** How far ahead a date may be booked. Stops a stray year in a typed date. */
export const MAX_DAYS_AHEAD = 30

/** Plain calendar arithmetic — UTC internally so no zone can shift the day. */
function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d) + days * 86_400_000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

export function earliestDeliveryDate(now = new Date()): string {
  return addDays(manilaDay(now), MIN_LEAD_DAYS)
}

export function latestDeliveryDate(now = new Date()): string {
  return addDays(manilaDay(now), MAX_DAYS_AHEAD)
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** True only for a real calendar date — rejects 2026-02-30 and friends. */
function isRealDate(iso: string): boolean {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}

/**
 * The delivery date rule, enforced client-side for immediate feedback and
 * server-side as the source of truth — same shape as validateDeliverySlots().
 *
 * ISO dates compare correctly as strings, so the range check needs no parsing.
 */
export function validateDeliveryDate(value: unknown, now = new Date()): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return 'Choose the date you would like your order delivered.'
  }
  if (!ISO_DATE.test(value) || !isRealDate(value)) {
    return 'That delivery date is not valid.'
  }

  const earliest = earliestDeliveryDate(now)
  if (value < earliest) {
    return MIN_LEAD_DAYS === 1
      ? 'The earliest we can deliver is tomorrow — please pick a later date.'
      : `The earliest we can deliver is ${formatDeliveryDate(earliest)}.`
  }
  if (value > latestDeliveryDate(now)) {
    return `We only take orders up to ${MAX_DAYS_AHEAD} days ahead.`
  }
  return null
}

/** How a chosen date reads to a person: "Fri, 20 Sep 2026". */
export function formatDeliveryDate(iso: string): string {
  if (typeof iso !== 'string' || !ISO_DATE.test(iso) || !isRealDate(iso)) return iso
  const [y, m, d] = iso.split('-').map(Number)
  // Formatted in UTC against a UTC-constructed date: the pair cancel out, so
  // the day printed is exactly the day stored. Formatting a bare date in a
  // named zone is what shifts it by one.
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  }).format(new Date(Date.UTC(y, m - 1, d)))
}
