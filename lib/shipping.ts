// Pure, client-safe shipping logic — no network calls, no secrets. Safe to
// import from both server code and the 'use client' checkout page.
//
// The free-shipping promo (Pasig, subtotal >= ₱1000) is decided here. The
// live, distance-based Lalamove price is computed by the server-only
// lib/shippingQuote.ts (kept separate on purpose — it imports lib/lalamove.ts,
// which uses Node `crypto` and calls out to Lalamove/Nominatim with API
// secrets, none of which may end up in a browser bundle).

export const FLAT_SHIPPING_FEE = 99
const FREE_SHIPPING_CITY = 'pasig'
const FREE_SHIPPING_MIN_SUBTOTAL = 1000

function normalizeCity(city: string): string {
  return city.trim().toLowerCase().replace(/\s*city\s*$/i, '')
}

export function isFreeShippingEligible(city: string, subtotal: number): boolean {
  return normalizeCity(city) === FREE_SHIPPING_CITY && subtotal >= FREE_SHIPPING_MIN_SUBTOTAL
}

// Synchronous, always-available fallback rate — same value getShippingFee()
// (lib/shippingQuote.ts) falls back to when Lalamove/geocoding isn't available.
export function calcShipping(city: string, subtotal: number): number {
  return isFreeShippingEligible(city, subtotal) ? 0 : FLAT_SHIPPING_FEE
}

export interface DeliveryAddress {
  address: string
  barangay?: string
  city: string
  province: string
  postalCode: string
  // Customer-confirmed map pin (app/order/page.tsx). When present, this is
  // used as the Lalamove dropoff directly — skips free-text geocoding, which
  // struggles with PH subdivision-style addresses ("Blk 17 Lt 7 Zone 1 ...").
  lat?: number
  lng?: number
}

export interface ShippingQuote {
  fee: number
  source: 'lalamove' | 'flat'
  distanceKm: number | null
}
