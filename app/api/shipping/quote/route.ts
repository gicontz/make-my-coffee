import { NextRequest, NextResponse } from 'next/server'
import { getShippingFee } from '@/lib/shippingQuote'

// Checkout-preview only — shows the customer a live number as they type their
// address. Not authoritative: POST /api/orders recomputes this itself before
// inserting, so a tampered/stale client value here can't change what's charged.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { address, barangay, city, province, postalCode, subtotal, lat, lng } = body

    if (!city || subtotal == null) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const quote = await getShippingFee(
      { address: address ?? '', barangay: barangay || undefined, city, province: province ?? '', postalCode: postalCode ?? '', lat, lng },
      subtotal
    )
    return NextResponse.json(quote)
  } catch (err) {
    console.error('POST /api/shipping/quote error:', err)
    return NextResponse.json({ error: 'Failed to get shipping quote' }, { status: 500 })
  }
}
