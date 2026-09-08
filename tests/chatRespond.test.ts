// The shared decision sequence both channels run.
//
// This is the file that stops the widget and Messenger drifting apart. Every
// assertion here is a rule that must hold on *both*, because there is only one
// implementation — which is the point of lib/chat/respond.ts existing.
//
// The lookup dependency is a stub, so nothing here touches a database or the
// model; what is under test is the routing and, above all, that an order can
// only be revealed through the authorised path.

import test from 'node:test'
import assert from 'node:assert/strict'

import { PAYLOADS, type OrderReference, type TrackableOrder } from '../lib/chat/conversation.ts'
import { respondToPayload, respondToText, type LookupOutcome, type RespondDeps } from '../lib/chat/respond.ts'

const ORDER: TrackableOrder = {
  id: 41,
  order_status: 'shipped',
  payment_status: 'unpaid',
  payment_method: 'gcash',
  total: 548,
  delivery_slots: ['09-10', '13-14'],
  created_at: '2026-09-07T02:00:00.000Z',
}

function deps(over: Partial<RespondDeps> = {}) {
  const calls: { lookups: OrderReference[]; humanRequested: number; assistantAsked: number } = {
    lookups: [], humanRequested: 0, assistantAsked: 0,
  }
  const base: RespondDeps = {
    lookupOrder: async ref => {
      calls.lookups.push(ref)
      return { ok: true, order: ORDER } as LookupOutcome
    },
    verifiedOrder: async () => null,
    onHumanRequested: async () => { calls.humanRequested++ },
    // Default to refusing the model so tests stay offline and deterministic;
    // the fallback path is what most of them are asserting anyway.
    canUseAssistant: async () => { calls.assistantAsked++; return false },
    ...over,
  }
  return { deps: base, calls }
}

test('a tapped button answers from the button table', async () => {
  const { deps: d } = deps()
  const reply = await respondToPayload(PAYLOADS.delivery, d)
  assert.match(reply.text, /₱99/)
  assert.match(reply.text, /Pasig/)
})

test('asking for a human triggers the handoff exactly once', async () => {
  const { deps: d, calls } = deps()
  await respondToPayload(PAYLOADS.human, d)
  assert.equal(calls.humanRequested, 1)
})

test('an unknown payload falls back to the menu instead of failing', async () => {
  const { deps: d } = deps()
  const reply = await respondToPayload('MMC_NOT_A_THING', d)
  assert.ok(reply.quickReplies?.length)
})

test('typing "talk to a human" routes to the handoff, not the model', async () => {
  const { deps: d, calls } = deps()
  await respondToText('talk to a human', d)
  assert.equal(calls.humanRequested, 1)
  assert.equal(calls.assistantAsked, 0, 'a keyword match must not spend model budget')
})

test('a greeting is answered from the menu without spending model budget', async () => {
  const { deps: d, calls } = deps()
  const reply = await respondToText('hi', d)
  assert.ok(reply.quickReplies?.length)
  assert.equal(calls.assistantAsked, 0)
})

test('an order number plus email reaches the lookup and reports the order', async () => {
  const { deps: d, calls } = deps()
  const reply = await respondToText('#41 juan@example.com', d)
  assert.deepEqual(calls.lookups, [{ orderId: 41, email: 'juan@example.com' }])
  assert.match(reply.text, /#41/)
  assert.match(reply.text, /out for delivery/)
})

test('a bare order number never reaches the lookup', async () => {
  // The load-bearing assertion of the whole feature: orders.id is a SERIAL, so
  // if a number alone could resolve, anyone could walk the table.
  for (const text of ['#41', 'where is order 41', 'order 41 please']) {
    const { deps: d, calls } = deps()
    await respondToText(text, d)
    assert.deepEqual(calls.lookups, [], `"${text}" must not reach the lookup`)
  }
})

test('a rate-limited conversation is told so, and not given order data', async () => {
  const { deps: d } = deps({ lookupOrder: async () => ({ ok: false, reason: 'rate_limited' }) })
  const reply = await respondToText('#41 juan@example.com', d)
  assert.match(reply.text, /paused/)
  assert.doesNotMatch(reply.text, /out for delivery/)
})

test('a failed match offers a human rather than a bare no', async () => {
  const { deps: d } = deps({ lookupOrder: async () => ({ ok: false, reason: 'not_found' }) })
  const reply = await respondToText('#41 juan@example.com', d)
  assert.match(reply.text, /couldn't match/i)
  assert.ok(reply.quickReplies?.some(q => q.payload === PAYLOADS.human))
})

test('free text with no model budget degrades to the menu, never to an error', async () => {
  const { deps: d, calls } = deps()
  const reply = await respondToText('do you deliver to cavite on a sunday?', d)
  assert.equal(calls.assistantAsked, 1)
  assert.ok(reply.quickReplies?.length, 'must still offer a way forward')
})

test('empty input is answered rather than crashing', async () => {
  const { deps: d } = deps()
  const reply = await respondToText('   ', d)
  assert.ok(reply.text.length > 0)
})

test('a failing handoff does not take the reply down with it', async () => {
  const { deps: d } = deps({ onHumanRequested: async () => { throw new Error('email is down') } })
  const reply = await respondToPayload(PAYLOADS.human, d)
  // Still the handoff copy, not the generic fallback: the visitor is told
  // someone is coming even when the notification email failed to send.
  assert.match(reply.text, /flagged this for the team/i)
})
