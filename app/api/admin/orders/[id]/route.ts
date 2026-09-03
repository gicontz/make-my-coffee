import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { isPaymentMethod } from '@/lib/paymentMethods'

const VALID_ORDER_STATUSES = ['pending', 'approved', 'shipped', 'delivered', 'cancelled']
const VALID_PAYMENT_STATUSES = ['unpaid', 'paid']

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const body = await request.json()
  const { order_status, payment_status, payment_method } = body

  if (order_status !== undefined) {
    if (!VALID_ORDER_STATUSES.includes(order_status)) {
      return NextResponse.json({ error: 'Invalid order_status' }, { status: 400 })
    }
    await sql`
      UPDATE orders SET order_status = ${order_status}, updated_at = NOW() WHERE id = ${id}
    `
  }

  if (payment_status !== undefined) {
    if (!VALID_PAYMENT_STATUSES.includes(payment_status)) {
      return NextResponse.json({ error: 'Invalid payment_status' }, { status: 400 })
    }
    // paid_at is the instant payment was actually recorded, not when the order
    // was placed — that's what lets lib/stats.ts bucket collected revenue by
    // the day cash actually came in instead of the day the order was made.
    // Toggling back to unpaid (an admin correcting a mis-click) clears it
    // rather than leaving a stale timestamp on an order that's unpaid again.
    //
    // Two branches, not one query with an interpolated NOW()/NULL: the neon()
    // HTTP driver has no SQL-fragment composition (see lib/stats.ts), so
    // `${sql\`NOW()\`}` would bind as a parameter, not splice in as SQL.
    if (payment_status === 'paid') {
      // Every order is inserted with payment_method = 'cod' as a placeholder
      // (there's no live online gateway to report a real one at checkout
      // time), but the cash that actually shows up can be COD, GCash, Maya or
      // a bank transfer — whichever the admin and customer settled on. So
      // marking an order paid requires a real method rather than trusting the
      // placeholder.
      if (!isPaymentMethod(payment_method)) {
        return NextResponse.json({ error: 'payment_method is required when marking an order paid' }, { status: 400 })
      }
      await sql`
        UPDATE orders SET payment_status = 'paid', payment_method = ${payment_method}, paid_at = NOW(), updated_at = NOW() WHERE id = ${id}
      `
    } else {
      await sql`
        UPDATE orders SET payment_status = 'unpaid', paid_at = NULL, updated_at = NOW() WHERE id = ${id}
      `
    }
  }

  const rows = await sql`SELECT * FROM orders WHERE id = ${id}`
  return NextResponse.json(rows[0])
}
