import { NextRequest, NextResponse } from 'next/server'
import { geocodeWithFallback } from '@/lib/geocoding'

// Pre-fills the checkout map pin as the customer fills in Province/City/
// Barangay/Address — a convenience guess, not a source of truth. Tries the
// full address first, then falls back to barangay-level, then city-level, so
// the map always starts somewhere reasonable even when the specific lot/
// subdivision text can't be resolved (see lib/geocoding.ts). The customer
// confirms/drags the pin themselves; that confirmed position is what
// actually gets sent to Lalamove (see lib/lalamove.ts), not this guess.
export async function POST(request: NextRequest) {
  try {
    const { address, barangay, city, province, postalCode } = await request.json()
    if (!city || !province) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    const result = await geocodeWithFallback({ address, barangay, city, province, postalCode })
    return NextResponse.json({ coords: result?.coords ?? null, precision: result?.precision ?? null })
  } catch (err) {
    console.error('POST /api/geocode error:', err)
    return NextResponse.json({ coords: null, precision: null })
  }
}
