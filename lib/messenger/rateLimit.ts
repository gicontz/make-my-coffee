// Pure rate-limit arithmetic for order lookups — no DB, no env, no imports.
//
// Split out of store.ts for the same reason lib/shipping.ts is split from
// lib/shippingQuote.ts: the rule is worth testing on its own, and a test that
// has to load a Postgres driver to check a subtraction is a test that stops
// being run.
//
// The rule exists because `orders.id` is a SERIAL. Sequential ids mean a
// lookup gated on order-number-plus-email can still be attacked one email at a
// time; this is what makes that expensive.

/** Failed lookups allowed before a chatter is paused, and the window. */
export const MAX_FAILED_LOOKUPS = 5
export const LOOKUP_WINDOW_MINUTES = 15

export interface AttemptWindow {
  failed_attempts: number
  window_started_at: string
}

function windowExpired(session: AttemptWindow, now: Date): boolean {
  return now.getTime() - new Date(session.window_started_at).getTime() >= LOOKUP_WINDOW_MINUTES * 60_000
}

/** True while a chatter has burned through their failed-lookup budget. */
export function isRateLimited(session: AttemptWindow, now = new Date()): boolean {
  if (session.failed_attempts < MAX_FAILED_LOOKUPS) return false
  return !windowExpired(session, now)
}

/**
 * The counter state after one more failure. A fresh window starts once the
 * previous one has aged out, so an honest customer who mistypes today isn't
 * still locked out next week.
 */
export function nextAttemptWindow(
  session: AttemptWindow,
  now = new Date()
): { attempts: number; windowStartedAt: string } {
  return windowExpired(session, now)
    ? { attempts: 1, windowStartedAt: now.toISOString() }
    : { attempts: session.failed_attempts + 1, windowStartedAt: new Date(session.window_started_at).toISOString() }
}
