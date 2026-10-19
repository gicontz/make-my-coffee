// Weekly subscriptions (#38): the schedule, the price, the customer's own
// controls, and the manage link.
//
// The issue's hard requirement is that a recurring schedule only ever produces
// dates the server would accept from checkout — tomorrow at the earliest,
// MAX_DAYS_AHEAD at the latest, both in Manila. So the schedule tests don't
// pick a few nice dates; they sweep every hour of five weeks against anchors
// on both sides of "now", and check every result with the same
// validateDeliveryDate() that POST /api/orders runs.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { MAX_DAYS_AHEAD, addDays, earliestDeliveryDate, validateDeliveryDate } from '../lib/deliveryDate.ts'
import { deriveLinkToken, hashLinkToken, isLinkTokenShape } from '../lib/linkToken.ts'
import {
  CADENCE_DAYS,
  SUBSCRIPTION_DISCOUNT_PERCENT,
  SUBSCRIPTION_STATUSES,
  applySubscriptionAction,
  manageTokenMessage,
  nextOnCadence,
  subscriptionDiscount,
  upcomingDelivery,
  type ScheduleState,
} from '../lib/subscriptions.ts'

// 2026-09-19 08:00 UTC is 16:00 Saturday in Manila; earliest delivery is the 20th.
const NOW = new Date('2026-09-19T08:00:00.000Z')

function weekday(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

// ── Price ──────────────────────────────────────────────────────────────────

test('the discount is 10%, floored to whole pesos', () => {
  assert.equal(SUBSCRIPTION_DISCOUNT_PERCENT, 10)
  assert.equal(subscriptionDiscount(449), 44) // 44.9 → never round a peso up
  assert.equal(subscriptionDiscount(299), 29)
  assert.equal(subscriptionDiscount(1000), 100)
  assert.equal(subscriptionDiscount(0), 0)
})

// ── Schedule ───────────────────────────────────────────────────────────────

test('a date far enough ahead is kept as-is', () => {
  assert.equal(nextOnCadence('2026-09-20', NOW), '2026-09-20')
  assert.equal(nextOnCadence('2026-09-25', NOW), '2026-09-25')
})

test('a date that slipped behind rolls forward whole weeks, keeping the weekday', () => {
  // Today (the 19th) can't be served — earliest is tomorrow — so a week on.
  assert.equal(nextOnCadence('2026-09-19', NOW), '2026-09-26')
  assert.equal(nextOnCadence('2026-09-12', NOW), '2026-09-26')
  // Months paused: still the same weekday, still the first servable one.
  assert.equal(nextOnCadence('2026-06-03', NOW), '2026-09-23')
  assert.equal(weekday('2026-09-23'), weekday('2026-06-03'))
})

test('the day boundary is Manila: a UTC evening is already the next day', () => {
  // 17:00 UTC on the 19th is 01:00 on the 20th in Manila; earliest is the 21st.
  const lateUtc = new Date('2026-09-19T17:00:00.000Z')
  assert.equal(nextOnCadence('2026-09-20', lateUtc), '2026-09-27')
})

test('every scheduled date passes the checkout rule, at every hour, for every anchor', () => {
  // Five-hour steps: 5 and 24 share no factor, so across five weeks every
  // hour of the day is visited — Manila's midnight (16:00 UTC) included —
  // at a fraction of the cost of walking every hour.
  const start = Date.parse('2026-12-01T00:00:00.000Z') // crosses a month and a year end
  for (let h = 0; h < 35 * 24; h += 5) {
    const now = new Date(start + h * 3_600_000)
    const earliest = earliestDeliveryDate(now)
    for (let offset = -28; offset <= 14; offset++) {
      const anchor = addDays(earliest, offset)
      const next = nextOnCadence(anchor, now)
      assert.equal(validateDeliveryDate(next, now), null, `anchor ${anchor} at ${now.toISOString()} gave ${next}`)
      assert.equal(weekday(next), weekday(anchor))
      // Never a whole week later than it needed to be.
      if (offset < 0) assert.ok(next < addDays(earliest, CADENCE_DAYS))
    }
  }
})

// ── The customer's controls ────────────────────────────────────────────────

const active: ScheduleState = { status: 'active', nextDeliveryDate: '2026-09-22' }
const paused: ScheduleState = { status: 'paused', nextDeliveryDate: '2026-09-22' }
const cancelled: ScheduleState = { status: 'cancelled', nextDeliveryDate: '2026-09-22' }

test('pause, then resume, lands on the same weekday at the first servable date', () => {
  const p = applySubscriptionAction(active, 'pause', NOW)
  assert.ok(p.ok && p.changed && p.value.status === 'paused')

  // Resumed three weeks later: the 22nd is long gone.
  const later = new Date('2026-10-10T08:00:00.000Z')
  const r = applySubscriptionAction(paused, 'resume', later)
  assert.ok(r.ok && r.changed)
  assert.equal(r.value.status, 'active')
  assert.equal(r.value.nextDeliveryDate, '2026-10-13')
  assert.equal(weekday(r.value.nextDeliveryDate), weekday('2026-09-22'))
  assert.equal(validateDeliveryDate(r.value.nextDeliveryDate, later), null)
})

test('skip moves the next delivery one week, and stops at the booking window', () => {
  let state = active
  const seen: string[] = []
  for (;;) {
    const r = applySubscriptionAction(state, 'skip', NOW)
    if (!r.ok) {
      assert.match(r.error, new RegExp(`${MAX_DAYS_AHEAD} days`))
      assert.match(r.error, /pause/i)
      break
    }
    assert.equal(r.value.nextDeliveryDate, addDays(state.nextDeliveryDate, CADENCE_DAYS))
    assert.equal(validateDeliveryDate(r.value.nextDeliveryDate, NOW), null)
    seen.push(r.value.nextDeliveryDate)
    state = r.value
  }
  // 22nd → 29th → 6th → 13th; the 20th of October is past the 30-day window.
  assert.deepEqual(seen, ['2026-09-29', '2026-10-06', '2026-10-13'])
})

test('skip measures from the real next delivery, not a stale stored one', () => {
  const stale: ScheduleState = { status: 'active', nextDeliveryDate: '2026-09-01' }
  const r = applySubscriptionAction(stale, 'skip', NOW)
  assert.ok(r.ok)
  // The next servable Tuesday is the 22nd; skipping it gives the 29th.
  assert.equal(r.value.nextDeliveryDate, '2026-09-29')
})

test('a paused subscription has nothing to skip', () => {
  const r = applySubscriptionAction(paused, 'skip', NOW)
  assert.ok(!r.ok)
  assert.match(r.error, /resume/i)
})

test('repeating the action you just took changes nothing and is not an error', () => {
  for (const [state, action] of [[paused, 'pause'], [active, 'resume'], [cancelled, 'cancel']] as const) {
    const r = applySubscriptionAction(state, action, NOW)
    assert.ok(r.ok, `${state.status} + ${action}`)
    assert.equal(r.changed, false)
    assert.deepEqual(r.value, state)
  }
})

test('cancel works from active and paused, and is final', () => {
  for (const state of [active, paused]) {
    const r = applySubscriptionAction(state, 'cancel', NOW)
    assert.ok(r.ok && r.changed && r.value.status === 'cancelled')
  }
  for (const action of ['pause', 'resume', 'skip'] as const) {
    const r = applySubscriptionAction(cancelled, action, NOW)
    assert.ok(!r.ok, `cancelled + ${action} must be refused`)
  }
})

test('only an active subscription shows an upcoming delivery', () => {
  assert.equal(upcomingDelivery({ status: 'active', nextDeliveryDate: '2026-09-12' }, NOW), '2026-09-26')
  assert.equal(upcomingDelivery(paused, NOW), null)
  assert.equal(upcomingDelivery(cancelled, NOW), null)
})

// ── Manage link ────────────────────────────────────────────────────────────

test('the manage token is reproducible, versioned, and secret-bound', async () => {
  const a = await deriveLinkToken('secret-one', manageTokenMessage(7, 1))
  assert.ok(isLinkTokenShape(a))
  // Same inputs, same token: every weekly email can carry the same link.
  assert.equal(await deriveLinkToken('secret-one', manageTokenMessage(7, 1)), a)
  // Bumping the version revokes it; another subscription or secret never collides.
  assert.notEqual(await deriveLinkToken('secret-one', manageTokenMessage(7, 2)), a)
  assert.notEqual(await deriveLinkToken('secret-one', manageTokenMessage(8, 1)), a)
  assert.notEqual(await deriveLinkToken('secret-two', manageTokenMessage(7, 1)), a)
  await assert.rejects(deriveLinkToken('', manageTokenMessage(7, 1)))
})

test('only a hash of the token is what gets stored and looked up', async () => {
  const token = await deriveLinkToken('secret-one', manageTokenMessage(7, 1))
  const hash = await hashLinkToken(token)
  assert.match(hash, /^[0-9a-f]{64}$/)
  assert.ok(!hash.includes(token))
  assert.ok(!isLinkTokenShape('7'), 'a bare id is never a valid token')
})

// ── Code that must stay true ───────────────────────────────────────────────

const ROOT = fileURLToPath(new URL('..', import.meta.url))

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx)$/.test(name) ? [path] : []
  })
}

test('statuses match the CHECK constraint in migration 0013', () => {
  const migration = readFileSync(join(ROOT, 'lib/migrations/0013_add_subscriptions.sql'), 'utf8')
  const check = migration.match(/subscriptions_status_chk CHECK \(status IN \(([^)]*)\)\)/)
  assert.ok(check, 'status CHECK not found')
  const inSql = check[1].split(',').map(s => s.trim().replace(/'/g, ''))
  assert.deepEqual(inSql, [...SUBSCRIPTION_STATUSES])
})

test('nothing creates a subscription until billing exists (D15)', () => {
  // Remove this test in the change that adds sign-up *and* the billing for it
  // — not before. A subscription with no way to charge it is the thing #38
  // says is worse than not shipping one.
  const offenders = [...sourceFiles(join(ROOT, 'app')), ...sourceFiles(join(ROOT, 'lib'))]
    .filter(f => /INSERT\s+INTO\s+subscriptions\b/i.test(readFileSync(f, 'utf8')))
  assert.deepEqual(offenders, [])
})

test('the manage view never reads contact or address details', () => {
  // The link is a bearer credential that lives in emails — which get
  // forwarded. Whoever holds it can manage the subscription; they must not
  // learn where the customer lives or how to reach them.
  const store = readFileSync(join(ROOT, 'lib/subscriptionStore.ts'), 'utf8')
  const selects = store.match(/SELECT[\s\S]*?FROM subscriptions/g) ?? []
  const returns = store.match(/RETURNING[^\n]*/g) ?? []
  assert.ok(selects.length > 0 && returns.length > 0)
  for (const q of [...selects, ...returns]) {
    for (const column of ['email', 'phone', 'address', 'barangay', 'city', 'province', 'postal_code', 'notes', 'delivery_lat', 'delivery_lng', 'last_name']) {
      assert.ok(!new RegExp(`\\b${column}\\b`).test(q), `${column} read in: ${q.trim()}`)
    }
  }
})
