// The admin "mark paid" contract: PATCH /api/admin/orders/[id].
//
// There's no live payment gateway (PayPal is still blocked on sandbox creds),
// so every order is placed with payment_method = 'cod' as a placeholder — it
// means "nothing happened online at checkout", not "cash changed hands". What
// actually gets collected can be COD, GCash, Maya or a bank transfer,
// depending on how the admin and customer settle up, so marking an order paid
// must record which one really happened rather than trusting the placeholder.

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

test('marking an order paid requires a payment method', async ({ request }) => {
  await adminApiLogin(request)
  const id = await seedOrder({ total: 398, order_status: 'delivered', payment_status: 'unpaid' })

  const res = await request.patch(`/api/admin/orders/${id}`, {
    data: { payment_status: 'paid' },
  })
  expect(res.status()).toBe(400)

  const order = await getOrder(id)
  expect(order!.payment_status).toBe('unpaid')
  expect(order!.paid_at).toBeNull()
})

test('rejects a payment method that is not on the list', async ({ request }) => {
  await adminApiLogin(request)
  const id = await seedOrder({ total: 398, order_status: 'delivered', payment_status: 'unpaid' })

  const res = await request.patch(`/api/admin/orders/${id}`, {
    data: { payment_status: 'paid', payment_method: 'venmo' },
  })
  expect(res.status()).toBe(400)
  expect((await getOrder(id))!.payment_status).toBe('unpaid')
})

test('marking paid with a method records it and stamps paid_at', async ({ request }) => {
  await adminApiLogin(request)
  const id = await seedOrder({ total: 449, order_status: 'delivered', payment_status: 'unpaid' })

  const before = Date.now()
  const res = await request.patch(`/api/admin/orders/${id}`, {
    data: { payment_status: 'paid', payment_method: 'gcash' },
  })
  expect(res.ok()).toBeTruthy()

  const order = await getOrder(id)
  expect(order!.payment_status).toBe('paid')
  expect(order!.payment_method).toBe('gcash')
  expect(order!.paid_at).not.toBeNull()
  expect(new Date(order!.paid_at!).getTime()).toBeGreaterThanOrEqual(before - 1000)
})

test('marking unpaid again clears paid_at without requiring a method', async ({ request }) => {
  await adminApiLogin(request)
  const id = await seedOrder({
    total: 599, order_status: 'delivered', payment_status: 'paid', payment_method: 'maya',
  })
  expect((await getOrder(id))!.paid_at).not.toBeNull()

  const res = await request.patch(`/api/admin/orders/${id}`, {
    data: { payment_status: 'unpaid' },
  })
  expect(res.ok()).toBeTruthy()

  const order = await getOrder(id)
  expect(order!.payment_status).toBe('unpaid')
  expect(order!.paid_at).toBeNull()
})
