// The free-shipping threshold, checked against the baskets it exists for.
//
// A threshold is only meaningful next to the prices it sits among, and ours
// are clustered: ₱897 and ₱898 are reachable three different ways, then
// nothing until ₱1,047. The old ₱1,000 line cleared none of that cluster, so
// it never grew an order — it just pushed people toward a pair they did not
// want. ₱899 would have missed the same cluster by one peso.
//
// So this file does not assert the constant equals 888; that would only
// restate it. It asserts the cluster qualifies and the single bottles do not,
// which is the property the number is chosen for — and it fails if a bottle
// price moves without someone re-deciding the threshold.

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  FLAT_SHIPPING_FEE,
  FREE_SHIPPING_MIN_SUBTOTAL,
  calcShipping,
  isFreeShippingEligible,
} from '../lib/shipping.ts'
import { products } from '../lib/products.ts'

const price = (id: string) => {
  const found = products.find(p => p.id === id)
  assert.ok(found, `lib/products.ts no longer has a bottle with id "${id}"`)
  return found.price
}

const STARTER = price('4-shot')
const CLASSIC = price('7-shot')
const RESERVE = price('10-shot')

test('every two- and three-bottle basket clears the threshold', () => {
  const baskets: [string, number][] = [
    ['Starter ×3', STARTER * 3],
    ['Starter + Reserve', STARTER + RESERVE],
    ['Classic ×2', CLASSIC * 2],
    ['Classic + Reserve', CLASSIC + RESERVE],
    ['Reserve ×2', RESERVE * 2],
  ]

  for (const [name, subtotal] of baskets) {
    assert.ok(
      subtotal >= FREE_SHIPPING_MIN_SUBTOTAL,
      `${name} is ₱${subtotal}, short of the ₱${FREE_SHIPPING_MIN_SUBTOTAL} threshold. ` +
        'Either a bottle price moved or the threshold was rounded up; re-decide it ' +
        'against the basket totals rather than nudging this test.'
    )
  }
})

test('a single bottle never qualifies', () => {
  // The promo is meant to grow an order, not to hand free delivery to the
  // smallest one. If the priciest bottle alone clears the line, it has stopped
  // doing its job.
  for (const product of products) {
    assert.ok(
      product.price < FREE_SHIPPING_MIN_SUBTOTAL,
      `${product.name} alone (₱${product.price}) would qualify for free delivery`
    )
  }
})

test('free delivery is Pasig only, at any subtotal', () => {
  const plenty = RESERVE * 3

  assert.equal(isFreeShippingEligible('Pasig', plenty), true)
  assert.equal(isFreeShippingEligible('Pasig City', plenty), true, 'the "City" suffix is stripped')
  assert.equal(isFreeShippingEligible('  pasig  ', plenty), true, 'trimmed and case-insensitive')

  assert.equal(isFreeShippingEligible('Makati', plenty), false)
  assert.equal(isFreeShippingEligible('Quezon City', plenty), false)
})

test('the fallback rate applies whenever the promo does not', () => {
  assert.equal(calcShipping('Pasig', RESERVE * 2), 0)
  assert.equal(calcShipping('Pasig', STARTER), FLAT_SHIPPING_FEE)
  assert.equal(calcShipping('Makati', RESERVE * 3), FLAT_SHIPPING_FEE)
})
