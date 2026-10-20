// The undefined-column check behind the /admin/vouchers fallback (#52).

import test from 'node:test'
import assert from 'node:assert/strict'

import { isUndefinedColumn } from '../lib/dbErrors.ts'

const missingKind = Object.assign(new Error('column "kind" does not exist'), { code: '42703' })

test('matches a 42703 for the named column', () => {
  assert.equal(isUndefinedColumn(missingKind, 'kind'), true)
  assert.equal(isUndefinedColumn(missingKind), true)
})

test('does not match a different missing column', () => {
  assert.equal(isUndefinedColumn(missingKind, 'kind_v2'), false)
  assert.equal(isUndefinedColumn(missingKind, 'paid_at'), false)
})

test('ignores other errors and non-errors', () => {
  const missingTable = Object.assign(new Error('relation "vouchers" does not exist'), { code: '42P01' })
  assert.equal(isUndefinedColumn(missingTable, 'kind'), false)
  assert.equal(isUndefinedColumn(new Error('column "kind" does not exist'), 'kind'), false)
  assert.equal(isUndefinedColumn(null), false)
  assert.equal(isUndefinedColumn('42703'), false)
})
