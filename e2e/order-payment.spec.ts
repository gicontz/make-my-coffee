// The payment-method contract, both ends of it.
//
// At checkout the customer picks a method and POST /api/orders records it —
// but nothing verifies a QR wallet payment (decision.md D13), so the choice is
// intent, never proof: every order lands 'unpaid' whatever was picked.
// Confirming it is the admin's job via PATCH /api/admin/orders/[id], which has
// to be told what actually turned up rather than promoting the customer's
// choice — someone who picked GCash can still hand over cash at the door.

import { test, expect } from '@playwright/test'
import { adminApiLogin } from './helpers/app.ts'
import { cleanup, ensureSchema, getOrder, seedOrder, uniqueEmail } from './helpers/db.ts'

const CUSTOMER = {
  firstName: 'Juan', lastName: 'dela Cruz', phone: '+63 912 345 6789',
  province: 'Metro Manila / NCR', city: 'Pasig', barangay: 'Manggahan',
  postalCode: '1611', address: '1611 KC-14', notes: '',
}

function orderPayload(over: Record<string, unknown> = {}) {
  const { customer, ...rest } = over
  return {
    customer: { ...CUSTOMER, email: uniqueEmail('pay'), ...(customer as object ?? {}) },
    items: [{ id: '7-shot', name: 'Aconchego Classic', shots: 7, price: 449, quantity: 1 }],
    subtotal: 449,
    deliverySlots: ['09-10', '13-14'],
    ...rest,
  }
}

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

test.describe('POST /api/orders records the chosen method without ever marking it paid', () => {
  for (const method of ['cod', 'gcash', 'maya', 'gotyme']) {
    test(`records ${method} and still inserts the order unpaid`, async ({ request }) => {
      const res = await request.post('/api/orders', { data: orderPayload({ paymentMethod: method }) })
      expect(res.status()).toBe(200)

      const order = await getOrder((await res.json()).orderId)
      expect(order!.payment_method).toBe(method)
      // The whole point of D13: picking a QR wallet proves nothing.
      expect(order!.payment_status).toBe('unpaid')
      expect(order!.paid_at).toBeNull()
    })
  }

  test('a client cannot talk its way into a paid order', async ({ request }) => {
    const res = await request.post('/api/orders', {
      data: orderPayload({ paymentMethod: 'gcash', payment_status: 'paid', paymentStatus: 'paid' }),
    })
    expect(res.status()).toBe(200)

    const order = await getOrder((await res.json()).orderId)
    expect(order!.payment_status).toBe('unpaid')
    expect(order!.paid_at).toBeNull()
  })

  test('an omitted method falls back to COD rather than failing', async ({ request }) => {
    const res = await request.post('/api/orders', { data: orderPayload() })
    expect(res.status()).toBe(200)
    expect((await getOrder((await res.json()).orderId))!.payment_method).toBe('cod')
  })

  test('rejects a method the checkout does not offer, including the admin-only one', async ({ request }) => {
    for (const method of ['bank_transfer', 'venmo', 'COD', '', 42]) {
      const res = await request.post('/api/orders', { data: orderPayload({ paymentMethod: method }) })
      expect(res.status(), `paymentMethod=${JSON.stringify(method)} should be refused`).toBe(400)
    }
  })
})
