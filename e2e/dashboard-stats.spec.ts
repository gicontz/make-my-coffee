// What the dashboard is allowed to call revenue.
//
// The bug this pins down: every figure in lib/stats.ts used to be SUM(total)
// over all orders, with no regard for status. A store whose whole history was
// five cancelled orders and one unpaid one reported ₱3,379 of "revenue" while
// holding ₱0. Revenue now means paid and not cancelled; everything else is
// reported separately rather than folded in.
//
// Assertions are deltas around the seeded fixtures, not absolutes: the e2e
// branch is a copy of a real database and already holds orders of its own.

import { test, expect, type APIRequestContext } from '@playwright/test'
import { adminApiLogin } from './helpers/app.ts'
import { cleanup, ensureSchema, seedOrder } from './helpers/db.ts'

interface Stats {
  today: { orders: number; revenue: number; uncollected: number; cancelled: number }
  all: { orders: number; revenue: number; uncollected: number; cancelled: number; cancelledValue: number }
  pendingCount: number
  awaitingCollection: { count: number; value: number }
  daily: { date: string; orders: number; revenue: number; uncollected: number }[]
}

async function fetchStats(request: APIRequestContext): Promise<Stats> {
  const res = await request.get('/api/admin/stats')
  expect(res.ok(), 'admin stats should be readable once logged in').toBeTruthy()
  return (await res.json()) as Stats
}

// 00:30 on today's Manila date, as an absolute instant. Manila is UTC+8 with
// no DST, so this is always 16:30 on the *previous* UTC day — the exact case a
// server-timezone CURRENT_DATE files under yesterday.
function manilaEarlyMorningToday(): string {
  const manilaDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())
  return new Date(`${manilaDate}T00:30:00+08:00`).toISOString()
}

test.beforeAll(async () => {
  await ensureSchema()
  await cleanup()
})

test.afterAll(async () => {
  await cleanup()
})

test('revenue counts only paid, non-cancelled orders', async ({ request }) => {
  await adminApiLogin(request)
  const before = await fetchStats(request)

  await seedOrder({ total: 1000, order_status: 'delivered', payment_status: 'paid' })
  await seedOrder({ total: 500,  order_status: 'delivered', payment_status: 'unpaid' })
  await seedOrder({ total: 700,  order_status: 'cancelled', payment_status: 'paid' })
  await seedOrder({ total: 300,  order_status: 'cancelled', payment_status: 'unpaid' })

  const after = await fetchStats(request)

  // Only the paid, delivered ₱1,000 is revenue. Not the unpaid delivery, and
  // not the cancelled order that was somehow marked paid — that one needs a
  // refund, not a line in the earnings.
  expect(after.all.revenue - before.all.revenue).toBe(1000)
  expect(after.all.uncollected - before.all.uncollected).toBe(500)
  expect(after.all.cancelled - before.all.cancelled).toBe(2)
  expect(after.all.cancelledValue - before.all.cancelledValue).toBe(1000)
  expect(after.all.orders - before.all.orders).toBe(4)

  // Cancelled and delivered are both terminal — none of these is "open".
  expect(after.pendingCount).toBe(before.pendingCount)

  // The COD nudge: delivered but still unpaid is money that should be in hand.
  expect(after.awaitingCollection.count - before.awaitingCollection.count).toBe(1)
  expect(after.awaitingCollection.value - before.awaitingCollection.value).toBe(500)
})

test('a Manila-morning order counts as today, not yesterday', async ({ request }) => {
  await adminApiLogin(request)
  const before = await fetchStats(request)

  // Today in Manila, yesterday in UTC.
  await seedOrder({
    total: 250,
    order_status: 'delivered',
    payment_status: 'paid',
    createdAt: manilaEarlyMorningToday(),
  })

  const after = await fetchStats(request)

  expect(after.today.orders - before.today.orders).toBe(1)
  expect(after.today.revenue - before.today.revenue).toBe(250)

  // The daily series is Manila days too, so it must land in the last bucket.
  const lastBefore = before.daily[before.daily.length - 1]
  const lastAfter = after.daily[after.daily.length - 1]
  expect(lastAfter.date).toBe(lastBefore.date)
  expect(lastAfter.revenue - lastBefore.revenue).toBe(250)
  expect(lastAfter.orders - lastBefore.orders).toBe(1)
})

test('revenue is bucketed by the day it was paid, not the day it was placed', async ({ request }) => {
  await adminApiLogin(request)
  const before = await fetchStats(request)

  // Placed a week ago, paid just now — a COD order that took a while to
  // collect. It must count as last week's order but today's revenue.
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  await seedOrder({
    total: 599,
    order_status: 'delivered',
    payment_status: 'paid',
    createdAt: weekAgo,
    paidAt: new Date().toISOString(),
  })

  const after = await fetchStats(request)

  expect(after.today.revenue - before.today.revenue).toBe(599)
  expect(after.today.orders).toBe(before.today.orders) // not placed today
  expect(after.all.revenue - before.all.revenue).toBe(599) // still counted overall

  const lastBefore = before.daily[before.daily.length - 1]
  const lastAfter = after.daily[after.daily.length - 1]
  expect(lastAfter.revenue - lastBefore.revenue).toBe(599)
  expect(lastAfter.orders).toBe(lastBefore.orders) // the order bar didn't move
})

test("today's uncollected is reported apart from today's revenue", async ({ request }) => {
  await adminApiLogin(request)
  const before = await fetchStats(request)

  await seedOrder({ total: 450, order_status: 'shipped',   payment_status: 'unpaid' })
  await seedOrder({ total: 900, order_status: 'cancelled', payment_status: 'unpaid' })

  const after = await fetchStats(request)

  expect(after.today.revenue).toBe(before.today.revenue)          // nothing was paid
  expect(after.today.uncollected - before.today.uncollected).toBe(450) // cancelled ₱900 excluded
  expect(after.today.cancelled - before.today.cancelled).toBe(1)
  expect(after.pendingCount - before.pendingCount).toBe(1)        // the shipped one is still open
})
