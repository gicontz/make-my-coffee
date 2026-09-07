// Which order statuses reach the customer's inbox, and how an `orders` row
// becomes the email that goes out.
//
// The mapper matters more than it looks: it is fed straight from
// `UPDATE ... RETURNING *`, so every field arrives snake_case and some arrive
// as whatever the driver felt like (NULL text columns, numerics as strings).
// A wrong field name here doesn't throw — it renders an email addressed to
// `undefined` with a ₱NaN total.

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  NOTIFIED_ORDER_STATUSES,
  notifiesCustomer,
  statusEmailFromOrderRow,
} from '../lib/email.ts'

const ROW = {
  id: 41,
  first_name: 'Juan',
  last_name: 'dela Cruz',
  email: 'juan@example.com',
  address: '1611 KC-14',
  barangay: 'Manggahan',
  city: 'Pasig',
  province: 'Metro Manila / NCR',
  postal_code: '1611',
  total: 548,
  delivery_slots: ['09-10', '13-14'],
  payment_method: 'gcash',
  payment_status: 'unpaid',
}

test('only shipped and delivered notify the customer', () => {
  assert.ok(notifiesCustomer('shipped'))
  assert.ok(notifiesCustomer('delivered'))

  // 'approved' is internal bookkeeping; 'cancelled' is a conversation, not a
  // notification. Both are deliberate omissions — if either starts mailing,
  // that was a decision, not a slip.
  for (const status of ['pending', 'approved', 'cancelled', 'paid', '', undefined, null, 7]) {
    assert.equal(notifiesCustomer(status), false, `${String(status)} must not mail the customer`)
  }
})

test('the notified list and the copy table cannot drift apart', () => {
  // sendOrderStatusEmail indexes STATUS_COPY by status; a status added to the
  // list without copy would render an email with an undefined subject.
  assert.deepEqual([...NOTIFIED_ORDER_STATUSES], ['shipped', 'delivered'])
})

test('maps an order row into the status email payload', () => {
  const data = statusEmailFromOrderRow(ROW, 'shipped')

  assert.equal(data.orderId, 41)
  assert.equal(data.status, 'shipped')
  assert.equal(data.total, 548)
  assert.equal(data.paymentMethod, 'gcash')
  assert.equal(data.paymentStatus, 'unpaid')
  assert.deepEqual(data.deliverySlots, ['09-10', '13-14'])
  assert.deepEqual(data.customer, {
    firstName: 'Juan',
    email: 'juan@example.com',
    address: '1611 KC-14',
    barangay: 'Manggahan',
    city: 'Pasig',
    province: 'Metro Manila / NCR',
    postalCode: '1611',
  })
})

test('an empty barangay drops out rather than rendering "Brgy. "', () => {
  assert.equal(statusEmailFromOrderRow({ ...ROW, barangay: '' }, 'shipped').customer.barangay, undefined)
  assert.equal(statusEmailFromOrderRow({ ...ROW, barangay: null }, 'shipped').customer.barangay, undefined)
})

test('a total arriving as a string still becomes a number', () => {
  // Belt and braces: `total` is INTEGER today, but a NUMERIC column would come
  // back from the neon driver as a string, and '548'.toLocaleString() is a
  // silent no-op that would print an unformatted figure in the email.
  const data = statusEmailFromOrderRow({ ...ROW, total: '548' }, 'delivered')
  assert.equal(data.total, 548)
  assert.equal(typeof data.total, 'number')
})

test('missing payment columns fall back to unpaid COD, not to blank', () => {
  // The payment block is chosen by these two. Blank would pick neither the COD
  // wording nor a QR account, and the customer would be told nothing about
  // money they may still owe.
  const data = statusEmailFromOrderRow(
    { ...ROW, payment_method: null, payment_status: null },
    'delivered'
  )
  assert.equal(data.paymentMethod, 'cod')
  assert.equal(data.paymentStatus, 'unpaid')
})

test('a null delivery_slots becomes an empty list, not a crash', () => {
  assert.deepEqual(statusEmailFromOrderRow({ ...ROW, delivery_slots: null }, 'shipped').deliverySlots, [])
})
