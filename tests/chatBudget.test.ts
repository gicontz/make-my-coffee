// The model-spend cap behind the on-site chat.
//
// POST /api/chat is public with nothing in front of it — no Meta, no login —
// so this is the difference between a support bot and free compute for whoever
// finds the endpoint. The rule has to be right and it has to fail *closed*.

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  MAX_ASSISTANT_CALLS_PER_SESSION,
  manilaDay,
  nextAssistantBudget,
} from '../lib/chat/budget.ts'

test('counts up while there is budget left', () => {
  const state = nextAssistantBudget({ assistant_calls: 3, assistant_day: '2026-09-08' }, '2026-09-08')
  assert.deepEqual(state, { calls: 4, day: '2026-09-08', allowed: true })
})

test('refuses once the daily allowance is spent, without inflating the count', () => {
  const spent = { assistant_calls: MAX_ASSISTANT_CALLS_PER_SESSION, assistant_day: '2026-09-08' }
  const state = nextAssistantBudget(spent, '2026-09-08')
  assert.equal(state.allowed, false)
  // The counter must not keep climbing on refused calls, or a visitor who
  // hammers the endpoint pushes the stored number arbitrarily high.
  assert.equal(state.calls, MAX_ASSISTANT_CALLS_PER_SESSION)
})

test('the very last call in the allowance is permitted', () => {
  const state = nextAssistantBudget(
    { assistant_calls: MAX_ASSISTANT_CALLS_PER_SESSION - 1, assistant_day: '2026-09-08' },
    '2026-09-08'
  )
  assert.equal(state.allowed, true)
  assert.equal(state.calls, MAX_ASSISTANT_CALLS_PER_SESSION)
})

test('a new day resets the allowance rather than expiring rows', () => {
  const yesterday = { assistant_calls: MAX_ASSISTANT_CALLS_PER_SESSION, assistant_day: '2026-09-07' }
  const state = nextAssistantBudget(yesterday, '2026-09-08')
  assert.deepEqual(state, { calls: 1, day: '2026-09-08', allowed: true })
})

test('the day boundary is Manila, not the runtime zone', () => {
  // 2026-09-07 17:00 UTC is already 2026-09-08 in Manila (UTC+8). Vercel runs
  // in UTC, so trusting the runtime would reset the cap in the middle of a
  // Philippine evening — the same trap lib/stats.ts documents for revenue.
  assert.equal(manilaDay(new Date('2026-09-07T17:00:00.000Z')), '2026-09-08')
  assert.equal(manilaDay(new Date('2026-09-07T15:59:00.000Z')), '2026-09-07')
})

test('the day format matches what the column is compared against', () => {
  // Compared to `assistant_day::text` from Postgres, which is ISO. A localised
  // format here would never match and the cap would reset on every call.
  assert.match(manilaDay(new Date('2026-01-05T04:00:00.000Z')), /^\d{4}-\d{2}-\d{2}$/)
})
