// Free-text → coordinates, via Nominatim (OpenStreetMap). No API key needed;
// fine at this project's order volume. Used two ways:
//  1. lib/lalamove.ts — best-effort dropoff geocode when the checkout map pin
//     hasn't been set (older orders, JS-disabled, etc).
//  2. app/api/geocode — pre-fills the checkout map so most customers don't
//     have to drag the pin at all, they just confirm/nudge it.
//
// Philippine subdivision-style addresses ("Blk 17 Lt 7 Zone 1 Bulihan") are
// exactly what this kind of free-text geocoding struggles with — that's the
// whole reason the checkout map pin exists as the reliable path, this is
// just the convenience pre-fill for it.

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'

export interface Coordinates {
  lat: number
  lng: number
}

export async function geocode(query: string): Promise<Coordinates | null> {
  const url = `${NOMINATIM_URL}?format=json&limit=1&countrycodes=ph&q=${encodeURIComponent(query)}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'MakeMyCoffee/1.0 (checkout shipping estimate; makemycoffee.cafe@gmail.com)' },
  })
  if (!res.ok) return null
  const results = await res.json()
  const hit = results?.[0]
  if (!hit?.lat || !hit?.lon) return null
  return { lat: Number(hit.lat), lng: Number(hit.lon) }
}

export type GeocodePrecision = 'address' | 'barangay' | 'city'

export interface GeocodeResult {
  coords: Coordinates
  precision: GeocodePrecision
}

interface AddressParts {
  address?: string
  barangay?: string
  city: string
  province: string
  postalCode?: string
}

// Progressively broadens the query — the exact lot/subdivision text is what
// most often fails to resolve ("Blk 17 Lt 7 Zone 1 Bulihan"), so rather than
// giving up and leaving the checkout map at its generic default, fall back to
// centering on the barangay, then the city, and let the customer place the
// precise pin themselves from there (components/DeliveryMapPicker.tsx shows
// the resulting precision so they know how much to trust the starting spot).
export async function geocodeWithFallback(parts: AddressParts): Promise<GeocodeResult | null> {
  if (parts.address?.trim()) {
    const full = [parts.address, parts.barangay && `Barangay ${parts.barangay}`, parts.city, parts.province, parts.postalCode, 'Philippines']
      .filter(Boolean)
      .join(', ')
    const coords = await geocode(full)
    if (coords) return { coords, precision: 'address' }
  }

  if (parts.barangay?.trim()) {
    const barangayQuery = [`Barangay ${parts.barangay}`, parts.city, parts.province, 'Philippines'].filter(Boolean).join(', ')
    const coords = await geocode(barangayQuery)
    if (coords) return { coords, precision: 'barangay' }
  }

  const cityQuery = [parts.city, parts.province, 'Philippines'].filter(Boolean).join(', ')
  const coords = await geocode(cityQuery)
  if (coords) return { coords, precision: 'city' }

  return null
}
