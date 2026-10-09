// The FAQ is a page of statements of fact, so these tests hold each answer to
// the module that owns it — and hold the two rules that a well-meaning copy
// edit is most likely to break: never quote a delivery fee, and never let a
// freshness claim travel without its refrigeration condition.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { deliveryHours, faqs, joinList } from '../lib/faq.ts'
import { REFRIGERATE, SHELF_LIFE, TRANSIT_STORAGE } from '../lib/freshness.ts'
import { PROVINCES } from '../lib/phLocations.ts'
import { FREE_SHIPPING_MIN_SUBTOTAL } from '../lib/shipping.ts'
import { MAX_DAYS_AHEAD } from '../lib/deliveryDate.ts'
import { CHECKOUT_PAYMENT_METHODS, paymentMethodLabel, qrAccountFor } from '../lib/paymentMethods.ts'
import { pricePerShot, products } from '../lib/products.ts'

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

/** Source minus comments — the comments explain the rules by quoting them. */
const code = (rel: string) =>
  read(rel)
    .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')

const answer = (id: string) => {
  const faq = faqs.find(f => f.id === id)
  assert.ok(faq, `no FAQ with id ${id}`)
  return faq.answer
}

test('ids are unique and usable as anchors', () => {
  const ids = faqs.map(f => f.id)
  assert.equal(new Set(ids).size, ids.length)
  for (const id of ids) assert.match(id, /^[a-z0-9]+(-[a-z0-9]+)*$/)
})

test('no delivery fee is ever quoted', () => {
  // The only peso figures allowed anywhere are per-drink prices. A fee can't
  // be known before the customer pins a spot.
  const allowed = new Set(products.map(pricePerShot))
  for (const f of faqs) {
    for (const figure of f.answer.match(/₱[\d,]+/g) ?? []) {
      const amount = Number(figure.slice(1).replace(/,/g, ''))
      assert.ok(allowed.has(amount), `"${f.question}" states ${figure}, which is not a figure the FAQ may quote`)
    }
  }
  // The delivery answer states no number at all — not a fee, and not the
  // free-delivery threshold either.
  const fee = answer('delivery-fee')
  assert.doesNotMatch(fee, /\d|₱/, 'the delivery answer must not state any number')
  assert.doesNotMatch(fee, /usually|around|roughly|typically|starts? (at|from)|as low as/i)
  assert.match(fee, /pin/i, 'the answer must say where the fee comes from')
})

test('freshness claims never travel without the fridge instruction', () => {
  for (const f of faqs) {
    const mentionsStorage = /refrigerat|fridge|days from delivery/i.test(f.answer)
    if (!mentionsStorage) continue
    assert.ok(f.answer.includes(REFRIGERATE), `"${f.question}" talks about storage without REFRIGERATE`)
  }
  assert.ok(answer('refrigeration').includes(TRANSIT_STORAGE))
  assert.ok(answer('shelf-life').includes(SHELF_LIFE))
})

test('answers are built from the modules, not retyped', () => {
  const faqSource = code('../lib/faq.ts')
  for (const [what, pattern] of [
    ['the day count', /\b\d+\s*days? from delivery/i],
    ['the free-delivery threshold', new RegExp(`\\b${FREE_SHIPPING_MIN_SUBTOTAL}\\b`)],
    ['a province', new RegExp(PROVINCES.slice(1).join('|'))],
    ['a wallet name', /GCash|Maya|GoTyme/],
    ['the delivery hours', /\d{1,2}:\d{2}\s*[AP]M/],
    ['the shot size', /\b30\s*ml/i],
  ] as const) {
    assert.doesNotMatch(faqSource, pattern, `lib/faq.ts retypes ${what}`)
  }
})

test('each answer carries the current facts', () => {
  for (const p of PROVINCES) assert.ok(answer('delivery-area').includes(p), `missing ${p}`)

  const pay = answer('payment')
  assert.ok(pay.includes(paymentMethodLabel('cod')))
  for (const m of CHECKOUT_PAYMENT_METHODS) {
    if (qrAccountFor(m)) assert.ok(pay.includes(paymentMethodLabel(m)), `missing ${m}`)
  }

  const when = answer('delivery-time')
  assert.ok(when.includes(`${MAX_DAYS_AHEAD} days`))
  assert.ok(when.includes(deliveryHours()))
})

test('delivery hours keep both meridiems', () => {
  // Splitting the slot labels instead ("9:00 – 10:00 AM") loses the AM.
  assert.equal(deliveryHours(), '9:00 AM and 7:00 PM')
})

test('joinList reads as prose', () => {
  assert.equal(joinList(['a'], 'and'), 'a')
  assert.equal(joinList(['a', 'b'], 'or'), 'a or b')
  assert.equal(joinList(['a', 'b', 'c'], 'and'), 'a, b and c')
})

test('the page renders the same text it puts in FAQPage markup', () => {
  const page = code('../app/(storefront)/faq/page.tsx')
  assert.match(page, /from '@\/lib\/faq'/)
  assert.match(page, /'@type': 'FAQPage'/)
  assert.match(page, /acceptedAnswer: \{ '@type': 'Answer', text: f\.answer \}/)
  assert.match(page, /\{f\.answer\}/, 'the visible answer must be the marked-up one')
})

test('the FAQ is reachable: sitemap and footer', () => {
  assert.match(read('../app/sitemap.ts'), /\$\{base\}\/faq/)
  assert.match(read('../components/Footer.tsx'), /'\/faq'/)
})
