// Customer reviews — the pure half. Schema in lib/migrations/0009; the
// database half is lib/reviewStore.ts.
//
// Relative imports with extensions, like lib/email.ts, so tests/reviews.test.ts
// can load this under `node --experimental-strip-types`.
//
// ⚠️ HARD RULE: never seed, write or invent a review. Nothing in this codebase
// creates a review row except POST /api/reviews, on behalf of a customer
// holding the token from their own delivered order. Fabricated reviews on a
// food product are a trust problem and, under PH consumer-protection rules, a
// legal one. An empty review section is honest; a fake one is not recoverable.
// tests/reviews.test.ts fails on any INSERT into `reviews` outside that route.

import { products } from './products.ts'
import { siteUrl } from './siteUrl.ts'

/** Mirrors the CHECK constraints in migration 0009 — the test pins the pair. */
export const REVIEW_BODY_MAX = 1000
export const DISPLAY_NAME_MAX = 40

// ── Tokens ────────────────────────────────────────────────────────────────
//
// The link in the delivered email carries 256 random bits, never the order
// number: `orders.id` is a SERIAL, so anything keyed on it lets a stranger
// walk the table. Only a SHA-256 of the token is stored, so read access to
// the database is not write access to anyone's review.
//
// The token rides in the URL *fragment* (/review#<token>). Browsers never send
// a fragment to a server or put it in a Referer, so it stays out of Vercel's
// request logs and out of the page_location every analytics tag reports; the
// page reads it, strips it from the address bar, and POSTs it.

const TOKEN_BYTES = 32
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

// btoa and plain hex rather than Buffer: this module is also imported by the
// review form for its limits, and Buffer would pull a polyfill into the page.
export function newReviewToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES))
  return btoa(String.fromCharCode(...Array.from(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Cheap shape check before touching the database. */
export function isReviewTokenShape(value: unknown): value is string {
  return typeof value === 'string' && TOKEN_PATTERN.test(value)
}

export async function hashReviewToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
}

export function reviewUrl(token: string): string {
  return `${siteUrl()}/review#${token}`
}

// ── Input ─────────────────────────────────────────────────────────────────

export interface ReviewInput {
  rating: number
  body: string
  displayName: string
}

export type ReviewInputResult = { ok: true; value: ReviewInput } | { ok: false; error: string }

/** Code points, which is what Postgres char_length counts — not UTF-16 units. */
function charLength(s: string): number {
  return Array.from(s).length
}

// Control characters other than newline and tab have no business in a review,
// and a stray one can break the JSON-LD a search engine parses.
function clean(s: string): string {
  return s.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '')
}

export function validateReviewInput(raw: unknown): ReviewInputResult {
  const input = (raw ?? {}) as Record<string, unknown>

  const rating = input.rating
  if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: 'Please choose a rating from 1 to 5 stars.' }
  }

  const body = typeof input.body === 'string' ? clean(input.body).trim().replace(/\n{3,}/g, '\n\n') : ''
  if (!body) return { ok: false, error: 'Please write a few words about your order.' }
  if (charLength(body) > REVIEW_BODY_MAX) {
    return { ok: false, error: `Please keep your review under ${REVIEW_BODY_MAX} characters.` }
  }

  const displayName = typeof input.displayName === 'string' ? clean(input.displayName).replace(/\s+/g, ' ').trim() : ''
  if (!displayName) return { ok: false, error: 'Please add the name to show with your review.' }
  if (charLength(displayName) > DISPLAY_NAME_MAX) {
    return { ok: false, error: `Please keep the name under ${DISPLAY_NAME_MAX} characters.` }
  }

  return { ok: true, value: { rating, body, displayName } }
}

/**
 * "Juan D." — the suggestion the form pre-fills. The customer can change it;
 * this only keeps the default from publishing a full surname nobody chose to.
 */
export function defaultDisplayName(firstName: string, lastName: string): string {
  const first = firstName.trim()
  const initial = Array.from(lastName.trim())[0]
  const name = initial ? `${first} ${initial.toUpperCase()}.` : first
  return Array.from(name).slice(0, DISPLAY_NAME_MAX).join('')
}

/**
 * The bottles an order contained, as catalog ids in catalog order.
 *
 * Read from the `orders.items` snapshot. Anything that isn't a current
 * product drops out rather than pinning a review to a page that doesn't exist.
 */
export function productIdsFromItems(items: unknown): string[] {
  if (!Array.isArray(items)) return []
  const ordered = new Set(items.map(i => (i as { id?: unknown })?.id).filter((id): id is string => typeof id === 'string'))
  return products.map(p => p.id).filter(id => ordered.has(id))
}

// ── Display ───────────────────────────────────────────────────────────────

export interface PublishedReview {
  id: number
  rating: number
  body: string
  display_name: string
  created_at: string
}

export interface RatingSummary {
  count: number
  /** One decimal place — "4.7", never "4.666…". */
  average: number
}

/** null for no reviews: there is no such thing as an average of nothing. */
export function summariseRatings(ratings: number[]): RatingSummary | null {
  if (ratings.length === 0) return null
  const total = ratings.reduce((sum, r) => sum + r, 0)
  return { count: ratings.length, average: Math.round((total / ratings.length) * 10) / 10 }
}

/** The calendar day in Manila, YYYY-MM-DD — the shop's day, not the server's. */
export function reviewDate(createdAt: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date(createdAt))
}

/** "October 2026" — enough to show the review is recent, no more. */
export function reviewMonth(createdAt: string): string {
  return new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'long', year: 'numeric' }).format(new Date(createdAt))
}

/**
 * `aggregateRating` and `review` for a Product's JSON-LD — or nothing at all.
 *
 * The empty object for no reviews is the point: a Product with a zero-count
 * AggregateRating, or one invented to fill the slot, is a claim with nothing
 * behind it. Spread the result into the Product; with no reviews it adds no
 * keys.
 *
 * `summary` covers every approved review for the product; `shown` is the
 * subset rendered on the page, and only those are marked up individually —
 * structured data must describe what a visitor can actually see.
 */
export function productReviewLd(summary: RatingSummary | null, shown: PublishedReview[]): Record<string, unknown> {
  if (!summary || shown.length === 0) return {}
  return {
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: summary.average,
      reviewCount: summary.count,
      bestRating: 5,
      worstRating: 1,
    },
    review: shown.map(r => ({
      '@type': 'Review',
      author: { '@type': 'Person', name: r.display_name },
      datePublished: reviewDate(r.created_at),
      reviewBody: r.body,
      reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
    })),
  }
}
