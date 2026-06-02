import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

const VALID_ORDER_STATUSES = ['pending', 'approved', 'shipped', 'delivered', 'cancelled']
const VALID_PAYMENT_STATUSES = ['unpaid', 'paid']

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const body = await request.json()
  const { order_status, payment_status } = body

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
    await sql`
      UPDATE orders SET payment_status = ${payment_status}, updated_at = NOW() WHERE id = ${id}
    `
  }

  const rows = await sql`SELECT * FROM orders WHERE id = ${id}`
  return NextResponse.json(rows[0])
}
