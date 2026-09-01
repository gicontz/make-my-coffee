import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { sendOrderEmails } from '@/lib/email'
import { getShippingFee } from '@/lib/shippingQuote'
import { validateDeliverySlots } from '@/lib/deliverySlots'
import { priceOrderItems } from '@/lib/products'
import { applyVoucher, type AppliedVoucher } from '@/lib/vouchers'
import { attachOrder, claimVoucher, findVoucherByCode, releaseVoucher } from '@/lib/voucherStore'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { customer, items, deliverySlots, voucherCode } = body

    if (!customer) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    // Every peso on this order is derived from lib/products.ts, never from the
    // request. The posted `subtotal` is ignored outright: it feeds the voucher
    // minimum-spend rule and the percentage math, so trusting it would let a
    // tampered cart unlock vouchers it doesn't qualify for and inflate a
    // percentage discount at will.
    const priced = priceOrderItems(items)
    if (!priced) {
      return NextResponse.json({ error: 'Your cart is no longer valid. Please review it and try again.' }, { status: 400 })
    }
    const { items: pricedItems, subtotal } = priced

    // Never trust the client on the slot rule (>=1 morning + >=1 afternoon) —
    // re-validate server-side, same discipline as order/payment status checks.
    const slotError = validateDeliverySlots(deliverySlots)
    if (slotError) {
      return NextResponse.json({ error: slotError }, { status: 400 })
    }

    // Authoritative shipping price — recomputed here regardless of anything
    // the client showed at checkout (same discipline as the rest of this
    // route: never trust client-supplied totals).
    //
    // Note this prices against the *pre-discount* subtotal, so the free-Pasig
    // ₱1000 threshold (D3) is judged on what the customer actually put in the
    // cart. A voucher can only ever make delivery cheaper, never dearer.
    const shippingQuote = await getShippingFee(
      {
        address: customer.address ?? '', barangay: customer.barangay || undefined,
        city: customer.city ?? '', province: customer.province ?? '', postalCode: customer.postalCode ?? '',
        lat: customer.lat, lng: customer.lng,
      },
      subtotal
    )

    // Authoritative voucher resolution — the code is re-looked-up and
    // re-priced here, and the redemption slot is only taken at this point.
    // Whatever /api/vouchers/validate told the checkout page is a preview.
    let applied: AppliedVoucher | null = null
    let voucherId: number | null = null
    let redemptionId: number | null = null

    if (typeof voucherCode === 'string' && voucherCode.trim()) {
      const voucher = await findVoucherByCode(voucherCode)
      if (!voucher || !voucher.is_active) {
        return NextResponse.json({ error: 'That voucher code isn’t valid.' }, { status: 422 })
      }

      const result = applyVoucher(voucher, subtotal)
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 })

      // Total pesos forgone, recorded on the redemption for reporting: the
      // subtotal discount plus any delivery fee the voucher waives.
      const forgone = result.applied.discount + (result.applied.freeShipping ? shippingQuote.fee : 0)

      const claim = await claimVoucher(voucher, customer.email ?? '', forgone)
      if ('error' in claim) return NextResponse.json({ error: claim.error }, { status: 409 })

      applied = result.applied
      voucherId = voucher.id
      redemptionId = claim.redemptionId
    }

    const discount = applied?.discount ?? 0
    const shipping = applied?.freeShipping ? 0 : shippingQuote.fee
    const total = subtotal - discount + shipping

    let orderId: number
    try {
      const rows = await sql`
        INSERT INTO orders (
          first_name, last_name, email, phone,
          address, barangay, city, province, postal_code, notes,
          items, subtotal, discount, shipping, total,
          voucher_id, voucher_code,
          payment_method, payment_status, order_status,
          delivery_slots, shipping_source, shipping_distance_km,
          delivery_lat, delivery_lng
        ) VALUES (
          ${customer.firstName}, ${customer.lastName}, ${customer.email}, ${customer.phone ?? ''},
          ${customer.address ?? ''}, ${customer.barangay ?? ''}, ${customer.city ?? ''}, ${customer.province ?? ''}, ${customer.postalCode ?? ''}, ${customer.notes ?? ''},
          ${JSON.stringify(pricedItems)}, ${subtotal}, ${discount}, ${shipping}, ${total},
          ${voucherId}, ${applied?.code ?? ''},
          'cod', 'unpaid', 'pending',
          ${deliverySlots}, ${shippingQuote.source}, ${shippingQuote.distanceKm},
          ${customer.lat ?? null}, ${customer.lng ?? null}
        )
        RETURNING id
      `
      orderId = rows[0].id as number
    } catch (err) {
      // The redemption slot was taken a moment ago for an order that now
      // doesn't exist — hand it back rather than burning it, otherwise a
      // failed insert permanently consumes one use of a capped voucher.
      if (voucherId != null && redemptionId != null) {
        await releaseVoucher(voucherId, redemptionId).catch(releaseErr =>
          console.error('Failed to release voucher claim after order insert failed:', releaseErr)
        )
      }
      throw err
    }

    if (redemptionId != null) {
      await attachOrder(redemptionId, orderId).catch(err =>
        console.error('Failed to attach order to voucher redemption:', err)
      )
    }

    await sendOrderEmails({
      orderId, customer, items: pricedItems, subtotal, discount, shipping, total,
      deliverySlots, voucher: applied,
    }).catch(err => console.error('Email send failed:', err))

    return NextResponse.json({ orderId })
  } catch (err) {
    console.error('POST /api/orders error:', err)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}
