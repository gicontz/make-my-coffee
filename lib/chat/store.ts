// Server-only state for the on-site chat. Schema in lib/migrations/0007.

import { sql } from '@/lib/db'
import type { OrderReference, TrackableOrder } from './conversation.ts'
import type { LookupOutcome } from './respond.ts'
import { isRateLimited, nextAttemptWindow } from './rateLimit.ts'
import { MAX_ASSISTANT_CALLS_PER_DAY, manilaDay, nextAssistantBudget } from './budget.ts'

export type ChatRole = 'visitor' | 'bot' | 'staff'

export interface ChatMessage {
  id: number
  role: ChatRole
  body: string
  created_at: string
}

export interface ChatSession {
  id: string
  visitor_id: string
  verified_order_id: number | null
  failed_attempts: number
  window_started_at: string
  assistant_calls: number
  assistant_day: string
  needs_human: boolean
}

/**
 * The session for a visitor cookie, created on first contact.
 *
 * `visitor_id` is ours, not Meta's — an anonymous web visitor has no PSID and
 * there is no API to mint one, which is the whole reason this table exists. It
 * proves nothing beyond "same browser", so it gates no order data on its own.
 */
export async function getOrCreateSession(visitorId: string): Promise<ChatSession> {
  const rows = await sql`
    INSERT INTO chat_sessions (visitor_id) VALUES (${visitorId})
    ON CONFLICT (visitor_id) DO UPDATE SET updated_at = NOW()
    RETURNING id, visitor_id, verified_order_id, failed_attempts,
              window_started_at, assistant_calls, assistant_day::text AS assistant_day, needs_human
  `
  return rows[0] as ChatSession
}

/** The existing session for a cookie, without creating one. */
export async function findSession(visitorId: string): Promise<ChatSession | null> {
  const rows = await sql`
    SELECT id, visitor_id, verified_order_id, failed_attempts,
           window_started_at, assistant_calls, assistant_day::text AS assistant_day, needs_human
    FROM chat_sessions WHERE visitor_id = ${visitorId}
  `
  return (rows[0] as ChatSession) ?? null
}

export async function appendMessage(sessionId: string, role: ChatRole, body: string): Promise<ChatMessage> {
  const rows = await sql`
    INSERT INTO chat_messages (session_id, role, body)
    VALUES (${sessionId}, ${role}, ${body})
    RETURNING id, role, body, created_at
  `
  await sql`
    UPDATE chat_sessions SET last_message_at = NOW(), updated_at = NOW() WHERE id = ${sessionId}
  `
  return rows[0] as ChatMessage
}

/** The transcript, or just what arrived after `afterId` when the widget polls. */
export async function messagesFor(sessionId: string, afterId = 0): Promise<ChatMessage[]> {
  const rows = await sql`
    SELECT id, role, body, created_at FROM chat_messages
    WHERE session_id = ${sessionId} AND id > ${afterId}
    ORDER BY id
  `
  return rows as ChatMessage[]
}

/**
 * Looks up an order for a conversation, if it can prove the order is its own.
 *
 * Identical rule to the Messenger path: `orders.id` is a SERIAL, so the number
 * alone would let anyone walk the table. Both halves must match, the email
 * comparison is case-insensitive, and failures are counted so the pair cannot
 * be brute-forced one address at a time.
 */
export async function lookupOrder(session: ChatSession, ref: OrderReference): Promise<LookupOutcome> {
  if (isRateLimited(session)) return { ok: false, reason: 'rate_limited' }

  const rows = await sql`
    SELECT id, order_status, payment_status, payment_method, total, delivery_slots, created_at
    FROM orders
    WHERE id = ${ref.orderId} AND LOWER(email) = LOWER(${ref.email})
  `

  if (rows.length === 0) {
    const { attempts, windowStartedAt } = nextAttemptWindow(session)
    await sql`
      UPDATE chat_sessions
      SET failed_attempts = ${attempts}, window_started_at = ${windowStartedAt}, updated_at = NOW()
      WHERE id = ${session.id}
    `
    return { ok: false, reason: 'not_found' }
  }

  await sql`
    UPDATE chat_sessions
    SET verified_order_id = ${ref.orderId}, failed_attempts = 0, window_started_at = NOW(), updated_at = NOW()
    WHERE id = ${session.id}
  `
  return { ok: true, order: rows[0] as TrackableOrder }
}

export async function verifiedOrderFor(sessionId: string): Promise<TrackableOrder | null> {
  const rows = await sql`
    SELECT o.id, o.order_status, o.payment_status, o.payment_method, o.total, o.delivery_slots, o.created_at
    FROM chat_sessions s
    JOIN orders o ON o.id = s.verified_order_id
    WHERE s.id = ${sessionId}
  `
  return (rows[0] as TrackableOrder) ?? null
}

/**
 * Claims one model call against both budgets. False means "answer from the
 * buttons instead" — never an error the visitor sees.
 *
 * The global ceiling is summed live rather than kept in its own counter: one
 * cheap aggregate beats a second table and a second thing to keep correct.
 */
export async function claimAssistantCall(session: ChatSession): Promise<boolean> {
  const today = manilaDay()
  const { calls, day, allowed } = nextAssistantBudget(session, today)
  if (!allowed) return false

  const totals = await sql`
    SELECT COALESCE(SUM(assistant_calls), 0)::int AS used
    FROM chat_sessions WHERE assistant_day = ${day}::date
  `
  if (Number(totals[0]?.used ?? 0) >= MAX_ASSISTANT_CALLS_PER_DAY) {
    console.warn('chat: global daily assistant budget spent — serving buttons only')
    return false
  }

  await sql`
    UPDATE chat_sessions
    SET assistant_calls = ${calls}, assistant_day = ${day}::date, updated_at = NOW()
    WHERE id = ${session.id}
  `
  return true
}

export async function markNeedsHuman(sessionId: string): Promise<void> {
  await sql`
    UPDATE chat_sessions SET needs_human = TRUE, updated_at = NOW() WHERE id = ${sessionId}
  `
}

// ── Staff inbox ───────────────────────────────────────────────────────────

export interface InboxRow {
  id: string
  needs_human: boolean
  last_message_at: string
  created_at: string
  message_count: number
  last_body: string
  verified_order_id: number | null
}

/** Conversations for /admin/chat — the ones needing a person come first. */
export async function listSessions(limit = 50): Promise<InboxRow[]> {
  const rows = await sql`
    SELECT s.id, s.needs_human, s.last_message_at, s.created_at, s.verified_order_id,
           COUNT(m.id)::int AS message_count,
           COALESCE((
             SELECT body FROM chat_messages WHERE session_id = s.id ORDER BY id DESC LIMIT 1
           ), '') AS last_body
    FROM chat_sessions s
    LEFT JOIN chat_messages m ON m.session_id = s.id
    GROUP BY s.id
    HAVING COUNT(m.id) > 0
    ORDER BY s.needs_human DESC, s.last_message_at DESC
    LIMIT ${limit}
  `
  return rows as InboxRow[]
}

/** A staff reply clears the flag — someone has now picked it up. */
export async function appendStaffReply(sessionId: string, body: string): Promise<ChatMessage> {
  const message = await appendMessage(sessionId, 'staff', body)
  await sql`
    UPDATE chat_sessions SET needs_human = FALSE, updated_at = NOW() WHERE id = ${sessionId}
  `
  return message
}
