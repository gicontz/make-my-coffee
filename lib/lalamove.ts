// Lalamove v3 API client — quotation only. This project does not book/dispatch
// riders through the API (see memory/decision.md D9); it only asks Lalamove to
// price a MOTORCYCLE delivery for the real pickup→dropoff distance, so checkout
// can charge an accurate fee instead of a flat guess. Fetching a quotation is
// free (Lalamove only charges when a quotation is turned into a booked order,
// which never happens here).
//
// Auth: HMAC-SHA256 per https://developers.lalamove.com — signs
//   "<timestamp>\r\n<METHOD>\r\n<path>\r\n\r\n<body>"
// with LALAMOVE_SECRET_KEY, sent as `Authorization: hmac <key>:<ts>:<sig>`.

import { createHmac, randomUUID } from 'crypto'
import type { DeliveryAddress } from './shipping'
import { geocode } from './geocoding'

const SANDBOX_BASE = 'https://rest.sandbox.lalamove.com'
const PRODUCTION_BASE = 'https://rest.lalamove.com'
const LANGUAGE = 'en_PH'
const SERVICE_TYPE = 'MOTORCYCLE'

function sign(timestamp: number, method: string, path: string, body: string): string {
  const secret = process.env.LALAMOVE_SECRET_KEY
  if (!secret) throw new Error('LALAMOVE_SECRET_KEY is not set')
  const raw = `${timestamp}\r\n${method}\r\n${path}\r\n\r\n${body}`
  return createHmac('sha256', secret).update(raw).digest('hex')
}

async function lalamoveRequest(method: string, path: string, body?: unknown): Promise<any> {
  const apiKey = process.env.LALAMOVE_API_KEY
  if (!apiKey) throw new Error('LALAMOVE_API_KEY is not set')

  const base = process.env.LALAMOVE_ENV === 'production' ? PRODUCTION_BASE : SANDBOX_BASE
  const timestamp = Date.now()
  const bodyStr = body ? JSON.stringify(body) : ''
  const signature = sign(timestamp, method, path, bodyStr)

  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `hmac ${apiKey}:${timestamp}:${signature}`,
      Market: process.env.LALAMOVE_MARKET || 'PH',
      'Request-ID': randomUUID(),
      'Content-Type': 'application/json',
    },
    body: bodyStr || undefined,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Lalamove ${method} ${path} failed: ${res.status} ${text}`)
  }
  return res.json()
}

export interface LalamoveQuote {
  fee: number
  distanceKm: number | null
}

// Returns null whenever a live quote can't be produced — pickup location not
// configured, dropoff coordinates unavailable, or no priceBreakdown in the
// response. Network/API errors are thrown, not swallowed here — the caller
// (lib/shippingQuote.ts) is the single place that decides to fall back to the
// flat rate, so that decision stays in one spot.
export async function getLalamoveQuote(dest: DeliveryAddress): Promise<LalamoveQuote | null> {
  const pickupLat = process.env.LALAMOVE_PICKUP_LAT
  const pickupLng = process.env.LALAMOVE_PICKUP_LNG
  const pickupAddress = process.env.LALAMOVE_PICKUP_ADDRESS
  if (!pickupLat || !pickupLng || !pickupAddress) {
    console.warn('Lalamove pickup location not configured (LALAMOVE_PICKUP_ADDRESS/LAT/LNG) — using flat shipping rate.')
    return null
  }

  const dropoffQuery = [dest.address, dest.barangay && `Barangay ${dest.barangay}`, dest.city, dest.province, dest.postalCode, 'Philippines']
    .filter(Boolean)
    .join(', ')

  // Prefer the customer's confirmed map pin (app/order/page.tsx) — free-text
  // geocoding routinely fails on PH subdivision-style addresses. Only fall
  // back to geocoding the typed address when no pin was set (e.g. JS-disabled
  // checkout, or an older client).
  const dropoff = dest.lat != null && dest.lng != null
    ? { lat: String(dest.lat), lng: String(dest.lng) }
    : await geocode(dropoffQuery).then(c => c && { lat: String(c.lat), lng: String(c.lng) })
  if (!dropoff) return null

  const data = await lalamoveRequest('POST', '/v3/quotations', {
    data: {
      serviceType: SERVICE_TYPE,
      language: LANGUAGE,
      stops: [
        { coordinates: { lat: pickupLat, lng: pickupLng }, address: pickupAddress },
        { coordinates: dropoff, address: dropoffQuery },
      ],
    },
  })

  const priceBreakdown = data?.data?.priceBreakdown
  const distance = data?.data?.distance
  if (!priceBreakdown?.total) return null

  return {
    fee: Math.round(Number(priceBreakdown.total)),
    distanceKm: distance?.value ? Number(distance.value) / 1000 : null,
  }
}
