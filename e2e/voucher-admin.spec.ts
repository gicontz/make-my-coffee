// The admin half of the feature: creating, editing, deactivating and deleting
// vouchers through the backoffice UI.

import { test, expect } from '@playwright/test'
import { adminLogin, fillVoucherForm, voucherCard } from './helpers/app.ts'
import { cleanup, ensureSchema, getVoucher, seedVoucher, sql } from './helpers/db.ts'

test.beforeAll(async () => {
  await ensureSchema()
  await cleanup()
})

test.afterAll(async () => {
  await cleanup()
})

test.beforeEach(async ({ page }) => {
  await adminLogin(page)
  await page.goto('/admin/vouchers')
})

test('the vouchers section is reachable from the admin sidebar', async ({ page }) => {
  await page.goto('/admin/dashboard')
  await page.getByRole('link', { name: 'Vouchers' }).click()
  await page.waitForURL('**/admin/vouchers')
  await expect(page.getByRole('heading', { name: 'Vouchers' })).toBeVisible()
})

test('creates a percentage voucher with every rule set', async ({ page }) => {
  await page.getByRole('button', { name: 'New Voucher' }).click()
  await fillVoucherForm(page, {
    code: 'E2EADMINPCT',
    description: 'Admin-created percentage voucher',
    type: 'percent',
    value: '25',
    maxDiscount: '200',
    minSubtotal: '500',
    maxRedemptions: '10',
    oncePerEmail: true,
    // datetime-local values are Manila wall-clock; the page converts to UTC.
    startsAt: '2026-01-01T00:00',
    expiresAt: '2027-01-01T00:00',
  })
  await page.getByRole('button', { name: 'Create Voucher' }).click()

  await expect(voucherCard(page, 'E2EADMINPCT')).toBeVisible()
  await expect(voucherCard(page, 'E2EADMINPCT')).toContainText('25% off (max ₱200)')
  await expect(voucherCard(page, 'E2EADMINPCT')).toContainText('Min. spend ₱500')
  await expect(voucherCard(page, 'E2EADMINPCT')).toContainText('One per customer')
  await expect(voucherCard(page, 'E2EADMINPCT')).toContainText('0 / 10')

  const saved = await getVoucher('E2EADMINPCT')
  expect(saved).toMatchObject({
    discount_type: 'percent', discount_value: 25, max_discount: 200,
    min_subtotal: 500, max_redemptions: 10, once_per_email: true, is_active: true,
  })

  // Manila midnight on 2026-01-01 is 16:00 UTC on 2025-12-31 (UTC+8, no DST).
  expect(new Date(saved!.starts_at as unknown as string).toISOString()).toBe('2025-12-31T16:00:00.000Z')
})

test('creates a fixed-amount voucher and a free-delivery voucher', async ({ page }) => {
  await page.getByRole('button', { name: 'New Voucher' }).click()
  await fillVoucherForm(page, { code: 'E2EADMINFIX', type: 'fixed', value: '150' })
  await page.getByRole('button', { name: 'Create Voucher' }).click()
  await expect(voucherCard(page, 'E2EADMINFIX')).toContainText('₱150 off')

  await page.getByRole('button', { name: 'New Voucher' }).click()
  await fillVoucherForm(page, { code: 'E2EADMINSHIP', type: 'free_shipping' })
  await page.getByRole('button', { name: 'Create Voucher' }).click()
  await expect(voucherCard(page, 'E2EADMINSHIP')).toContainText('Free delivery')

  expect((await getVoucher('E2EADMINFIX'))!.discount_type).toBe('fixed')
  expect((await getVoucher('E2EADMINSHIP'))!.discount_type).toBe('free_shipping')
})

test('normalizes the code and rejects a duplicate', async ({ page }) => {
  await seedVoucher({ code: 'E2EDUPE' })
  await page.reload()

  await page.getByRole('button', { name: 'New Voucher' }).click()
  await fillVoucherForm(page, { code: 'e2edupe', type: 'percent', value: '5' })
  await page.getByRole('button', { name: 'Create Voucher' }).click()

  await expect(page.getByText('A voucher with that code already exists.')).toBeVisible()
})

test('rejects a percentage outside 1–100 and an expiry before the start', async ({ page }) => {
  await page.getByRole('button', { name: 'New Voucher' }).click()

  // The number input is bounded, so post the out-of-range value the way a
  // tampered client would — the server is what must refuse it.
  const bad = await page.request.post('/api/admin/vouchers', {
    data: { code: 'E2EBADPCT', discount_type: 'percent', discount_value: 150 },
  })
  expect(bad.status()).toBe(400)
  expect((await bad.json()).error).toMatch(/between 1 and 100/)

  await fillVoucherForm(page, {
    code: 'E2EBADWINDOW', type: 'percent', value: '10',
    startsAt: '2027-01-01T00:00', expiresAt: '2026-01-01T00:00',
  })
  await page.getByRole('button', { name: 'Create Voucher' }).click()
  await expect(page.getByText('Expiry must be after the start date.')).toBeVisible()

  expect(await getVoucher('E2EBADPCT')).toBeNull()
  expect(await getVoucher('E2EBADWINDOW')).toBeNull()
})

test('edits a voucher without resetting how often it has been redeemed', async ({ page }) => {
  await seedVoucher({ code: 'E2EEDIT', discount_type: 'percent', discount_value: 10, max_redemptions: 5 })
  await sql`UPDATE vouchers SET redemption_count = 3 WHERE code = 'E2EEDIT'`
  await page.reload()

  await voucherCard(page, 'E2EEDIT').getByRole('button', { name: 'Edit' }).click()
  await page.getByLabel('Percentage *').fill('30')
  await page.getByLabel('Redemption limit').fill('20')
  await page.getByRole('button', { name: 'Save Changes' }).click()

  await expect(voucherCard(page, 'E2EEDIT')).toContainText('30% off')
  await expect(voucherCard(page, 'E2EEDIT')).toContainText('3 / 20')

  const saved = await getVoucher('E2EEDIT')
  expect(saved!.discount_value).toBe(30)
  // The spent slots survive the edit — resetting them would hand back
  // redemptions customers already used.
  expect(saved!.redemption_count).toBe(3)
})

test('deactivates and reactivates a voucher', async ({ page }) => {
  await seedVoucher({ code: 'E2ETOGGLE' })
  await page.reload()

  await expect(voucherCard(page, 'E2ETOGGLE')).toContainText('Active')
  await voucherCard(page, 'E2ETOGGLE').getByRole('button', { name: 'Deactivate' }).click()

  await expect(voucherCard(page, 'E2ETOGGLE')).toContainText('Inactive')
  expect((await getVoucher('E2ETOGGLE'))!.is_active).toBe(false)

  await voucherCard(page, 'E2ETOGGLE').getByRole('button', { name: 'Activate' }).click()
  await expect(voucherCard(page, 'E2ETOGGLE')).toContainText('Active')
  expect((await getVoucher('E2ETOGGLE'))!.is_active).toBe(true)
})

test('shows why a voucher is not usable', async ({ page }) => {
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString()
  const hourAway = new Date(Date.now() + 3_600_000).toISOString()
  await seedVoucher({ code: 'E2ESTATEEXPIRED', expires_at: hourAgo })
  await seedVoucher({ code: 'E2ESTATEFUTURE', starts_at: hourAway })
  await seedVoucher({ code: 'E2ESTATEFULL', max_redemptions: 2 })
  await sql`UPDATE vouchers SET redemption_count = 2 WHERE code = 'E2ESTATEFULL'`
  await page.reload()

  await expect(voucherCard(page, 'E2ESTATEEXPIRED')).toContainText('Expired')
  await expect(voucherCard(page, 'E2ESTATEFUTURE')).toContainText('Scheduled')
  await expect(voucherCard(page, 'E2ESTATEFULL')).toContainText('Used up')
})

test('deletes an unredeemed voucher but refuses to delete a redeemed one', async ({ page }) => {
  await seedVoucher({ code: 'E2EDELETEOK' })
  const used = await seedVoucher({ code: 'E2EDELETENO' })
  await sql`UPDATE vouchers SET redemption_count = 1 WHERE id = ${used.id}`
  await page.reload()

  // A redeemed voucher is order history, so the UI doesn't even offer Delete.
  await expect(voucherCard(page, 'E2EDELETENO').getByRole('button', { name: 'Delete' })).toHaveCount(0)

  // …and the API refuses it outright, however it is called.
  const refused = await page.request.delete(`/api/admin/vouchers/${used.id}`)
  expect(refused.status()).toBe(409)
  expect((await refused.json()).error).toMatch(/Deactivate it instead/)
  expect(await getVoucher('E2EDELETENO')).not.toBeNull()

  page.once('dialog', dialog => dialog.accept())
  await voucherCard(page, 'E2EDELETEOK').getByRole('button', { name: 'Delete' }).click()

  await expect(voucherCard(page, 'E2EDELETEOK')).toHaveCount(0)
  expect(await getVoucher('E2EDELETEOK')).toBeNull()
})

test('shows an empty state when there are no vouchers', async ({ page }) => {
  await cleanup()
  await page.reload()
  await expect(page.getByText('No vouchers yet.')).toBeVisible()
})
