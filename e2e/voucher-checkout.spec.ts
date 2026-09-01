// The customer half of the feature: applying a code at checkout, seeing the
// right money, and having the right money land in the database.

import { test, expect } from '@playwright/test'
import {
  addToCartViaShop, applyVoucher, fillCheckout, placeOrder, seedCart,
  subtotalOf, summary, waitForQuote,
} from './helpers/app.ts'
import {
  cleanup, countRedemptions, ensureSchema, getOrder, getVoucher, seedVoucher, sql, uniqueEmail,
} from './helpers/db.ts'

// Pasig + ₱1000 subtotal would trigger the free-shipping promo (D3) and mask
// what a free-delivery voucher does, so most specs order a single ₱449 bottle
// and pay the flat ₱99. Lalamove credentials are withheld from the test server
// (playwright.config.ts), so the fee is deterministically the flat rate.
const CART = [{ productId: '7-shot', quantity: 1 }]
const SUBTOTAL = subtotalOf(CART) // ₱449
const FLAT_SHIPPING = 99

test.beforeAll(async () => {
  await ensureSchema()
  await cleanup()
})

test.afterAll(async () => {
  await cleanup()
})

test.beforeEach(async ({ page }) => {
  await seedCart(page, CART)
})

test('percent voucher discounts the subtotal and the order records it', async ({ page }) => {
  const voucher = await seedVoucher({ code: 'E2EPERCENT20', discount_type: 'percent', discount_value: 20 })
  const email = uniqueEmail('percent')

  await page.goto('/order')
  await fillCheckout(page, { email })
  await waitForQuote(page)

  await applyVoucher(page, 'E2EPERCENT20')

  await expect(summary(page).getByText('E2EPERCENT20')).toBeVisible()
  const discount = Math.floor(SUBTOTAL * 0.2) // ₱89
  await expect(summary(page).getByText(`− ₱${discount.toLocaleString()}`)).toBeVisible()
  await expect(summary(page).getByText(`₱${(SUBTOTAL - discount + FLAT_SHIPPING).toLocaleString()}`)).toBeVisible()

  const orderId = await placeOrder(page)

  const order = await getOrder(orderId)
  expect(order).not.toBeNull()
  expect(order!.subtotal).toBe(SUBTOTAL)
  expect(order!.discount).toBe(discount)
  expect(order!.shipping).toBe(FLAT_SHIPPING)
  expect(order!.total).toBe(SUBTOTAL - discount + FLAT_SHIPPING)
  expect(order!.voucher_code).toBe('E2EPERCENT20')
  expect(order!.voucher_id).toBe(voucher.id)

  // The redemption is recorded and counted.
  expect((await getVoucher('E2EPERCENT20'))!.redemption_count).toBe(1)
  expect(await countRedemptions(voucher.id)).toBe(1)
})

test('percent voucher never discounts more than its peso cap', async ({ page }) => {
  await seedVoucher({ code: 'E2ECAPPED', discount_type: 'percent', discount_value: 50, max_discount: 50 })

  await page.goto('/order')
  await fillCheckout(page, { email: uniqueEmail('capped') })
  await waitForQuote(page)
  await applyVoucher(page, 'E2ECAPPED')

  // 50% of ₱449 is ₱224, but the voucher is capped at ₱50.
  await expect(summary(page).getByText('− ₱50')).toBeVisible()

  const order = await getOrder(await placeOrder(page))
  expect(order!.discount).toBe(50)
  expect(order!.total).toBe(SUBTOTAL - 50 + FLAT_SHIPPING)
})

test('fixed voucher larger than the cart discounts only down to zero', async ({ page }) => {
  await seedVoucher({ code: 'E2EBIGFIXED', discount_type: 'fixed', discount_value: 5000 })

  await page.goto('/order')
  await fillCheckout(page, { email: uniqueEmail('bigfixed') })
  await waitForQuote(page)
  await applyVoucher(page, 'E2EBIGFIXED')

  await expect(summary(page).getByText(`− ₱${SUBTOTAL.toLocaleString()}`)).toBeVisible()

  const order = await getOrder(await placeOrder(page))
  expect(order!.discount).toBe(SUBTOTAL)
  // The customer still pays delivery — the total floors at the shipping fee
  // and never goes negative.
  expect(order!.total).toBe(FLAT_SHIPPING)
})

test('free-delivery voucher waives shipping without touching the subtotal', async ({ page }) => {
  await seedVoucher({ code: 'E2EFREESHIP', discount_type: 'free_shipping' })

  await page.goto('/order')
  await fillCheckout(page, { email: uniqueEmail('freeship') })
  await waitForQuote(page)
  await expect(summary(page).getByText(`₱${FLAT_SHIPPING}`)).toBeVisible()

  await applyVoucher(page, 'E2EFREESHIP')

  // The waived fee is struck through next to "Free".
  await expect(summary(page).getByText('Free')).toBeVisible()
  await expect(summary(page).locator('.line-through')).toHaveText(`₱${FLAT_SHIPPING}`)
  // Nothing comes off the subtotal, so there is no discount row.
  await expect(summary(page).getByText('Voucher discount')).toHaveCount(0)

  const order = await getOrder(await placeOrder(page))
  expect(order!.subtotal).toBe(SUBTOTAL)
  expect(order!.discount).toBe(0)
  expect(order!.shipping).toBe(0)
  expect(order!.total).toBe(SUBTOTAL)
  expect(order!.voucher_code).toBe('E2EFREESHIP')
})

test('an unknown code is rejected without applying anything', async ({ page }) => {
  await page.goto('/order')
  await fillCheckout(page, { email: uniqueEmail('unknown') })
  await waitForQuote(page)

  await applyVoucher(page, 'E2ENOSUCHCODE')

  await expect(page.getByRole('alert')).toHaveText(/isn’t valid/)
  await expect(summary(page).getByText('Voucher discount')).toHaveCount(0)
  await expect(summary(page).getByText(`₱${(SUBTOTAL + FLAT_SHIPPING).toLocaleString()}`)).toBeVisible()
})

test('a deactivated voucher is indistinguishable from a nonexistent one', async ({ page }) => {
  await seedVoucher({ code: 'E2EDISABLED', is_active: false })

  await page.goto('/order')
  await fillCheckout(page, { email: uniqueEmail('disabled') })
  await waitForQuote(page)
  await applyVoucher(page, 'E2EDISABLED')

  await expect(page.getByRole('alert')).toHaveText(/isn’t valid/)
})

test('a minimum-spend voucher explains how much more is needed', async ({ page }) => {
  await seedVoucher({ code: 'E2EMIN1000', min_subtotal: 1000 })

  await page.goto('/order')
  await fillCheckout(page, { email: uniqueEmail('min') })
  await waitForQuote(page)
  await applyVoucher(page, 'E2EMIN1000')

  await expect(page.getByRole('alert')).toHaveText(new RegExp(`₱${(1000 - SUBTOTAL).toLocaleString()} more`))
})

test('an expired voucher is refused, a not-yet-started one too', async ({ page }) => {
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString()
  const hourAway = new Date(Date.now() + 3_600_000).toISOString()
  await seedVoucher({ code: 'E2EEXPIRED', expires_at: hourAgo })
  await seedVoucher({ code: 'E2EFUTURE', starts_at: hourAway })

  await page.goto('/order')
  await fillCheckout(page, { email: uniqueEmail('window') })
  await waitForQuote(page)

  await applyVoucher(page, 'E2EEXPIRED')
  await expect(page.getByRole('alert')).toHaveText(/expired/)

  await applyVoucher(page, 'E2EFUTURE')
  await expect(page.getByRole('alert')).toHaveText(/isn’t active yet/)
})

test('a fully redeemed voucher is refused', async ({ page }) => {
  const voucher = await seedVoucher({ code: 'E2EUSEDUP', max_redemptions: 1 })
  // Pre-spend the only slot.
  await sql`UPDATE vouchers SET redemption_count = 1 WHERE id = ${voucher.id}`

  await page.goto('/order')
  await fillCheckout(page, { email: uniqueEmail('usedup') })
  await waitForQuote(page)
  await applyVoucher(page, 'E2EUSEDUP')

  await expect(page.getByRole('alert')).toHaveText(/fully redeemed/)
  expect((await getVoucher('E2EUSEDUP'))!.redemption_count).toBe(1)
})

test('a one-per-customer voucher is refused on the same email a second time', async ({ page }) => {
  await seedVoucher({ code: 'E2EONCE', discount_type: 'fixed', discount_value: 50, once_per_email: true })
  const email = uniqueEmail('once')

  await page.goto('/order')
  await fillCheckout(page, { email })
  await waitForQuote(page)
  await applyVoucher(page, 'E2EONCE')
  await placeOrder(page)

  // Same customer, fresh cart, same code.
  await seedCart(page, CART)
  await page.goto('/order')
  await fillCheckout(page, { email })
  await waitForQuote(page)
  await applyVoucher(page, 'E2EONCE')

  await expect(page.getByRole('alert')).toHaveText(/already used this voucher/)

  // A different customer can still redeem it.
  await seedCart(page, CART)
  await page.goto('/order')
  await fillCheckout(page, { email: uniqueEmail('once-other') })
  await waitForQuote(page)
  await applyVoucher(page, 'E2EONCE')
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('the customer can remove an applied voucher and the total reverts', async ({ page }) => {
  await seedVoucher({ code: 'E2EREMOVE', discount_type: 'fixed', discount_value: 100 })

  await page.goto('/order')
  await fillCheckout(page, { email: uniqueEmail('remove') })
  await waitForQuote(page)
  await applyVoucher(page, 'E2EREMOVE')
  await expect(summary(page).getByText('− ₱100')).toBeVisible()

  await summary(page).getByRole('button', { name: 'Remove' }).click()

  await expect(summary(page).getByText('− ₱100')).toHaveCount(0)
  await expect(summary(page).getByText(`₱${(SUBTOTAL + FLAT_SHIPPING).toLocaleString()}`)).toBeVisible()
  await expect(page.getByLabel('Voucher Code')).toHaveValue('')

  // Placing the order now records no voucher at all.
  const order = await getOrder(await placeOrder(page))
  expect(order!.voucher_code).toBe('')
  expect(order!.discount).toBe(0)
})

test('codes are matched case- and whitespace-insensitively', async ({ page }) => {
  await seedVoucher({ code: 'E2ECASE', discount_type: 'fixed', discount_value: 75 })

  await page.goto('/order')
  await fillCheckout(page, { email: uniqueEmail('case') })
  await waitForQuote(page)
  await applyVoucher(page, '  e2e case  ')

  await expect(summary(page).getByText('E2ECASE')).toBeVisible()
  await expect(summary(page).getByText('− ₱75')).toBeVisible()
})

test('full journey: shop → cart → checkout with a voucher', async ({ page }) => {
  await seedVoucher({ code: 'E2EJOURNEY', discount_type: 'percent', discount_value: 10 })
  const email = uniqueEmail('journey')

  // This spec drives the catalog itself rather than seeding localStorage, so
  // the whole path is covered once end to end.
  await page.addInitScript(() => window.localStorage.removeItem('mmc-cart'))
  await page.goto('/shop')
  await addToCartViaShop(page, '7-shot', 2)

  await page.goto('/cart')
  await expect(page.getByText('Aconchego Classic')).toBeVisible()
  await page.getByRole('link', { name: /Proceed to Checkout/ }).click()
  await page.waitForURL('**/order')

  const subtotal = 449 * 2
  await fillCheckout(page, { email })
  await waitForQuote(page)
  await applyVoucher(page, 'E2EJOURNEY')

  const discount = Math.floor(subtotal * 0.1)
  await expect(summary(page).getByText(`− ₱${discount}`)).toBeVisible()

  const orderId = await placeOrder(page)

  // The success screen must show what was actually owed, not a total
  // recomputed from the cart it just emptied.
  await expect(page.getByText(`₱${(subtotal - discount + FLAT_SHIPPING).toLocaleString()}`)).toBeVisible()

  const order = await getOrder(orderId)
  expect(order!.subtotal).toBe(subtotal)
  expect(order!.discount).toBe(discount)
  expect(order!.items).toHaveLength(1)
  expect(order!.items[0]).toMatchObject({ id: '7-shot', quantity: 2, price: 449 })

  // The cart is emptied once the order is placed.
  await page.goto('/cart')
  await expect(page.getByText('Your cart is empty')).toBeVisible()
})
