// Server-only persistence for email signups (#39). The rules — consent
// wording, code format, reminder timing — are pure, in lib/subscribe.ts.
//
// The Neon HTTP driver has no interactive transactions, so every step that
// must happen once (issue a code, send the welcome, send a reminder) is a
// guarded UPDATE ... RETURNING claim, same pattern as claimVoucher().

import { randomBytes } from 'node:crypto'
import { sql } from '@/lib/db'
import { sendWelcomeEmail } from '@/lib/email'
import {
  MAX_SIGNUPS_PER_DAY,
  SIGNUP_CONSENT,
  WELCOME_DISCOUNT,
  WELCOME_VOUCHER_DESCRIPTION,
  emailKey,
  generateWelcomeCode,
  oldestDeliveryStillDue,
  welcomeVoucherWindow,
  type SignupSource,
  type SubscriberSummary,
} from '@/lib/subscribe'
import { manilaDay } from '@/lib/deliveryDate'

interface SubscriberRow {
  id: number
  email: string
  unsubscribed_at: string | null
  unsubscribe_token: string
  voucher_id: number | null
  welcome_sent_at: string | null
}

/**
 * - `subscribed`   — a new address; the welcome code has been sent.
 * - `existing`     — already on the list, or back on it after unsubscribing.
 *                    No second code either way.
 * - `busy`         — the daily ceiling is reached; nothing was stored.
 *
 * The route answers all but `busy` identically, so the form can't be used to
 * find out whether an address is already a subscriber.
 */
export type SubscribeOutcome = 'subscribed' | 'existing' | 'busy'

export async function subscribe(rawEmail: string, source: SignupSource): Promise<SubscribeOutcome> {
  const email = rawEmail.trim()
  const key = emailKey(email)

  const inserted = (await sql`
    INSERT INTO email_subscribers (email, email_key, source, consent_text, unsubscribe_token)
    SELECT ${email}, ${key}, ${source}, ${SIGNUP_CONSENT}, ${newToken()}
     WHERE (SELECT count(*) FROM email_subscribers WHERE created_at > NOW() - INTERVAL '1 day') < ${MAX_SIGNUPS_PER_DAY}
    ON CONFLICT (email_key) DO NOTHING
    RETURNING id, email, unsubscribed_at, unsubscribe_token, voucher_id, welcome_sent_at
  `) as SubscriberRow[]

  let row = inserted[0]
  let outcome: SubscribeOutcome = 'subscribed'

  if (!row) {
    const existing = (await sql`
      SELECT id, email, unsubscribed_at, unsubscribe_token, voucher_id, welcome_sent_at
        FROM email_subscribers WHERE email_key = ${key}
    `) as SubscriberRow[]
    // Not inserted and not there: the ceiling stopped it.
    if (!existing[0]) return 'busy'
    row = existing[0]
    outcome = 'existing'

    // Signing up again is a fresh agreement — record it, with today's wording.
    if (row.unsubscribed_at) {
      await sql`
        UPDATE email_subscribers
           SET unsubscribed_at = NULL, subscribed_at = NOW(), consent_text = ${SIGNUP_CONSENT}, source = ${source}
         WHERE id = ${row.id}
      `
    }
  }

  // Normally only true for a brand-new row. For an existing one it means an
  // earlier welcome never left (the send failed and was released), so the
  // re-signup is the customer asking for the code they never got.
  if (!row.welcome_sent_at) await sendWelcome(row)

  return outcome
}

/** 24 random bytes → 32 url-safe characters (see isUnsubscribeToken). */
function newToken(): string {
  return randomBytes(24).toString('base64url')
}

async function sendWelcome(row: SubscriberRow): Promise<void> {
  // Claim the send first, so two signups racing on one address mail it once.
  const claimed = await sql`
    UPDATE email_subscribers SET welcome_sent_at = NOW()
     WHERE id = ${row.id} AND welcome_sent_at IS NULL
    RETURNING id
  `
  if (claimed.length === 0) return

  try {
    const voucher = await ensureWelcomeVoucher(row)
    await sendWelcomeEmail({
      subscriberId: row.id,
      email: row.email,
      code: voucher.code,
      lastDay: voucher.lastDay,
      unsubscribeToken: row.unsubscribe_token,
    })
  } catch (err) {
    // Mail is fire-and-forget (decision.md D5) — the signup itself succeeded.
    // Release the claim so signing up again retries rather than the code
    // being lost for good.
    console.error('Welcome email failed:', err)
    await sql`UPDATE email_subscribers SET welcome_sent_at = NULL WHERE id = ${row.id}`.catch(releaseErr =>
      console.error('Failed to release welcome claim:', releaseErr)
    )
  }
}

interface WelcomeVoucher {
  code: string
  lastDay: string
}

async function ensureWelcomeVoucher(row: SubscriberRow): Promise<WelcomeVoucher> {
  if (row.voucher_id != null) {
    // expires_at is the Manila midnight *after* the last valid day (see
    // welcomeVoucherWindow), hence the - 1. Read as ::text: the driver turns a
    // DATE into a Date at the machine's local midnight, which is a day early
    // in Manila (CLAUDE.md, "Delivery date & time").
    const rows = await sql`
      SELECT code, ((expires_at AT TIME ZONE 'Asia/Manila')::date - 1)::text AS last_day
        FROM vouchers WHERE id = ${row.voucher_id}
    `
    if (rows[0]) return { code: rows[0].code as string, lastDay: rows[0].last_day as string }
  }

  const { lastDay, expiresAt } = welcomeVoucherWindow()

  // A collision in 8.5e11 is not going to happen twice; the loop is there so
  // it can't fail the signup the once it does.
  for (let attempt = 0; attempt < 5; attempt++) {
    const created = await sql`
      INSERT INTO vouchers (
        code, description, discount_type, discount_value,
        min_subtotal, max_redemptions, once_per_email, starts_at, expires_at, is_active, kind
      ) VALUES (
        ${generateWelcomeCode()}, ${WELCOME_VOUCHER_DESCRIPTION}, 'fixed', ${WELCOME_DISCOUNT},
        0, 1, FALSE, NOW(), ${expiresAt}, TRUE, 'welcome'
      )
      ON CONFLICT (code) DO NOTHING
      RETURNING id, code
    `
    if (created.length === 0) continue

    const voucherId = created[0].id as number
    await sql`UPDATE email_subscribers SET voucher_id = ${voucherId} WHERE id = ${row.id}`
    return { code: created[0].code as string, lastDay }
  }
  throw new Error('Could not generate a unique welcome code')
}

/** Unsubscribes the holder of `token`. False if no subscriber has it. */
export async function unsubscribe(token: string): Promise<boolean> {
  const rows = await sql`
    UPDATE email_subscribers
       SET unsubscribed_at = COALESCE(unsubscribed_at, NOW())
     WHERE unsubscribe_token = ${token}
    RETURNING id
  `
  return rows.length > 0
}

// ── Running-low reminders ─────────────────────────────────────────────────

export interface ReminderCandidate {
  orderId: number
  firstName: string
  email: string
  items: unknown
  deliveryDate: string
  unsubscribeToken: string
}

/**
 * Delivered orders that could be due a reminder today. The exact day is
 * decided in JS by reminderDueDate() — this only narrows the scan.
 *
 * - **Subscribed now**, matched on the address key. Consent is checked at
 *   send time, not order time: an unsubscribe yesterday stops today's email.
 * - **Delivered**, not merely shipped — the email says the order arrived.
 * - **Their latest order.** Anything placed since, short of cancelled, means
 *   they have already reordered, and a nudge to do it again is noise.
 * - **Not reminded already.**
 *
 * This reads customer names and addresses out of `orders` and so must never
 * be reachable from a public route; GET /api/cron/running-low is behind
 * CRON_SECRET for that reason.
 */
export async function reminderCandidates(now = new Date()): Promise<ReminderCandidate[]> {
  const today = manilaDay(now)
  const rows = await sql`
    SELECT o.id, o.first_name, o.email, o.items, o.delivery_date::text AS delivery_date, s.unsubscribe_token
      FROM orders o
      JOIN email_subscribers s
        ON s.email_key = lower(trim(o.email)) AND s.unsubscribed_at IS NULL
     WHERE o.order_status = 'delivered'
       AND o.reminder_sent_at IS NULL
       AND o.delivery_date BETWEEN ${oldestDeliveryStillDue(today)} AND ${today}
       AND NOT EXISTS (
             SELECT 1 FROM orders later
              WHERE lower(trim(later.email)) = s.email_key
                AND later.id <> o.id
                AND later.created_at > o.created_at
                AND later.order_status <> 'cancelled'
           )
  `
  return rows.map(r => ({
    orderId: Number(r.id),
    firstName: String(r.first_name ?? ''),
    email: String(r.email),
    items: r.items,
    // ::text, never the driver's Date — see "Delivery date & time" in CLAUDE.md.
    deliveryDate: String(r.delivery_date),
    unsubscribeToken: String(r.unsubscribe_token),
  }))
}

/** Takes the one reminder this order gets. False if another run took it. */
export async function claimReminder(orderId: number): Promise<boolean> {
  const rows = await sql`
    UPDATE orders SET reminder_sent_at = NOW()
     WHERE id = ${orderId} AND reminder_sent_at IS NULL
    RETURNING id
  `
  return rows.length > 0
}

/** Hands a claim back after a failed send, so tomorrow's run can retry it. */
export async function releaseReminder(orderId: number): Promise<void> {
  await sql`UPDATE orders SET reminder_sent_at = NULL WHERE id = ${orderId}`
}

// ── Admin summary ─────────────────────────────────────────────────────────

export async function subscriberSummary(): Promise<SubscriberSummary> {
  const [row] = await sql`
    SELECT
      (SELECT count(*) FROM email_subscribers WHERE unsubscribed_at IS NULL)     AS subscribed,
      (SELECT count(*) FROM email_subscribers WHERE unsubscribed_at IS NOT NULL) AS unsubscribed,
      (SELECT count(*) FROM vouchers WHERE kind = 'welcome')                     AS welcome_issued,
      (SELECT count(*) FROM vouchers WHERE kind = 'welcome' AND redemption_count > 0) AS welcome_redeemed,
      (SELECT count(*) FROM orders WHERE reminder_sent_at IS NOT NULL)          AS reminders_sent
  `
  return {
    subscribed: Number(row.subscribed),
    unsubscribed: Number(row.unsubscribed),
    welcomeIssued: Number(row.welcome_issued),
    welcomeRedeemed: Number(row.welcome_redeemed),
    remindersSent: Number(row.reminders_sent),
  }
}
