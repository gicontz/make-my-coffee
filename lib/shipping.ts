// Pure, client-safe shipping logic — no network calls, no secrets. Safe to
// import from both server code and the 'use client' checkout page.
//
// The free-shipping promo (Pasig, subtotal >= ₱888) is decided here. The
// live, distance-based Lalamove price is computed by the server-only
// lib/shippingQuote.ts (kept separate on purpose — it imports lib/lalamove.ts,
// which uses Node `crypto` and calls out to Lalamove/Nominatim with API
// secrets, none of which may end up in a browser bundle).

export const FLAT_SHIPPING_FEE = 99

// Exported so customer-facing copy (the chat bot, the model's system prompt)
// can state the promo without restating the numbers — copy that repeats a
// value goes stale silently, and nobody notices until someone is quoted wrong.
export const FREE_SHIPPING_CITY = 'pasig'
// Set against the actual basket totals, not to a round number. The three
// cheapest multi-bottle baskets land in a tight cluster — ₱897 (Starter ×3),
// ₱898 (Starter + Reserve, and Classic ×2) — and the next one up is ₱1,047.
// A ₱1,000 line therefore caught none of them and pushed people toward a pair
// they did not want; ₱899 would have missed the same cluster by a single peso.
// ₱888 clears all three with room to spare, and reads well in PH promo copy.
//
// ⚠️ This number is tuned to lib/products.ts. Change a bottle price and
// re-check it against tests/shipping.test.ts, which pins the cluster.
export const FREE_SHIPPING_MIN_SUBTOTAL = 888

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
