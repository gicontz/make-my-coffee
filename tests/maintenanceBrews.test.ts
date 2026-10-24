// Input validation for the maintenance brew log (issue #51). The form is a
// convenience; validateMaintenanceBrewInput() is what stands between a request
// and the table, so the edges live here. Whether an operator id exists needs
// the database and is checked by the route's INSERT … SELECT.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  ACTIVITY_MAX_LENGTH,
  MAX_BEANS_GRAMS,
  gramsUsed,
  parseBrewId,
  parseCloseStatus,
  validateMaintenanceBrewInput,
} from '../lib/maintenanceBrews.ts'
import { isUndefinedTable } from '../lib/dbErrors.ts'

const VALID = { activity: 'Dialing in after burr change', beansGrams: 18, operatorId: 1 }

test('accepts a valid brew and trims the activity', () => {
  assert.deepEqual(validateMaintenanceBrewInput({ ...VALID, activity: '  Backflush  ' }), {
    values: { activity: 'Backflush', beansGrams: 18, operatorId: 1 },
  })
})

test('accepts digit strings for the numbers', () => {
  const r = validateMaintenanceBrewInput({ ...VALID, beansGrams: '36', operatorId: '3' })
  assert.deepEqual(r.values, { activity: VALID.activity, beansGrams: 36, operatorId: 3 })
})

test('rejects a body that is not an object', () => {
  for (const body of [null, undefined, 'x', 42]) {
    assert.ok(validateMaintenanceBrewInput(body).error, `accepted ${JSON.stringify(body)}`)
  }
})

test('activity is required and non-blank', () => {
  for (const activity of [undefined, '', '   ', 7, null]) {
    const r = validateMaintenanceBrewInput({ ...VALID, activity })
    assert.match(r.error ?? '', /activity/i, `accepted activity ${JSON.stringify(activity)}`)
  }
})

test('activity length matches the column CHECK, counted in code points', () => {
  assert.ok(validateMaintenanceBrewInput({ ...VALID, activity: 'a'.repeat(ACTIVITY_MAX_LENGTH) }).values)
  assert.ok(validateMaintenanceBrewInput({ ...VALID, activity: 'a'.repeat(ACTIVITY_MAX_LENGTH + 1) }).error)
  // 200 emoji are 400 UTF-16 units but 200 characters to Postgres.
  assert.ok(validateMaintenanceBrewInput({ ...VALID, activity: '☕'.repeat(ACTIVITY_MAX_LENGTH) }).values)
  assert.ok(validateMaintenanceBrewInput({ ...VALID, activity: '🫘'.repeat(ACTIVITY_MAX_LENGTH) }).values)
})

test('grams must be a positive whole number', () => {
  for (const beansGrams of [0, -1, 1.5, '1.5', '', ' ', 'abc', '1e3', true, null, undefined, NaN, Infinity]) {
    const r = validateMaintenanceBrewInput({ ...VALID, beansGrams })
    assert.match(r.error ?? '', /grams|beans/i, `accepted beansGrams ${String(beansGrams)}`)
  }
  assert.equal(validateMaintenanceBrewInput({ ...VALID, beansGrams: 1 }).values?.beansGrams, 1)
})

test('grams above the typo guard are rejected', () => {
  assert.ok(validateMaintenanceBrewInput({ ...VALID, beansGrams: MAX_BEANS_GRAMS }).values)
  assert.ok(validateMaintenanceBrewInput({ ...VALID, beansGrams: MAX_BEANS_GRAMS + 1 }).error)
  // Past INTEGER's range would otherwise surface as a database 500.
  assert.ok(validateMaintenanceBrewInput({ ...VALID, beansGrams: 2 ** 31 }).error)
})

test('an assignee is required', () => {
  for (const operatorId of [undefined, null, '', 0, -2, 1.5, 'Gim', true]) {
    const r = validateMaintenanceBrewInput({ ...VALID, operatorId })
    assert.match(r.error ?? '', /assignee/i, `accepted operatorId ${String(operatorId)}`)
  }
})

test('status cannot be chosen by the request', () => {
  // A new brew is always in_progress; extra fields are dropped, not honoured.
  const r = validateMaintenanceBrewInput({ ...VALID, status: 'done', done_at: '2026-01-01' })
  assert.deepEqual(Object.keys(r.values ?? {}).sort(), ['activity', 'beansGrams', 'operatorId'])
})

test('brew ids are positive integers within SERIAL range', () => {
  assert.equal(parseBrewId('12'), 12)
  for (const raw of ['0', '-1', '1.5', 'abc', '', ' 3', '1e2', '2147483648']) {
    assert.equal(parseBrewId(raw), null, `accepted id ${JSON.stringify(raw)}`)
  }
})

test('isUndefinedTable recognises a missing table', () => {
  const missing = { code: '42P01', message: 'relation "maintenance_brews" does not exist' }
  assert.equal(isUndefinedTable(missing), true)
  assert.equal(isUndefinedTable(missing, 'maintenance_brews'), true)
  assert.equal(isUndefinedTable(missing, 'operators'), false)
  assert.equal(isUndefinedTable({ code: '42703', message: 'column "x" does not exist' }), false)
  assert.equal(isUndefinedTable(null), false)
})

test('closing needs an explicit done or failed', () => {
  assert.equal(parseCloseStatus({ status: 'done' }), 'done')
  assert.equal(parseCloseStatus({ status: 'failed' }), 'failed')
  // A bare PATCH must not default to either: defaulting to done would count a
  // malformed "failed" request's grams as beans used.
  for (const body of [null, undefined, {}, { status: 'in_progress' }, { status: 'DONE' }, { status: true }, 'done']) {
    assert.equal(parseCloseStatus(body), null, `accepted ${JSON.stringify(body)}`)
  }
})

test('failed brews are not beans used', () => {
  const brews = [
    { status: 'done' as const, beans_grams: 18 },
    { status: 'failed' as const, beans_grams: 500 },
    { status: 'in_progress' as const, beans_grams: 36 },
    { status: 'done' as const, beans_grams: 54 },
  ]
  // In-progress isn't counted either: it may yet be marked failed, and a
  // total that drops later is worse than one that only grows.
  assert.equal(gramsUsed(brews), 72)
  assert.equal(gramsUsed([]), 0)
})

test('closing is a one-way, real transition', () => {
  // Same guard as order status: without it a second click re-stamps the time,
  // or a done brew is flipped to failed and drops out of the total.
  const route = readFileSync(
    fileURLToPath(new URL('../app/api/admin/maintenance-brews/[id]/route.ts', import.meta.url)),
    'utf8'
  )
  const updates = route.match(/UPDATE maintenance_brews[\s\S]*?RETURNING/g) ?? []
  assert.equal(updates.length, 2, 'expected one UPDATE for done and one for failed')
  for (const u of updates) assert.match(u, /WHERE id = \$\{id\} AND status = 'in_progress'/)
  assert.match(updates.join('\n'), /SET status = 'done', done_at = NOW\(\)/)
  assert.match(updates.join('\n'), /SET status = 'failed', failed_at = NOW\(\)/)
  assert.doesNotMatch(route, /SET status = \$\{/, 'the status written must be a literal, never the request value')
})

test('db-setup.sql mirrors migration 0011', () => {
  const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8')
  const setup = read('../lib/db-setup.sql')
  const statements = read('../lib/migrations/0011_add_maintenance_brews.sql')
    .split('\n')
    .filter(line => !line.startsWith('--'))
    .join('\n')
    .split(';')
    .map(s => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  const normalisedSetup = setup.replace(/\s+/g, ' ')
  for (const s of statements) {
    assert.ok(normalisedSetup.includes(s), `db-setup.sql is missing: ${s.slice(0, 80)}…`)
  }
})
