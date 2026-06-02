import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { sendOrderEmails } from '@/lib/email'
import { calcShipping } from '@/lib/shipping'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { customer, items, subtotal } = body

    if (!customer || !items?.length || subtotal == null) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const shipping = calcShipping(customer.city ?? '', subtotal)
    const total = subtotal + shipping

    const rows = await sql`
      INSERT INTO orders (
        first_name, last_name, email, phone,
        address, city, province, postal_code, notes,
        items, subtotal, shipping, total,
        payment_method, payment_status, order_status
      ) VALUES (
        ${customer.firstName}, ${customer.lastName}, ${customer.email}, ${customer.phone ?? ''},
        ${customer.address ?? ''}, ${customer.city ?? ''}, ${customer.province ?? ''}, ${customer.postalCode ?? ''}, ${customer.notes ?? ''},
        ${JSON.stringify(items)}, ${subtotal}, ${shipping}, ${total},
        'cod', 'unpaid', 'pending'
      )
      RETURNING id
    `

    const orderId: number = rows[0].id

    await sendOrderEmails({ orderId, customer, items, subtotal, shipping, total }).catch(err =>
      console.error('Email send failed:', err)
    )

    return NextResponse.json({ orderId })
  } catch (err) {
    console.error('POST /api/orders error:', err)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}
