// API-level contract for vouchers: who may administer them, what a tampered
// checkout payload can and cannot do, and whether the redemption limits hold
// when several customers submit at the same instant.

import { test, expect, type APIRequestContext } from '@playwright/test'
import { adminApiLogin, ADMIN_USER, ADMIN_PASS } from './helpers/app.ts'
import {
  cleanup, countRedemptions, ensureSchema, getOrder, getVoucher, seedVoucher, uniqueEmail,
} from './helpers/db.ts'

const CUSTOMER = {
  firstName: 'Juan', lastName: 'dela Cruz', phone: '+63 912 345 6789',
  province: 'Metro Manila / NCR', city: 'Pasig', barangay: 'Manggahan',
  postalCode: '1611', address: '1611 KC-14', notes: '',
}

const SLOTS = ['09-10', '13-14']
const FLAT_SHIPPING = 99

function orderPayload(over: Record<string, unknown> = {}) {
  // `customer` is pulled out of the overrides before the final spread: leaving
  // it in means `...over` puts the raw override back, throwing away the merged
  // defaults. A caller passing `{ customer: { email } }` would then post a
  // customer with no first/last name, and the order INSERT would fail on the
  // NOT NULL columns — which reads as "the voucher rejected everyone" rather
  // than as the payload bug it is.
  const { customer, ...rest } = over
  return {
    customer: { ...CUSTOMER, email: uniqueEmail('api'), ...(customer as object ?? {}) },
    items: [{ id: '7-shot', name: 'Aconchego Classic', shots: 7, price: 449, quantity: 1 }],
    subtotal: 449,
    deliverySlots: SLOTS,
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

/* ── Admin authorization ── */

test.describe('admin voucher API requires the admin session', () => {
  // A fresh context with no cookies — the admin routes must not serve it.
  test('rejects every method when unauthenticated', async ({ playwright, baseURL }) => {
    const anon: APIRequestContext = await playwright.request.newContext({ baseURL })
    const voucher = await seedVoucher({ code: 'E2EAUTHZ' })

    expect((await anon.get('/api/admin/vouchers')).status()).toBe(401)
    expect((await anon.post('/api/admin/vouchers', {
      data: { code: 'E2EHACKED', discount_type: 'percent', discount_value: 99 },
    })).status()).toBe(401)
    expect((await anon.patch(`/api/admin/vouchers/${voucher.id}`, {
      data: { is_active: false },
    })).status()).toBe(401)
    expect((await anon.delete(`/api/admin/vouchers/${voucher.id}`)).status()).toBe(401)

    // Nothing got through.
    expect(await getVoucher('E2EHACKED')).toBeNull()
    expect((await getVoucher('E2EAUTHZ'))!.is_active).toBe(true)

    await anon.dispose()
  })

  test('rejects a forged session cookie', async ({ playwright, baseURL }) => {
    const forged = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: { cookie: 'mmc_admin=not-a-real-token' },
    })
    expect((await forged.get('/api/admin/vouchers')).status()).toBe(401)
    await forged.dispose()
  })

  test('accepts a real session', async ({ request }) => {
    await adminApiLogin(request)
    const res = await request.get('/api/admin/vouchers')
    expect(res.status()).toBe(200)
    expect(Array.isArray(await res.json())).toBe(true)
  })

  test('rejects bad credentials', async ({ request }) => {
    const res = await request.post('/api/admin/login', {
      data: { username: ADMIN_USER, password: `${ADMIN_PASS}-wrong` },
    })
    expect(res.status()).toBe(401)
  })
})

/* ── Validate endpoint ── */

test.describe('POST /api/vouchers/validate', () => {
  test('prices a valid code against the posted subtotal', async ({ request }) => {
    await seedVoucher({ code: 'E2EAPIPCT', discount_type: 'percent', discount_value: 20 })
    const res = await request.post('/api/vouchers/validate', {
      data: { code: 'e2eapipct', subtotal: 1000 },
    })
    expect(res.status()).toBe(200)
    expect(await res.json()).toMatchObject({
      code: 'E2EAPIPCT', discount: 200, freeShipping: false, label: '20% off',
    })
  })

  test('rejects a malformed code without touching the database', async ({ request }) => {
    const res = await request.post('/api/vouchers/validate', {
      data: { code: '!!', subtotal: 1000 },
    })
    expect(res.status()).toBe(400)
  })

  test('rejects a negative or non-numeric subtotal', async ({ request }) => {
    await seedVoucher({ code: 'E2EAPINEG' })
    for (const subtotal of [-1, 'lots', null]) {
      const res = await request.post('/api/vouchers/validate', {
        data: { code: 'E2EAPINEG', subtotal },
      })
      expect(res.status()).toBe(400)
    }
  })

  test('reports the specific reason a real code cannot be used', async ({ request }) => {
    await seedVoucher({ code: 'E2EAPIMIN', min_subtotal: 2000 })
    const res = await request.post('/api/vouchers/validate', {
      data: { code: 'E2EAPIMIN', subtotal: 500 },
    })
    expect(res.status()).toBe(422)
    expect((await res.json()).error).toMatch(/₱1,500 more/)
  })

  test('previewing never consumes a redemption', async ({ request }) => {
    const voucher = await seedVoucher({ code: 'E2EAPIPREVIEW', max_redemptions: 1 })
    for (let i = 0; i < 3; i++) {
      const res = await request.post('/api/vouchers/validate', {
        data: { code: 'E2EAPIPREVIEW', subtotal: 1000 },
      })
      expect(res.status()).toBe(200)
    }
    expect((await getVoucher('E2EAPIPREVIEW'))!.redemption_count).toBe(0)
    expect(await countRedemptions(voucher.id)).toBe(0)
  })
})

/* ── Tampering ── */

test.describe('POST /api/orders ignores client-supplied money', () => {
  test('a lied-about subtotal cannot unlock a minimum-spend voucher', async ({ request }) => {
    await seedVoucher({ code: 'E2ETAMPERMIN', discount_type: 'fixed', discount_value: 100, min_subtotal: 5000 })

    // One ₱449 bottle, but the client claims ₱9999 to clear the ₱5000 minimum.
    const res = await request.post('/api/orders', {
      data: orderPayload({ subtotal: 9999, voucherCode: 'E2ETAMPERMIN' }),
    })

    expect(res.status()).toBe(422)
    expect((await res.json()).error).toMatch(/more to use this voucher/)
    expect((await getVoucher('E2ETAMPERMIN'))!.redemption_count).toBe(0)
  })

  test('a lied-about subtotal cannot inflate a percentage discount', async ({ request }) => {
    await seedVoucher({ code: 'E2ETAMPERPCT', discount_type: 'percent', discount_value: 50 })

    const res = await request.post('/api/orders', {
      data: orderPayload({ subtotal: 100_000, voucherCode: 'E2ETAMPERPCT' }),
    })
    expect(res.status()).toBe(200)

    const order = await getOrder((await res.json()).orderId)
    // Priced from the catalog: ₱449, so 50% is ₱224 — not ₱50,000.
    expect(order!.subtotal).toBe(449)
    expect(order!.discount).toBe(224)
    expect(order!.total).toBe(449 - 224 + FLAT_SHIPPING)
  })

  test('a lied-about item price is replaced by the catalog price', async ({ request }) => {
    const res = await request.post('/api/orders', {
      data: orderPayload({
        items: [{ id: '10-shot', name: 'Free Coffee', shots: 999, price: 1, quantity: 2 }],
        subtotal: 2,
      }),
    })
    expect(res.status()).toBe(200)

    const order = await getOrder((await res.json()).orderId)
    expect(order!.subtotal).toBe(599 * 2)
    expect(order!.items[0]).toMatchObject({ id: '10-shot', name: 'Aconchego Reserve', price: 599, quantity: 2 })
  })

  test('an unknown product or absurd quantity is refused outright', async ({ request }) => {
    for (const items of [
      [{ id: 'free-shot', quantity: 1 }],
      [{ id: '4-shot', quantity: 0 }],
      [{ id: '4-shot', quantity: 1.5 }],
      [{ id: '4-shot', quantity: 100_000 }],
      [],
    ]) {
      const res = await request.post('/api/orders', { data: orderPayload({ items }) })
      expect(res.status(), JSON.stringify(items)).toBe(400)
    }
  })

  test('an order still requires a valid delivery-slot selection', async ({ request }) => {
    const res = await request.post('/api/orders', { data: orderPayload({ deliverySlots: ['09-10'] }) })
    expect(res.status()).toBe(400)
    expect((await res.json()).error).toMatch(/morning and one afternoon/)
  })

  test('a voucher deactivated after the preview is refused at submit', async ({ request }) => {
    await seedVoucher({ code: 'E2ERACEOFF', discount_type: 'fixed', discount_value: 100 })

    const preview = await request.post('/api/vouchers/validate', {
      data: { code: 'E2ERACEOFF', subtotal: 449 },
    })
    expect(preview.status()).toBe(200)

    // Admin pulls the voucher between the preview and the submit.
    await adminApiLogin(request)
    const voucher = await getVoucher('E2ERACEOFF')
    await request.patch(`/api/admin/vouchers/${voucher!.id}`, { data: { is_active: false } })

    const res = await request.post('/api/orders', {
      data: orderPayload({ voucherCode: 'E2ERACEOFF' }),
    })
    expect(res.status()).toBe(422)
  })
})

/* ── Concurrency ── */

test.describe('redemption limits hold under concurrent checkout', () => {
  test('a capped voucher is never oversold', async ({ request }) => {
    const CAP = 3
    const ATTEMPTS = 10
    const voucher = await seedVoucher({
      code: 'E2ERACECAP', discount_type: 'fixed', discount_value: 100, max_redemptions: CAP,
    })

    const responses = await Promise.all(
      Array.from({ length: ATTEMPTS }, () =>
        request.post('/api/orders', { data: orderPayload({ voucherCode: 'E2ERACECAP' }) })
      )
    )

    const accepted = responses.filter(r => r.status() === 200)
    const rejected = responses.filter(r => r.status() !== 200)

    expect(accepted).toHaveLength(CAP)
    expect(rejected).toHaveLength(ATTEMPTS - CAP)

    // The counter matches the redemption log, and neither exceeded the cap.
    expect((await getVoucher('E2ERACECAP'))!.redemption_count).toBe(CAP)
    expect(await countRedemptions(voucher.id)).toBe(CAP)

    // Every accepted order actually got the discount it was promised.
    for (const res of accepted) {
      const order = await getOrder((await res.json()).orderId)
      expect(order!.discount).toBe(100)
      expect(order!.voucher_code).toBe('E2ERACECAP')
    }
  })

  test('a one-per-customer voucher survives simultaneous submissions', async ({ request }) => {
    const voucher = await seedVoucher({
      code: 'E2ERACEONCE', discount_type: 'fixed', discount_value: 100, once_per_email: true,
    })
    const email = uniqueEmail('race-once')

    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        request.post('/api/orders', {
          data: orderPayload({ customer: { email }, voucherCode: 'E2ERACEONCE' }),
        })
      )
    )

    expect(responses.filter(r => r.status() === 200)).toHaveLength(1)
    expect((await getVoucher('E2ERACEONCE'))!.redemption_count).toBe(1)
    expect(await countRedemptions(voucher.id)).toBe(1)
  })

  test('a rejected redemption does not burn a slot', async ({ request }) => {
    const voucher = await seedVoucher({
      code: 'E2ENOBURN', discount_type: 'fixed', discount_value: 100, max_redemptions: 2,
    })

    // An order that fails validation after the voucher has been resolved must
    // leave the count untouched.
    const bad = await request.post('/api/orders', {
      data: orderPayload({ deliverySlots: [], voucherCode: 'E2ENOBURN' }),
    })
    expect(bad.status()).toBe(400)
    expect((await getVoucher('E2ENOBURN'))!.redemption_count).toBe(0)

    // Both slots are still available afterwards.
    for (let i = 0; i < 2; i++) {
      const res = await request.post('/api/orders', { data: orderPayload({ voucherCode: 'E2ENOBURN' }) })
      expect(res.status()).toBe(200)
    }
    expect((await getVoucher('E2ENOBURN'))!.redemption_count).toBe(2)
    expect(await countRedemptions(voucher.id)).toBe(2)
  })
})
