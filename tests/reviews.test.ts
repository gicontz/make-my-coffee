// Customer reviews (issue #37).
//
// Two kinds of test. The pure rules — input, tokens, the JSON-LD — are
// called directly. The hard rule is checked against the source, the way
// tests/adminAuth.test.ts checks the admin guards: "never seed, write or
// invent a review" fails as a line of code someone adds, so that is where it
// is caught.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  DISPLAY_NAME_MAX,
  REVIEW_BODY_MAX,
  defaultDisplayName,
  hashReviewToken,
  isReviewTokenShape,
  newReviewToken,
  productIdsFromItems,
  productReviewLd,
  reviewUrl,
  summariseRatings,
  validateReviewInput,
  type PublishedReview,
} from '../lib/reviews.ts'
import { jsonLd } from '../lib/seo.ts'
import { buildOrderStatusEmail, statusEmailFromOrderRow } from '../lib/email.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = (rel: string) => readFileSync(`${ROOT}/${rel}`, 'utf8')

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(`${ROOT}/${dir}`)) {
    if (['node_modules', '.next', '.git'].includes(entry)) continue
    const rel = `${dir}/${entry}`
    if (statSync(`${ROOT}/${rel}`).isDirectory()) sourceFiles(rel, out)
    else if (/\.(ts|tsx|sql|js|mjs)$/.test(entry)) out.push(rel)
  }
  return out
}

const ALL_SOURCE = ['app', 'lib', 'components', 'e2e', 'context'].flatMap(d => sourceFiles(d))

// ── The hard rule ─────────────────────────────────────────────────────────

test('nothing but the customer submission path inserts a review', () => {
  // A seed script, a migration with sample rows, an admin "add review"
  // button, an e2e helper that plants one for a screenshot — each is the
  // fabrication the issue forbids, and each starts as an INSERT.
  const inserting = ALL_SOURCE.filter(f => /INSERT\s+INTO\s+reviews\b/i.test(read(f)))
  assert.deepEqual(inserting, ['lib/reviewStore.ts'], `only submitReview() may insert a review; found: ${inserting.join(', ')}`)

  const store = read('lib/reviewStore.ts')
  assert.equal(store.match(/INSERT\s+INTO\s+reviews\b/gi)?.length, 1, 'exactly one INSERT, inside submitReview()')
  // ...and that one is gated on a delivered order reached through the token.
  const insert = store.slice(store.search(/INSERT\s+INTO\s+reviews\b/i))
  assert.match(insert.slice(0, 600), /rr\.token_hash = \$\{hash\} AND o\.order_status = 'delivered'/)
})

test('nothing edits what a customer wrote', () => {
  // Moderation is publish or reject. Changing the words, rating or name is
  // writing the review for them.
  const editing = ALL_SOURCE.filter(f => /UPDATE\s+reviews\s+SET[^`]*\b(body|rating|display_name|product_ids)\s*=/i.test(read(f)))
  assert.deepEqual(editing, [], `these change a review's content: ${editing.join(', ')}`)
})

test('the public review routes are keyed on the token, never an order number', () => {
  // orders.id is a SERIAL — anything that accepted a number would let a
  // stranger walk the table and review orders that are not theirs.
  for (const route of ['app/api/reviews/route.ts', 'app/api/reviews/request/route.ts']) {
    const source = read(route)
    assert.match(source, /isReviewTokenShape\(/, `${route} must check the token before anything else`)
    assert.doesNotMatch(source, /\b(orderId|order_id|orderNumber)\b\s*[:=]?\s*(body|request|searchParams)/, `${route} must not read an order number from the request`)
  }
  const store = read('lib/reviewStore.ts')
  assert.match(store, /WHERE rr\.token_hash = \$\{hash\}/, 'requests are found by token hash')
})

test('the review lookup returns nothing personal beyond the first name', () => {
  // The token holder is the customer, but the response still has no reason
  // to carry an email, phone, address or coordinates.
  const store = read('lib/reviewStore.ts')
  const select = store.slice(store.indexOf('async function findRequest'), store.indexOf('function stateOf'))
  for (const column of ['email', 'phone', 'address', 'delivery_lat', 'delivery_lng', 'total']) {
    assert.doesNotMatch(select, new RegExp(`o\\.${column}\\b`), `findRequest() must not select ${column}`)
  }
})

test('the input limits match the database constraints', () => {
  // Both DDL files: the migration for the live DB, db-setup.sql for e2e.
  for (const file of ['lib/migrations/0009_add_reviews.sql', 'lib/db-setup.sql']) {
    const ddl = read(file)
    assert.match(ddl, new RegExp(`char_length\\(body\\) BETWEEN 1 AND ${REVIEW_BODY_MAX}\\b`), file)
    assert.match(ddl, new RegExp(`char_length\\(display_name\\) BETWEEN 1 AND ${DISPLAY_NAME_MAX}\\b`), file)
  }
})

// ── Tokens ────────────────────────────────────────────────────────────────

test('tokens are 256 random bits, url-safe, and only their hash is stored', async () => {
  const a = newReviewToken()
  const b = newReviewToken()
  assert.ok(isReviewTokenShape(a))
  assert.notEqual(a, b)

  const hash = await hashReviewToken(a)
  assert.match(hash, /^[0-9a-f]{64}$/)
  assert.equal(hash, await hashReviewToken(a))
  assert.notEqual(hash, await hashReviewToken(b))
})

test('an order number is not a token', () => {
  for (const guess of ['41', 41, '', null, undefined, 'a'.repeat(42), 'a'.repeat(44), `${'a'.repeat(42)}/`]) {
    assert.equal(isReviewTokenShape(guess), false, `${String(guess)} must not pass as a token`)
  }
})

test('the link carries the token in the fragment, where no server or Referer sees it', () => {
  const token = newReviewToken()
  const url = new URL(reviewUrl(token))
  assert.equal(url.pathname, '/review')
  assert.equal(url.hash, `#${token}`)
  assert.equal(url.search, '')
})

// ── Input ─────────────────────────────────────────────────────────────────

const VALID = { rating: 5, body: 'Great over ice.', displayName: 'Juan D.' }

test('accepts a well-formed review', () => {
  assert.deepEqual(validateReviewInput(VALID), { ok: true, value: VALID })
})

test('rating is a whole number from 1 to 5', () => {
  for (const rating of [0, 6, 4.5, '5', null, undefined, NaN]) {
    assert.equal(validateReviewInput({ ...VALID, rating }).ok, false, `rating ${String(rating)}`)
  }
  for (const rating of [1, 2, 3, 4, 5]) assert.equal(validateReviewInput({ ...VALID, rating }).ok, true)
})

test('body is required, trimmed, and capped in characters rather than UTF-16 units', () => {
  assert.equal(validateReviewInput({ ...VALID, body: '   \n ' }).ok, false)
  assert.equal(validateReviewInput({ ...VALID, body: 42 }).ok, false)

  // Postgres counts code points; an emoji is two UTF-16 units but one char.
  assert.equal(validateReviewInput({ ...VALID, body: '☕'.repeat(REVIEW_BODY_MAX) }).ok, true)
  assert.equal(validateReviewInput({ ...VALID, body: '😀'.repeat(REVIEW_BODY_MAX) }).ok, true)
  assert.equal(validateReviewInput({ ...VALID, body: 'a'.repeat(REVIEW_BODY_MAX + 1) }).ok, false)

  const result = validateReviewInput({ ...VALID, body: '  Line one\r\n\r\n\r\n\r\nLine two\u0007  ' })
  assert.ok(result.ok)
  assert.equal(result.value.body, 'Line one\n\nLine two')
})

test('display name is required, single-line and capped', () => {
  assert.equal(validateReviewInput({ ...VALID, displayName: '  ' }).ok, false)
  assert.equal(validateReviewInput({ ...VALID, displayName: 'x'.repeat(DISPLAY_NAME_MAX + 1) }).ok, false)
  const result = validateReviewInput({ ...VALID, displayName: '  Juan \n  D. ' })
  assert.ok(result.ok)
  assert.equal(result.value.displayName, 'Juan D.')
})

test('the suggested name never publishes a full surname', () => {
  assert.equal(defaultDisplayName('Juan', 'dela Cruz'), 'Juan D.')
  assert.equal(defaultDisplayName(' Maria ', ''), 'Maria')
  assert.ok(Array.from(defaultDisplayName('x'.repeat(60), 'Y')).length <= DISPLAY_NAME_MAX)
})

test('a review is pinned to the bottles its order contained', () => {
  const items = [
    { id: '10-shot', name: 'Aconchego Reserve', quantity: 1 },
    { id: '4-shot', name: 'Aconchego Starter', quantity: 2 },
    { id: '10-shot', name: 'Aconchego Reserve', quantity: 1 },
    { id: 'discontinued', name: 'Old bottle', quantity: 1 },
  ]
  assert.deepEqual(productIdsFromItems(items), ['4-shot', '10-shot'])
  assert.deepEqual(productIdsFromItems(null), [])
  assert.deepEqual(productIdsFromItems('nope'), [])
})

// ── Display ───────────────────────────────────────────────────────────────

const REVIEW: PublishedReview = {
  id: 1,
  rating: 4,
  body: 'Good',
  display_name: 'Ana R.',
  // 20:30 UTC on the 13th is already the 14th in Manila.
  created_at: '2026-10-13T20:30:00.000Z',
}

test('no reviews means no average — not zero', () => {
  assert.equal(summariseRatings([]), null)
  assert.deepEqual(summariseRatings([5, 4, 5]), { count: 3, average: 4.7 })
})

test('no reviews means no rating markup at all', () => {
  // A Product with an empty or invented AggregateRating is a claim with
  // nothing behind it.
  assert.deepEqual(productReviewLd(null, []), {})
  assert.deepEqual(productReviewLd({ count: 1, average: 4 }, []), {})
})

test('rating markup describes the approved reviews and the ones on the page', () => {
  const ld = productReviewLd({ count: 12, average: 4.3 }, [REVIEW]) as {
    aggregateRating: { ratingValue: number; reviewCount: number }
    review: { author: { name: string }; datePublished: string; reviewRating: { ratingValue: number } }[]
  }
  assert.equal(ld.aggregateRating.ratingValue, 4.3)
  assert.equal(ld.aggregateRating.reviewCount, 12)
  assert.equal(ld.review.length, 1)
  assert.equal(ld.review[0].author.name, 'Ana R.')
  assert.equal(ld.review[0].reviewRating.ratingValue, 4)
  assert.equal(ld.review[0].datePublished, '2026-10-14', 'dated in Manila, not UTC')
})

test('a review cannot break out of the JSON-LD script tag', () => {
  const hostile = { reviewBody: '</script><script>alert(1)</script>' }
  const out = jsonLd(hostile)
  assert.doesNotMatch(out, /<\/script/i)
  assert.deepEqual(JSON.parse(out), hostile)

  // And the product page uses it rather than a bare JSON.stringify.
  const page = read('app/(storefront)/shop/[id]/page.tsx')
  assert.match(page, /__html: jsonLd\(productLd\)/)
})

// ── The request email ─────────────────────────────────────────────────────

const ORDER_ROW = {
  id: 41,
  first_name: 'Juan',
  email: 'juan@example.com',
  address: '1611 KC-14',
  city: 'Pasig',
  province: 'Metro Manila / NCR',
  postal_code: '1611',
  total: 548,
  payment_method: 'cod',
  payment_status: 'paid',
}

test('the delivered email carries the review link', () => {
  const url = reviewUrl(newReviewToken())
  const msg = buildOrderStatusEmail({ ...statusEmailFromOrderRow(ORDER_ROW, 'delivered'), reviewUrl: url })
  assert.ok(msg.html.includes(`href="${url}"`))
  assert.match(msg.html, /How was it\?/)
})

test('without a link the delivered email still goes, just without the ask', () => {
  const msg = buildOrderStatusEmail(statusEmailFromOrderRow(ORDER_ROW, 'delivered'))
  assert.doesNotMatch(msg.html, /How was it\?|\/review#/)
  assert.match(msg.subject, /delivered/)
})

test('only the delivered email asks for a review', () => {
  const url = reviewUrl(newReviewToken())
  for (const status of ['shipped', 'cancelled'] as const) {
    const msg = buildOrderStatusEmail({ ...statusEmailFromOrderRow(ORDER_ROW, status), reviewUrl: url })
    assert.doesNotMatch(msg.html, /\/review#/, `${status} must not ask for a review`)
  }
})

test('a review token is minted once, never rotated', () => {
  // A repeat delivered email shares the Resend idempotency key and is
  // dropped; rotating the token would leave the customer only a dead link.
  const store = read('lib/reviewStore.ts')
  const issue = store.slice(store.indexOf('export async function issueReviewToken'), store.indexOf('export type ReviewRequestState'))
  assert.match(issue, /ON CONFLICT \(order_id\) DO NOTHING/)
  assert.doesNotMatch(issue, /DO UPDATE/)
})
