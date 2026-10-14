// Server-only state for customer reviews. Schema in lib/migrations/0010; the
// pure rules are lib/reviews.ts.
//
// ⚠️ Never seed, write or invent a review — see the header of lib/reviews.ts.
// submitReview() below is the only INSERT into `reviews`, and it inserts only
// for the holder of a delivered order's token.

import { neon } from '@neondatabase/serverless'
import { unstable_cache } from 'next/cache'
import { sql } from '@/lib/db'
import {
  defaultDisplayName,
  hashReviewToken,
  newReviewToken,
  productIdsFromItems,
  summariseRatings,
  type PublishedReview,
  type RatingSummary,
  type ReviewInput,
} from '@/lib/reviews'

/** How many reviews a product page renders (and marks up). */
export const REVIEWS_SHOWN = 10

/** The cache tag moderation revalidates. */
export const REVIEWS_TAG = 'reviews'

// ── Requests (the delivered email's link) ─────────────────────────────────

/**
 * Mints the token for an order's review link and stores its hash — once.
 *
 * Called on the `delivered` transition. If the order is marked delivered a
 * second time (delivered → shipped → delivered after a correction) this
 * returns null and that email goes out without the invitation: the first
 * link stays the working one. Rotating instead would be worse than it looks
 * — the repeat email carries the same Resend idempotency key
 * (`order-<id>-delivered`) and is dropped within 24h, so the customer would
 * be left holding only the link that rotation just killed. The raw token is
 * never stored, so it cannot be re-sent either.
 */
export async function issueReviewToken(orderId: number): Promise<string | null> {
  const token = newReviewToken()
  const hash = await hashReviewToken(token)
  const rows = await sql`
    INSERT INTO review_requests (order_id, token_hash)
    VALUES (${orderId}, ${hash})
    ON CONFLICT (order_id) DO NOTHING
    RETURNING order_id
  `
  return rows.length ? token : null
}

export type ReviewRequestState = 'open' | 'reviewed' | 'not-delivered'

export interface ReviewRequestView {
  state: ReviewRequestState
  orderId: number
  /** What the form pre-fills, e.g. "Juan D." — the customer can change it. */
  suggestedName: string
  /** Bottle names from the order, to remind them what they're reviewing. */
  itemNames: string[]
}

interface RequestRow {
  id: number
  first_name: string
  last_name: string
  items: unknown
  order_status: string
  reviewed: boolean
}

async function findRequest(token: string): Promise<RequestRow | null> {
  const hash = await hashReviewToken(token)
  const rows = await sql`
    SELECT o.id, o.first_name, o.last_name, o.items, o.order_status, (r.id IS NOT NULL) AS reviewed
    FROM review_requests rr
    JOIN orders o ON o.id = rr.order_id
    LEFT JOIN reviews r ON r.order_id = o.id
    WHERE rr.token_hash = ${hash}
  `
  return (rows[0] as RequestRow | undefined) ?? null
}

function stateOf(row: RequestRow): ReviewRequestState {
  if (row.reviewed) return 'reviewed'
  // Checked at use, not just when the link was sent: an order delivered and
  // then corrected to cancelled has not been genuinely delivered.
  if (row.order_status !== 'delivered') return 'not-delivered'
  return 'open'
}

/**
 * What the review page needs for a token — or null for one we never issued.
 *
 * The holder of the token is the customer it was emailed to, so their first
 * name and what they bought are theirs to see. Nothing else about the order
 * leaves here: no email, phone, address, coordinates or total.
 */
export async function viewReviewRequest(token: string): Promise<ReviewRequestView | null> {
  const row = await findRequest(token)
  if (!row) return null
  const names = Array.isArray(row.items)
    ? row.items.map(i => (i as { name?: unknown })?.name).filter((n): n is string => typeof n === 'string')
    : []
  return {
    state: stateOf(row),
    orderId: row.id,
    suggestedName: defaultDisplayName(row.first_name ?? '', row.last_name ?? ''),
    itemNames: Array.from(new Set(names)),
  }
}

export type SubmitOutcome =
  | { kind: 'created'; reviewId: number; orderId: number; rating: number }
  | { kind: 'not-found' }
  | { kind: 'not-delivered' }
  | { kind: 'reviewed' }

/**
 * The only INSERT into `reviews` in the codebase.
 *
 * The INSERT re-checks everything findRequest() saw, in the same statement:
 * the token still maps to this order, the order is still delivered, and
 * UNIQUE(order_id) with DO NOTHING means two tabs submitting at once produce
 * one review, not two.
 */
export async function submitReview(token: string, input: ReviewInput): Promise<SubmitOutcome> {
  const row = await findRequest(token)
  if (!row) return { kind: 'not-found' }
  const state = stateOf(row)
  if (state !== 'open') return { kind: state }

  const hash = await hashReviewToken(token)
  const productIds = productIdsFromItems(row.items)
  const rows = await sql`
    INSERT INTO reviews (order_id, rating, body, display_name, product_ids)
    SELECT o.id, ${input.rating}, ${input.body}, ${input.displayName}, ${productIds}::text[]
    FROM review_requests rr
    JOIN orders o ON o.id = rr.order_id
    WHERE rr.token_hash = ${hash} AND o.order_status = 'delivered'
    ON CONFLICT (order_id) DO NOTHING
    RETURNING id, order_id
  `
  if (!rows.length) return { kind: 'reviewed' }
  return { kind: 'created', reviewId: Number(rows[0].id), orderId: Number(rows[0].order_id), rating: input.rating }
}

// ── Public reads (product pages) ──────────────────────────────────────────
//
// Product pages are static (one per bottle, built at deploy), and they should
// stay that way. lib/db.ts sets `cache: 'no-store'` on every query, which Next
// treats as dynamic usage during static generation — even inside
// unstable_cache, whose callback still runs with isStaticGeneration set (read
// in next@14.2.10's patch-fetch.js). So this read gets its own client without
// that option, wrapped in unstable_cache: the result is cached under
// REVIEWS_TAG and moderation revalidates it, which is what keeps it fresh —
// not the per-fetch cache that lib/db.ts exists to switch off.
//
// Lazy like lib/db.ts, so a build without DATABASE_URL still succeeds.

let readClient: ReturnType<typeof neon> | null = null
function readSql() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  return (readClient ??= neon(url))
}

export interface ProductReviews {
  summary: RatingSummary | null
  shown: PublishedReview[]
}

const NO_REVIEWS: ProductReviews = { summary: null, shown: [] }

const cachedProductReviews = unstable_cache(
  async (productId: string): Promise<ProductReviews> => {
    const db = readSql()
    const [ratings, latest] = await Promise.all([
      db`SELECT rating FROM reviews WHERE approved AND ${productId} = ANY(product_ids)`,
      db`
        SELECT id, rating, body, display_name, created_at
        FROM reviews
        WHERE approved AND ${productId} = ANY(product_ids)
        ORDER BY created_at DESC
        LIMIT ${REVIEWS_SHOWN}
      `,
    ]) as [Record<string, unknown>[], Record<string, unknown>[]]
    return {
      summary: summariseRatings(ratings.map(r => Number(r.rating))),
      // ISO strings, not Dates: the result is JSON-serialised into the cache,
      // so a Date would come back a string on a hit and a Date on a miss.
      shown: latest.map(r => ({
        id: Number(r.id),
        rating: Number(r.rating),
        body: String(r.body),
        display_name: String(r.display_name),
        created_at: new Date(r.created_at as string | Date).toISOString(),
      })),
    }
  },
  ['product-reviews'],
  { tags: [REVIEWS_TAG], revalidate: 3600 }
)

/**
 * Approved reviews for a product page. Never throws: a database hiccup at
 * build or render time shows no review section — the same as having none —
 * rather than failing the page. Errors are not cached, so the next
 * revalidation tries again.
 */
export async function approvedReviewsFor(productId: string): Promise<ProductReviews> {
  try {
    return await cachedProductReviews(productId)
  } catch (err) {
    // Next signals "render this dynamically" by throwing. Swallowing that
    // would quietly bake an empty review section into a static page, so it
    // goes back up; only genuine failures fall back to no reviews.
    if ((err as { digest?: unknown })?.digest === 'DYNAMIC_SERVER_USAGE') throw err
    console.error(`Reviews for ${productId} could not be loaded:`, err)
    return NO_REVIEWS
  }
}

// ── Admin ─────────────────────────────────────────────────────────────────

export const MODERATION_FILTERS = ['pending', 'approved', 'rejected'] as const
export type ModerationFilter = (typeof MODERATION_FILTERS)[number]

export function isModerationFilter(v: unknown): v is ModerationFilter {
  return typeof v === 'string' && (MODERATION_FILTERS as readonly string[]).includes(v)
}

export async function listReviews(filter: ModerationFilter) {
  const rows =
    filter === 'pending'
      ? await sql`SELECT * FROM reviews WHERE moderated_at IS NULL ORDER BY created_at ASC`
      : await sql`SELECT * FROM reviews WHERE moderated_at IS NOT NULL AND approved = ${filter === 'approved'} ORDER BY created_at DESC`
  return rows
}

/**
 * Publish or reject. Moderation never edits a review's words, rating or name:
 * an admin rewriting a customer's review is writing a review, which is the
 * one thing this feature must never do. The only choices are yes or no.
 */
export async function moderateReview(id: number, approved: boolean) {
  const rows = await sql`
    UPDATE reviews SET approved = ${approved}, moderated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `
  return rows[0] ?? null
}
