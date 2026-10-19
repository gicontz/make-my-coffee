// Server-only state for weekly subscriptions (#38). Schema in
// lib/migrations/0013; the pure rules are lib/subscriptions.ts.
//
// ⚠️ Nothing here creates a subscription. Sign-up waits on billing — see the
// header of lib/subscriptions.ts and decision.md D16.

import { sql } from '@/lib/db'
import { slotLabel } from '@/lib/deliverySlots'
import { deriveLinkToken, hashLinkToken } from '@/lib/linkToken'
import { priceOrderItems } from '@/lib/products'
import {
  applySubscriptionAction,
  manageTokenMessage,
  subscriptionDiscount,
  upcomingDelivery,
  type SubscriptionAction,
  type SubscriptionStatus,
  type SubscriptionView,
} from '@/lib/subscriptions'

// ── Manage link ───────────────────────────────────────────────────────────

/**
 * Required, with no dev fallback: a default secret would make every manage
 * link forgeable by anyone who has read this public repository.
 */
function linkSecret(): string {
  const secret = process.env.SUBSCRIPTION_LINK_SECRET
  if (!secret) throw new Error('SUBSCRIPTION_LINK_SECRET is not set')
  return secret
}

/**
 * The token for a subscription's manage link — the same one every time for
 * the same version, so each weekly email can carry it. Pair with
 * subscriptionManageUrl(). The row stores hashLinkToken() of this.
 */
export async function manageToken(subscriptionId: number, version: number): Promise<string> {
  return deriveLinkToken(linkSecret(), manageTokenMessage(subscriptionId, version))
}

// ── What the manage page sees ─────────────────────────────────────────────

interface Row {
  id: number
  first_name: string
  items: unknown
  delivery_slots: string[]
  status: SubscriptionStatus
  next_delivery_date: string
}

function toView(row: Row, now: Date): SubscriptionView {
  // Priced from the catalog on every read, like every order (D12) — the row
  // stores ids and quantities only. A bottle that has left the catalog fails
  // the whole basket; show an empty one rather than a partial figure.
  const priced = priceOrderItems(row.items)
  const subtotal = priced?.subtotal ?? 0
  return {
    firstName: row.first_name,
    status: row.status,
    nextDeliveryDate: upcomingDelivery({ status: row.status, nextDeliveryDate: row.next_delivery_date }, now),
    slotLabels: (row.delivery_slots ?? []).map(slotLabel),
    items: priced?.items.map(({ name, quantity }) => ({ name, quantity })) ?? [],
    subtotal,
    discount: subscriptionDiscount(subtotal),
  }
}

async function findByToken(token: string): Promise<Row | null> {
  const hash = await hashLinkToken(token)
  const rows = await sql`
    SELECT id, first_name, items, delivery_slots, status, next_delivery_date::text AS next_delivery_date
    FROM subscriptions
    WHERE manage_token_hash = ${hash}
  `
  return (rows[0] as Row | undefined) ?? null
}

export async function viewSubscription(token: string, now = new Date()): Promise<SubscriptionView | null> {
  const row = await findByToken(token)
  return row ? toView(row, now) : null
}

// ── The customer's controls ───────────────────────────────────────────────

export type ActOutcome =
  | { kind: 'ok'; view: SubscriptionView }
  | { kind: 'not-found' }
  | { kind: 'refused'; error: string }
  /** Something else changed the row between our read and our write. */
  | { kind: 'conflict' }

/**
 * Pause, resume, skip or cancel, decided by applySubscriptionAction() and
 * written only if the row is still what that decision was made against.
 *
 * The WHERE re-checks status *and* next_delivery_date: the order run advances
 * the date when it turns a delivery into an order, and a skip computed against
 * the old date would otherwise land a week off. A lost race is reported, not
 * retried — the page reloads and the customer sees what actually happened.
 */
export async function actOnSubscription(
  token: string,
  action: SubscriptionAction,
  now = new Date(),
): Promise<ActOutcome> {
  const row = await findByToken(token)
  if (!row) return { kind: 'not-found' }

  const result = applySubscriptionAction(
    { status: row.status, nextDeliveryDate: row.next_delivery_date },
    action,
    now,
  )
  if (!result.ok) return { kind: 'refused', error: result.error }
  if (!result.changed) return { kind: 'ok', view: toView(row, now) }

  const next = result.value
  const pausing = next.status === 'paused'
  const resuming = row.status === 'paused' && next.status === 'active'
  const cancelling = next.status === 'cancelled'

  const rows = await sql`
    UPDATE subscriptions SET
      status             = ${next.status},
      next_delivery_date = ${next.nextDeliveryDate},
      paused_at          = CASE WHEN ${pausing}::boolean THEN NOW()
                                WHEN ${resuming}::boolean THEN NULL
                                ELSE paused_at END,
      cancelled_at       = CASE WHEN ${cancelling}::boolean THEN NOW() ELSE cancelled_at END,
      updated_at         = NOW()
    WHERE id = ${row.id}
      AND status = ${row.status}
      AND next_delivery_date = ${row.next_delivery_date}
    RETURNING id, first_name, items, delivery_slots, status, next_delivery_date::text AS next_delivery_date
  `
  const updated = rows[0] as Row | undefined
  return updated ? { kind: 'ok', view: toView(updated, now) } : { kind: 'conflict' }
}
