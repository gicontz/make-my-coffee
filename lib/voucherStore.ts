// Server-only voucher persistence. Kept out of lib/vouchers.ts so the
// 'use client' checkout page can import the discount math without pulling
// @neondatabase/serverless into the browser bundle (same reasoning as
// lib/shippingQuote.ts vs lib/shipping.ts — decision.md D9).

import { sql } from '@/lib/db'
import { normalizeCode, type Voucher } from '@/lib/vouchers'

export async function findVoucherByCode(code: string): Promise<Voucher | null> {
  const rows = (await sql`
    SELECT * FROM vouchers WHERE code = ${normalizeCode(code)}
  `) as Voucher[]
  return rows[0] ?? null
}

// Only meaningful for once_per_email vouchers — used by the checkout preview
// endpoint to say "you've already used this" before the customer submits. The
// binding check is the unique index inside claimVoucher(); this is UX only.
export async function hasRedeemedByEmail(voucherId: number, email: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM voucher_redemptions
    WHERE voucher_id = ${voucherId} AND email_uniq = ${email.trim().toLowerCase()}
    LIMIT 1
  `
  return rows.length > 0
}

export interface ClaimResult {
  redemptionId: number
}

// Atomically takes one redemption slot. Everything checkVoucherRules() already
// verified is re-asserted here in the WHERE clause, because between the
// checkout preview and the order POST another customer may have taken the last
// slot or the window may have closed — and the peso value is decided by
// whoever wins that race, not by whoever asked first.
//
// The Neon HTTP driver has no interactive transactions, so this is a two-step
// compare-and-set: guarded increment, then the redemption insert whose unique
// index enforces once_per_email. If the insert loses, the increment is undone.
export async function claimVoucher(
  voucher: Voucher,
  email: string,
  // Total pesos forgone — subtotal discount plus any shipping waived. Recorded
  // for reporting; orders.discount stays the subtotal-only number so
  // total = subtotal - discount + shipping still holds.
  discount: number
): Promise<ClaimResult | { error: string }> {
  const claimed = await sql`
    UPDATE vouchers
       SET redemption_count = redemption_count + 1, updated_at = NOW()
     WHERE id = ${voucher.id}
       AND is_active
       AND (starts_at       IS NULL OR starts_at  <= NOW())
       AND (expires_at      IS NULL OR expires_at >  NOW())
       AND (max_redemptions IS NULL OR redemption_count < max_redemptions)
    RETURNING id
  `
  if (claimed.length === 0) {
    return { error: 'This voucher is no longer available.' }
  }

  // NULL for vouchers without the per-email rule — Postgres treats NULLs as
  // distinct in a unique index, so those rows never collide with each other.
  const emailUniq = voucher.once_per_email ? email.trim().toLowerCase() : null

  const inserted = await sql`
    INSERT INTO voucher_redemptions (voucher_id, email, email_uniq, discount)
    VALUES (${voucher.id}, ${email}, ${emailUniq}, ${discount})
    ON CONFLICT DO NOTHING
    RETURNING id
  `
  if (inserted.length === 0) {
    await releaseCount(voucher.id)
    return { error: 'You’ve already used this voucher.' }
  }

  return { redemptionId: inserted[0].id as number }
}

// Undoes a claim when the order it was for never made it into the table.
export async function releaseVoucher(voucherId: number, redemptionId: number): Promise<void> {
  await sql`DELETE FROM voucher_redemptions WHERE id = ${redemptionId}`
  await releaseCount(voucherId)
}

async function releaseCount(voucherId: number): Promise<void> {
  await sql`
    UPDATE vouchers
       SET redemption_count = GREATEST(redemption_count - 1, 0), updated_at = NOW()
     WHERE id = ${voucherId}
  `
}

export async function attachOrder(redemptionId: number, orderId: number): Promise<void> {
  await sql`UPDATE voucher_redemptions SET order_id = ${orderId} WHERE id = ${redemptionId}`
}
