import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { sendOrderEmails } from '@/lib/email'
import { getShippingFee } from '@/lib/shippingQuote'
import { validateDeliverySlots } from '@/lib/deliverySlots'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { customer, items, subtotal, deliverySlots } = body

    if (!customer || !items?.length || subtotal == null) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    // Never trust the client on the slot rule (>=1 morning + >=1 afternoon) —
    // re-validate server-side, same discipline as order/payment status checks.
    const slotError = validateDeliverySlots(deliverySlots)
    if (slotError) {
      return NextResponse.json({ error: slotError }, { status: 400 })
    }

    // Authoritative shipping price — recomputed here regardless of anything
    // the client showed at checkout (same discipline as the rest of this
    // route: never trust client-supplied totals).
    const shippingQuote = await getShippingFee(
      {
        address: customer.address ?? '', barangay: customer.barangay || undefined,
        city: customer.city ?? '', province: customer.province ?? '', postalCode: customer.postalCode ?? '',
        lat: customer.lat, lng: customer.lng,
      },
      subtotal
    )
    const shipping = shippingQuote.fee
    const total = subtotal + shipping

    const rows = await sql`
      INSERT INTO orders (
        first_name, last_name, email, phone,
        address, barangay, city, province, postal_code, notes,
        items, subtotal, shipping, total,
        payment_method, payment_status, order_status,
        delivery_slots, shipping_source, shipping_distance_km,
        delivery_lat, delivery_lng
      ) VALUES (
        ${customer.firstName}, ${customer.lastName}, ${customer.email}, ${customer.phone ?? ''},
        ${customer.address ?? ''}, ${customer.barangay ?? ''}, ${customer.city ?? ''}, ${customer.province ?? ''}, ${customer.postalCode ?? ''}, ${customer.notes ?? ''},
        ${JSON.stringify(items)}, ${subtotal}, ${shipping}, ${total},
        'cod', 'unpaid', 'pending',
        ${deliverySlots}, ${shippingQuote.source}, ${shippingQuote.distanceKm},
        ${customer.lat ?? null}, ${customer.lng ?? null}
      )
      RETURNING id
    `

    const orderId: number = rows[0].id

    await sendOrderEmails({ orderId, customer, items, subtotal, shipping, total, deliverySlots }).catch(err =>
      console.error('Email send failed:', err)
    )

    return NextResponse.json({ orderId })
  } catch (err) {
    console.error('POST /api/orders error:', err)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}
