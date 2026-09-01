import { NextRequest, NextResponse } from 'next/server'
import { findVoucherByCode, hasRedeemedByEmail } from '@/lib/voucherStore'
import { applyVoucher, isValidCode } from '@/lib/vouchers'

// Checkout-preview only — lets the customer see what a code is worth before
// they submit. Not authoritative: POST /api/orders re-resolves the voucher and
// re-prices it at insert time, and takes the redemption slot atomically there,
// so a tampered or stale value here can't change what's charged (same
// discipline as POST /api/shipping/quote — decision.md D3/D9).
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { code, subtotal, email } = await request.json()

    if (typeof code !== 'string' || !isValidCode(code)) {
      return NextResponse.json({ error: 'Enter a valid voucher code.' }, { status: 400 })
    }
    if (typeof subtotal !== 'number' || !Number.isFinite(subtotal) || subtotal < 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const voucher = await findVoucherByCode(code)
    // Deliberately the same message for "no such code" and "deactivated" — an
    // inactive voucher shouldn't be distinguishable from a nonexistent one.
    if (!voucher || !voucher.is_active) {
      return NextResponse.json({ error: 'That voucher code isn’t valid.' }, { status: 404 })
    }

    const result = applyVoucher(voucher, subtotal)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 })

    // Advisory only — the unique index in claimVoucher() is what actually
    // enforces this. Checking here just avoids letting the customer get all
    // the way to "Place Order" before finding out.
    if (voucher.once_per_email && typeof email === 'string' && email.trim()) {
      if (await hasRedeemedByEmail(voucher.id, email)) {
        return NextResponse.json({ error: 'You’ve already used this voucher.' }, { status: 422 })
      }
    }

    return NextResponse.json(result.applied)
  } catch (err) {
    console.error('POST /api/vouchers/validate error:', err)
    return NextResponse.json({ error: 'Failed to check voucher' }, { status: 500 })
  }
}
