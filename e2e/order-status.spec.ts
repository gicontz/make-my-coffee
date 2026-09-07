// Order status transitions, and the rule that decides whether the customer
// hears about one.
//
// 'shipped' and 'delivered' mail the customer (lib/email.ts). The guard that
// keeps that from becoming spam is in the UPDATE itself: it only touches rows
// whose status is actually changing, so a re-clicked button, a double-submit or
// a retried request is a no-op rather than a second email. Email delivery is
// mocked here (EMAIL_TRANSPORT=json, playwright.config.ts), so what this spec
// asserts is the transition guard — `updated_at` moving is the observable
// proxy for "a row changed, therefore mail went out".

import { test, expect } from '@playwright/test'
import { adminApiLogin } from './helpers/app.ts'
import { cleanup, ensureSchema, getOrder, seedOrder } from './helpers/db.ts'

test.beforeAll(async () => {
  await ensureSchema()
  await cleanup()
})

test.afterAll(async () => {
  await cleanup()
})

test('advancing the status updates the order', async ({ request }) => {
  await adminApiLogin(request)
  const id = await seedOrder({ total: 548, order_status: 'approved', payment_status: 'unpaid' })

  const res = await request.patch(`/api/admin/orders/${id}`, { data: { order_status: 'shipped' } })
  expect(res.ok()).toBeTruthy()
  expect((await getOrder(id))!.order_status).toBe('shipped')
})

test('re-sending the same status is a no-op, so the customer is not mailed twice', async ({ request }) => {
  await adminApiLogin(request)
  const id = await seedOrder({ total: 548, order_status: 'approved', payment_status: 'unpaid' })

  await request.patch(`/api/admin/orders/${id}`, { data: { order_status: 'shipped' } })
  const first = await getOrder(id)
  expect(first!.order_status).toBe('shipped')

  // Second identical PATCH — the admin clicking twice, or a retry.
  const res = await request.patch(`/api/admin/orders/${id}`, { data: { order_status: 'shipped' } })
  expect(res.ok()).toBeTruthy()

  const second = await getOrder(id)
  expect(second!.order_status).toBe('shipped')
  // Nothing was written, so nothing was notified.
  expect(second!.updated_at).toBe(first!.updated_at)
})

test('a status the app does not define is refused and changes nothing', async ({ request }) => {
  await adminApiLogin(request)
  const id = await seedOrder({ total: 548, order_status: 'pending', payment_status: 'unpaid' })

  const res = await request.patch(`/api/admin/orders/${id}`, { data: { order_status: 'in_transit' } })
  expect(res.status()).toBe(400)
  expect((await getOrder(id))!.order_status).toBe('pending')
})

test('payment and order status can still be changed in one request', async ({ request }) => {
  await adminApiLogin(request)
  const id = await seedOrder({ total: 548, order_status: 'shipped', payment_status: 'unpaid' })

  const res = await request.patch(`/api/admin/orders/${id}`, {
    data: { order_status: 'delivered', payment_status: 'paid', payment_method: 'gcash' },
  })
  expect(res.ok()).toBeTruthy()

  const order = await getOrder(id)
  expect(order!.order_status).toBe('delivered')
  expect(order!.payment_status).toBe('paid')
  expect(order!.payment_method).toBe('gcash')
  expect(order!.paid_at).not.toBeNull()
})
