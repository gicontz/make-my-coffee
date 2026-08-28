// Server-only orchestrator: prices a delivery using a live Lalamove
// quotation when possible, the flat rate otherwise.
//
// Deliberately kept out of lib/shipping.ts (which the 'use client' checkout
// page also imports) because this pulls in lib/lalamove.ts — Node `crypto`
// plus calls to Lalamove/Nominatim with API secrets — none of which may ever
// reach a browser bundle. Only import this from server code (route handlers).

import { getLalamoveQuote } from './lalamove'
import { FLAT_SHIPPING_FEE, isFreeShippingEligible, type DeliveryAddress, type ShippingQuote } from './shipping'

// Single source of truth for what a delivery actually costs — called both by
// the checkout preview (app/api/shipping/quote) and, authoritatively, by
// POST /api/orders. Never trust a client-supplied fee; always recompute here
// at order-creation time.
export async function getShippingFee(dest: DeliveryAddress, subtotal: number): Promise<ShippingQuote> {
  if (isFreeShippingEligible(dest.city, subtotal)) {
    return { fee: 0, source: 'flat', distanceKm: null }
  }

  try {
    const quote = await getLalamoveQuote(dest)
    if (quote) return { fee: quote.fee, source: 'lalamove', distanceKm: quote.distanceKm }
  } catch (err) {
    console.error('Lalamove quote failed, falling back to flat rate:', err)
  }

  return { fee: FLAT_SHIPPING_FEE, source: 'flat', distanceKm: null }
}
