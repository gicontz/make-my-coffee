import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { isAdminAuthenticated } from '@/lib/session'
import { validateVoucherInput } from '@/lib/voucherInput'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  try {
    const body = await request.json()

    // Two shapes on purpose: the list's activate/deactivate switch sends only
    // `is_active`, while the edit dialog sends the whole voucher. Treating the
    // toggle as a full edit would force the list to round-trip every field
    // just to flip a boolean.
    if (Object.keys(body).length === 1 && typeof body.is_active === 'boolean') {
      const rows = await sql`
        UPDATE vouchers SET is_active = ${body.is_active}, updated_at = NOW()
        WHERE id = ${id} RETURNING *
      `
      if (rows.length === 0) return NextResponse.json({ error: 'Voucher not found' }, { status: 404 })
      return NextResponse.json(rows[0])
    }

    const parsed = validateVoucherInput(body)
    if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 })
    const v = parsed.values!

    // redemption_count is deliberately never writable here — it's owned by
    // claimVoucher()/releaseVoucher() in lib/voucherStore.ts, and letting an
    // edit reset it would hand back already-spent redemption slots.
    const rows = await sql`
      UPDATE vouchers SET
        code            = ${v.code},
        description     = ${v.description},
        discount_type   = ${v.discountType},
        discount_value  = ${v.discountValue},
        max_discount    = ${v.maxDiscount},
        min_subtotal    = ${v.minSubtotal},
        max_redemptions = ${v.maxRedemptions},
        once_per_email  = ${v.oncePerEmail},
        starts_at       = ${v.startsAt},
        expires_at      = ${v.expiresAt},
        is_active       = ${v.isActive},
        updated_at      = NOW()
      WHERE id = ${id}
      RETURNING *
    `
    if (rows.length === 0) return NextResponse.json({ error: 'Voucher not found' }, { status: 404 })
    return NextResponse.json(rows[0])
  } catch (err) {
    if (err instanceof Error && /unique|duplicate/i.test(err.message)) {
      return NextResponse.json({ error: 'A voucher with that code already exists.' }, { status: 409 })
    }
    console.error('PATCH /api/admin/vouchers/[id] error:', err)
    return NextResponse.json({ error: 'Failed to update voucher' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  try {
    // A redeemed voucher is part of the order record — deleting it would
    // cascade its redemption rows away and null out orders.voucher_id, losing
    // the audit trail behind discounts already given. Deactivating stops it
    // being usable without rewriting history.
    const rows = (await sql`SELECT redemption_count FROM vouchers WHERE id = ${id}`) as { redemption_count: number }[]
    if (rows.length === 0) return NextResponse.json({ error: 'Voucher not found' }, { status: 404 })

    if (rows[0].redemption_count > 0) {
      return NextResponse.json(
        { error: 'This voucher has been redeemed and can’t be deleted. Deactivate it instead.' },
        { status: 409 }
      )
    }

    await sql`DELETE FROM vouchers WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/admin/vouchers/[id] error:', err)
    return NextResponse.json({ error: 'Failed to delete voucher' }, { status: 500 })
  }
}
