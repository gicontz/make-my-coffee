import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { isAdminAuthenticated } from '@/lib/session'
import { validateVoucherInput } from '@/lib/voucherInput'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const rows = await sql`SELECT * FROM vouchers ORDER BY created_at DESC`
    return NextResponse.json(rows)
  } catch (err) {
    console.error('GET /api/admin/vouchers error:', err)
    return NextResponse.json({ error: 'Failed to load vouchers' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const parsed = validateVoucherInput(await request.json())
    if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 })
    const v = parsed.values!

    const rows = await sql`
      INSERT INTO vouchers (
        code, description, discount_type, discount_value, max_discount,
        min_subtotal, max_redemptions, once_per_email, starts_at, expires_at, is_active
      ) VALUES (
        ${v.code}, ${v.description}, ${v.discountType}, ${v.discountValue}, ${v.maxDiscount},
        ${v.minSubtotal}, ${v.maxRedemptions}, ${v.oncePerEmail}, ${v.startsAt}, ${v.expiresAt}, ${v.isActive}
      )
      RETURNING *
    `
    return NextResponse.json(rows[0], { status: 201 })
  } catch (err) {
    if (err instanceof Error && /unique|duplicate/i.test(err.message)) {
      return NextResponse.json({ error: 'A voucher with that code already exists.' }, { status: 409 })
    }
    console.error('POST /api/admin/vouchers error:', err)
    return NextResponse.json({ error: 'Failed to create voucher' }, { status: 500 })
  }
}
