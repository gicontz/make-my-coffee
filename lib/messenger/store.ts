// Server-only Messenger state: event de-duplication, and the authorisation
// gate in front of order lookups. Schema in lib/migrations/0006.

import { sql } from '@/lib/db'
import type { OrderReference, TrackableOrder } from '../chat/conversation.ts'
import { isRateLimited, nextAttemptWindow } from '../chat/rateLimit.ts'

export { LOOKUP_WINDOW_MINUTES, MAX_FAILED_LOOKUPS, isRateLimited, nextAttemptWindow } from '../chat/rateLimit.ts'

/**
 * Claims a message id. True the first time, false for a repeat.
 *
 * Meta retries deliveries and can send the same event twice; without this, one
 * customer message becomes two replies. `ON CONFLICT DO NOTHING` makes the
 * claim atomic, which matters because the two deliveries frequently land in
 * two different serverless instances at the same moment.
 *
 * Errs on the side of answering: if the claim query itself fails, we treat the
 * event as new. A duplicate reply is a nuisance; silence is a lost customer.
 */
export async function claimEvent(mid: string): Promise<boolean> {
  if (!mid) return true
  try {
    const rows = await sql`
      INSERT INTO messenger_events (mid) VALUES (${mid})
      ON CONFLICT (mid) DO NOTHING
      RETURNING mid
    `
    return rows.length > 0
  } catch (err) {
    console.error('messenger: could not claim event, processing anyway:', err)
    return true
  }
}

export interface MessengerSession {
  psid: string
  verified_order_id: number | null
  failed_attempts: number
  window_started_at: string
}

async function upsertSession(psid: string): Promise<MessengerSession> {
  const rows = await sql`
    INSERT INTO messenger_sessions (psid) VALUES (${psid})
    ON CONFLICT (psid) DO UPDATE SET updated_at = NOW()
    RETURNING psid, verified_order_id, failed_attempts, window_started_at
  `
  return rows[0] as MessengerSession
}

export type LookupResult =
  | { ok: true; order: TrackableOrder }
  | { ok: false; reason: 'not_found' | 'rate_limited' }

/**
 * Looks up an order for a chatter, if they can prove it is theirs.
 *
 * The email is the whole authorisation. `orders.id` is a SERIAL, so order
 * numbers are sequential and guessable — asking for #47 and getting an answer
 * would let anyone walk the table and read back other people's orders. Both
 * halves must match, the comparison is case-insensitive (people capitalise
 * their own addresses inconsistently), and failures are counted so the pair
 * cannot be brute-forced one email at a time.
 *
 * A success is remembered against the PSID so a follow-up question doesn't
 * re-interrogate the same person.
 */
export async function lookupOrder(psid: string, ref: OrderReference): Promise<LookupResult> {
  const session = await upsertSession(psid)
  if (isRateLimited(session)) return { ok: false, reason: 'rate_limited' }

  const rows = await sql`
    SELECT id, order_status, payment_status, payment_method, total, delivery_slots, created_at
    FROM orders
    WHERE id = ${ref.orderId} AND LOWER(email) = LOWER(${ref.email})
  `

  if (rows.length === 0) {
    // Window arithmetic in JS, not SQL: the neon() HTTP driver has no
    // SQL-fragment composition (see lib/stats.ts), so an INTERVAL built from a
    // constant would bind as a parameter rather than splice in. A fresh window
    // starts once the previous one has aged out, so an honest customer who
    // mistypes today isn't still locked out next week. Two simultaneous
    // messages could each read the same count and both write count+1 — a lost
    // increment on a rate limit is not worth a transaction.
    const { attempts, windowStartedAt } = nextAttemptWindow(session)
    await sql`
      UPDATE messenger_sessions
      SET failed_attempts = ${attempts}, window_started_at = ${windowStartedAt}, updated_at = NOW()
      WHERE psid = ${psid}
    `
    return { ok: false, reason: 'not_found' }
  }

  await sql`
    UPDATE messenger_sessions
    SET verified_order_id = ${ref.orderId}, failed_attempts = 0, window_started_at = NOW(), updated_at = NOW()
    WHERE psid = ${psid}
  `

  return { ok: true, order: rows[0] as TrackableOrder }
}

/** The order this chatter already proved, if any — for follow-up questions. */
export async function verifiedOrderFor(psid: string): Promise<TrackableOrder | null> {
  const rows = await sql`
    SELECT o.id, o.order_status, o.payment_status, o.payment_method, o.total, o.delivery_slots, o.created_at
    FROM messenger_sessions s
    JOIN orders o ON o.id = s.verified_order_id
    WHERE s.psid = ${psid}
  `
  return (rows[0] as TrackableOrder) ?? null
}
