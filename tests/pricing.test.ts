// Server-side re-pricing of a posted cart. This is what makes the voucher
// minimum-spend and percentage rules enforceable — see lib/products.ts.

import test from 'node:test'
import assert from 'node:assert/strict'

import { MAX_LINE_QUANTITY, priceOrderItems, products } from '../lib/products.ts'

test('prices a cart from the catalog, ignoring client-supplied prices', () => {
  const priced = priceOrderItems([
    { id: '7-shot', name: 'Free Coffee', shots: 999, price: 1, quantity: 2 },
  ])
  assert.ok(priced)
  assert.equal(priced.subtotal, 449 * 2)
  assert.deepEqual(priced.items, [
    { id: '7-shot', name: 'Aconchego Classic', shots: 7, price: 449, quantity: 2 },
  ])
})

test('sums multiple lines', () => {
  const priced = priceOrderItems([
    { id: '4-shot', quantity: 1 },
    { id: '10-shot', quantity: 3 },
  ])
  assert.equal(priced!.subtotal, 299 + 599 * 3)
})

test('rejects a cart that is empty or not an array', () => {
  assert.equal(priceOrderItems([]), null)
  assert.equal(priceOrderItems(null), null)
  assert.equal(priceOrderItems('4-shot'), null)
})

test('rejects an unknown product id', () => {
  assert.equal(priceOrderItems([{ id: 'free-shot', quantity: 1 }]), null)
})

test('rejects quantities that are not sane whole numbers', () => {
  for (const quantity of [0, -1, 1.5, NaN, 'two', null, undefined, MAX_LINE_QUANTITY + 1]) {
    assert.equal(priceOrderItems([{ id: '4-shot', quantity }]), null, `quantity ${String(quantity)}`)
  }
  assert.ok(priceOrderItems([{ id: '4-shot', quantity: MAX_LINE_QUANTITY }]))
})

test('every catalog product is priceable', () => {
  for (const product of products) {
    const priced = priceOrderItems([{ id: product.id, quantity: 1 }])
    assert.equal(priced!.subtotal, product.price, product.id)
  }
})
