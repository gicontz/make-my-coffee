// Page-object helpers, so the specs read as journeys rather than selector soup.
//
// Selector note: most of this app's <label>s are styled headings that aren't
// associated with their input (no htmlFor/id), so getByLabel doesn't reach
// them. Fields are addressed by their `name` attribute instead, and the login
// form — which has neither — by its autocomplete tokens. The fields this
// feature added do carry proper label/id pairs and are addressed by role.

import { expect, type APIRequestContext, type Page } from '@playwright/test'
import { products } from '../../lib/products.ts'

export const ADMIN_USER = process.env.E2E_ADMIN_USERNAME || 'admin'
export const ADMIN_PASS = process.env.E2E_ADMIN_PASSWORD || 'e2e-password'

/* ── Cart ── */

export interface CartLine {
  productId: string
  quantity: number
}

// Seeds the cart the way CartContext persists it (localStorage key `mmc-cart`,
// D7), before any page script runs. Used as a *precondition* by specs whose
// subject is the voucher, not the catalog — shop-to-cart is exercised through
// the real UI in the full-journey spec.
export async function seedCart(page: Page, lines: CartLine[]) {
  const items = lines.map(line => {
    const product = products.find(p => p.id === line.productId)
    if (!product) throw new Error(`Unknown product id: ${line.productId}`)
    return { product, quantity: line.quantity }
  })
  await page.addInitScript(
    value => window.localStorage.setItem('mmc-cart', value),
    JSON.stringify(items)
  )
}

export function subtotalOf(lines: CartLine[]): number {
  return lines.reduce((sum, line) => {
    const product = products.find(p => p.id === line.productId)!
    return sum + product.price * line.quantity
  }, 0)
}

// Clicks a product's real "Add to Cart" button on /shop. The button swaps to
// "Added!" for 1.6s, so repeat clicks wait for it to swap back.
export async function addToCartViaShop(page: Page, productId: string, times = 1) {
  const index = products.findIndex(p => p.id === productId)
  if (index < 0) throw new Error(`Unknown product id: ${productId}`)

  for (let i = 0; i < times; i++) {
    const button = page.getByRole('button', { name: 'Add to Cart' }).nth(index)
    await button.click()
    await expect(page.getByRole('button', { name: 'Added!' })).toHaveCount(1)
    if (i < times - 1) {
      await expect(page.getByRole('button', { name: 'Added!' })).toHaveCount(0, { timeout: 5_000 })
    }
  }
}

/* ── Checkout ── */

export interface CheckoutCustomer {
  firstName?: string
  lastName?: string
  email: string
  phone?: string
  province?: string
  city?: string
  barangay?: string
  postalCode?: string
  address?: string
}

// Fills every required checkout field except the voucher. The map pin is
// deliberately left unset — it is optional by design (D10), and skipping it
// keeps Leaflet and the geocoder out of the test.
export async function fillCheckout(page: Page, customer: CheckoutCustomer) {
  await page.locator('input[name="firstName"]').fill(customer.firstName ?? 'Juan')
  await page.locator('input[name="lastName"]').fill(customer.lastName ?? 'dela Cruz')
  await page.locator('input[name="email"]').fill(customer.email)
  await page.locator('input[name="phone"]').fill(customer.phone ?? '+63 912 345 6789')

  await page.locator('select[name="province"]').selectOption(customer.province ?? 'Metro Manila')
  await page.locator('select[name="city"]').selectOption(customer.city ?? 'Pasig')
  await page.locator('input[name="barangay"]').fill(customer.barangay ?? 'Manggahan')
  await page.locator('input[name="postalCode"]').fill(customer.postalCode ?? '1611')
  await page.locator('input[name="address"]').fill(customer.address ?? '1611 KC-14')

  // The slot rule needs at least one morning and one afternoon–evening window
  // (lib/deliverySlots.ts), enforced on both client and server.
  await page.getByRole('button', { name: '9:00 – 10:00 AM' }).click()
  await page.getByRole('button', { name: '1:00 – 2:00 PM' }).click()
}

export async function applyVoucher(page: Page, code: string) {
  await page.getByLabel('Voucher Code').fill(code)
  await page.getByRole('button', { name: 'Apply' }).click()
}

// The order summary is the sticky panel on the right; scoping to it keeps
// "Subtotal"/"Shipping" from matching the same words elsewhere on the page.
export function summary(page: Page) {
  return page.locator('.sticky')
}

// Waits for the debounced /api/shipping/quote round trip to settle so the
// summary shows a final number before anything asserts on the total.
export async function waitForQuote(page: Page) {
  await expect(summary(page).getByText('Calculating…')).toHaveCount(0, { timeout: 20_000 })
  await expect(page.getByRole('button', { name: /Place Order/ })).toBeEnabled()
}

export async function placeOrder(page: Page): Promise<number> {
  await page.getByRole('button', { name: /Place Order/ }).click()
  await expect(page.getByRole('heading', { name: 'Order Placed!' })).toBeVisible({ timeout: 30_000 })
  const text = await page.getByText(/Order #\d+/).first().innerText()
  return Number(text.replace(/\D/g, ''))
}

/* ── Admin ── */

export async function adminLogin(page: Page) {
  await page.goto('/admin/login')
  await page.locator('input[autocomplete="username"]').fill(ADMIN_USER)
  await page.locator('input[autocomplete="current-password"]').fill(ADMIN_PASS)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL(/\/admin\/dashboard/)
}

// Authenticates an APIRequestContext the same way the browser does, for specs
// that exercise the admin API directly.
export async function adminApiLogin(request: APIRequestContext) {
  const res = await request.post('/api/admin/login', {
    data: { username: ADMIN_USER, password: ADMIN_PASS },
  })
  expect(res.ok(), 'admin API login should succeed').toBeTruthy()
}

/* ── Admin voucher form ── */

export interface VoucherFormInput {
  code: string
  description?: string
  type?: 'percent' | 'fixed' | 'free_shipping'
  value?: string
  maxDiscount?: string
  minSubtotal?: string
  maxRedemptions?: string
  oncePerEmail?: boolean
  startsAt?: string
  expiresAt?: string
}

const TYPE_BUTTON = { percent: '% off', fixed: '₱ off', free_shipping: 'Free delivery' } as const

export async function fillVoucherForm(page: Page, input: VoucherFormInput) {
  await page.getByLabel('Code *').fill(input.code)
  if (input.description) await page.getByLabel('Description').fill(input.description)

  const type = input.type ?? 'percent'
  await page.getByRole('button', { name: TYPE_BUTTON[type], exact: true }).click()

  if (type !== 'free_shipping' && input.value !== undefined) {
    await page.getByLabel(type === 'percent' ? 'Percentage *' : 'Amount off (₱) *').fill(input.value)
  }
  if (input.maxDiscount !== undefined) await page.getByLabel('Max discount (₱)').fill(input.maxDiscount)
  if (input.minSubtotal !== undefined) await page.getByLabel('Min. spend (₱)').fill(input.minSubtotal)
  if (input.maxRedemptions !== undefined) await page.getByLabel('Redemption limit').fill(input.maxRedemptions)
  if (input.oncePerEmail) await page.getByText('One use per customer').click()
  if (input.startsAt !== undefined) await page.getByLabel('Starts').fill(input.startsAt)
  if (input.expiresAt !== undefined) await page.getByLabel('Expires').fill(input.expiresAt)
}

// The card in the voucher list for a given code.
export function voucherCard(page: Page, code: string) {
  return page.locator('div.bg-white.rounded-2xl').filter({ hasText: code }).first()
}
