// The parts of the Messenger bot that decide who gets told what.
//
// Two of these carry real weight. The signature check is the only thing
// standing between a public webhook URL and anyone on the internet; and
// parseOrderReference is what stops order lookups from being walkable, since
// `orders.id` is a SERIAL and #1, #2, #3 are guesses anyone can make.

import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'

import { verificationChallenge, verifyWebhookSignature } from '../lib/messenger/signature.ts'
import {
  PAYLOADS,
  formatOrderStatus,
  parseOrderReference,
  payloadForText,
  replyForPayload,
  type TrackableOrder,
} from '../lib/messenger/conversation.ts'
import { truncate } from '../lib/messenger/send.ts'
import { LOOKUP_WINDOW_MINUTES, MAX_FAILED_LOOKUPS, isRateLimited, nextAttemptWindow } from '../lib/messenger/rateLimit.ts'

const SECRET = 'app-secret'
const BODY = '{"object":"page","entry":[]}'
const sign = (body: string, secret = SECRET) =>
  'sha256=' + createHmac('sha256', secret).update(body, 'utf8').digest('hex')

// ── Signature ─────────────────────────────────────────────────────────────

test('accepts a signature computed over the exact body', () => {
  assert.ok(verifyWebhookSignature(BODY, sign(BODY), SECRET))
})

test('rejects a body that changed by one byte', () => {
  // This is the case that catches re-serialised JSON: same data, different
  // bytes, and the hash no longer matches.
  assert.equal(verifyWebhookSignature(BODY + ' ', sign(BODY), SECRET), false)
})

test('rejects a signature from a different secret', () => {
  assert.equal(verifyWebhookSignature(BODY, sign(BODY, 'someone-elses-app'), SECRET), false)
})

test('fails closed when no secret is configured', () => {
  // An unconfigured deployment must refuse Meta, not accept the world.
  assert.equal(verifyWebhookSignature(BODY, sign(BODY), undefined), false)
  assert.equal(verifyWebhookSignature(BODY, sign(BODY), ''), false)
})

test('rejects malformed, missing and wrong-algorithm signature headers', () => {
  for (const header of [null, '', 'garbage', 'sha1=' + 'a'.repeat(40), 'sha256=', 'sha256=short']) {
    assert.equal(verifyWebhookSignature(BODY, header, SECRET), false, `accepted ${String(header)}`)
  }
})

// ── Subscription handshake ────────────────────────────────────────────────

test('echoes the challenge only for a subscribe with the right token', () => {
  const ok = new URLSearchParams({ 'hub.mode': 'subscribe', 'hub.verify_token': 'tok', 'hub.challenge': '12345' })
  assert.equal(verificationChallenge(ok, 'tok'), '12345')
})

test('refuses the handshake on a wrong token, wrong mode, or no token configured', () => {
  const params = (over: Record<string, string> = {}) =>
    new URLSearchParams({ 'hub.mode': 'subscribe', 'hub.verify_token': 'tok', 'hub.challenge': '12345', ...over })

  assert.equal(verificationChallenge(params({ 'hub.verify_token': 'wrong' }), 'tok'), null)
  assert.equal(verificationChallenge(params({ 'hub.mode': 'unsubscribe' }), 'tok'), null)
  assert.equal(verificationChallenge(params(), undefined), null)
})

// ── Order references ──────────────────────────────────────────────────────

test('parses an order number and email in either order', () => {
  assert.deepEqual(parseOrderReference('#41 juan@example.com'), { orderId: 41, email: 'juan@example.com' })
  assert.deepEqual(parseOrderReference('juan@example.com order 41'), { orderId: 41, email: 'juan@example.com' })
  assert.deepEqual(parseOrderReference('hi, my order is 41 and email JUAN@Example.COM'), {
    orderId: 41,
    email: 'juan@example.com',
  })
})

test('an order number without an email is not a lookup', () => {
  // The whole security model. A bare number must never resolve.
  for (const text of ['#41', 'order 41', 'where is my order 41', '41']) {
    assert.equal(parseOrderReference(text), null, `"${text}" must not parse`)
  }
})

test('an email without an order number is not a lookup either', () => {
  assert.equal(parseOrderReference('juan@example.com'), null)
})

test('digits inside the email address are not mistaken for the order number', () => {
  // juan2024@example.com would otherwise donate "2024" as an order id.
  assert.equal(parseOrderReference('juan2024@example.com'), null)
  assert.deepEqual(parseOrderReference('juan2024@example.com #41'), { orderId: 41, email: 'juan2024@example.com' })
})

test('rejects an order number of zero', () => {
  assert.equal(parseOrderReference('#0 juan@example.com'), null)

  // A leading minus reads as a separator ("order-41" is a real thing people
  // type), so "#-3" resolves to 3. Harmless: the email still has to match
  // order 3, and this parser never authorises anything on its own.
  assert.deepEqual(parseOrderReference('#-3 juan@example.com'), { orderId: 3, email: 'juan@example.com' })
})

// ── Replies ───────────────────────────────────────────────────────────────

test('every menu payload has an answer', () => {
  for (const payload of Object.values(PAYLOADS)) {
    const reply = replyForPayload(payload)
    assert.ok(reply, `${payload} has no reply`)
    assert.ok(reply!.text.trim().length > 0, `${payload} replies with nothing`)
  }
})

test('an unknown payload has no answer, so the caller can fall back', () => {
  assert.equal(replyForPayload('MMC_NOT_A_THING'), null)
})

test('greetings shortcut to the menu instead of burning an LLM call', () => {
  for (const text of ['hi', 'Hello', 'HELP', 'menu', 'get started']) {
    assert.equal(payloadForText(text), PAYLOADS.menu, `"${text}" should open the menu`)
  }
  assert.equal(payloadForText('talk to a human'), PAYLOADS.human)
})

test('anything ambiguous is left to the model, not keyword-matched', () => {
  for (const text of ['do you deliver to cavite on sundays?', 'is the reserve strong', 'helpful?']) {
    assert.equal(payloadForText(text), null, `"${text}" should not be keyword-matched`)
  }
})

// ── Order status copy ─────────────────────────────────────────────────────

const ORDER: TrackableOrder = {
  id: 41,
  order_status: 'shipped',
  payment_status: 'unpaid',
  payment_method: 'gcash',
  total: 548,
  delivery_slots: ['13-14', '09-10'],
  created_at: '2026-09-07T02:00:00.000Z',
}

test('an order summary carries status, total, window and payment — and nothing else', () => {
  const text = formatOrderStatus(ORDER)
  assert.match(text, /#41/)
  assert.match(text, /out for delivery/)
  assert.match(text, /₱548/)
  // Slots are sorted, not echoed in the order they were stored.
  const window = text.split('\n').find(l => l.startsWith('Delivery window:'))!
  assert.ok(window.indexOf('9:00') < window.indexOf('1:00'), window)
  assert.match(text, /GCash/)
  assert.match(text, /screenshot/)
})

test('a paid order is not nagged for payment', () => {
  const text = formatOrderStatus({ ...ORDER, payment_status: 'paid' })
  assert.match(text, /recorded as paid/)
  assert.doesNotMatch(text, /screenshot/)
})

test('a COD order is told to have cash ready, not to send a receipt', () => {
  const text = formatOrderStatus({ ...ORDER, payment_method: 'cod' })
  assert.match(text, /ready on delivery/)
  assert.doesNotMatch(text, /screenshot/)
})

test('an order with no delivery window still renders', () => {
  assert.ok(formatOrderStatus({ ...ORDER, delivery_slots: null }).includes('#41'))
})

// ── Rate limiting ─────────────────────────────────────────────────────────

const NOW = new Date('2026-09-07T12:00:00.000Z')
const minutesAgo = (n: number) => new Date(NOW.getTime() - n * 60_000).toISOString()

test('a chatter is paused only after the budget is spent, and only inside the window', () => {
  const session = { failed_attempts: MAX_FAILED_LOOKUPS, window_started_at: minutesAgo(1) }
  assert.equal(isRateLimited(session, NOW), true)

  // One under the limit is still allowed through.
  assert.equal(isRateLimited({ ...session, failed_attempts: MAX_FAILED_LOOKUPS - 1 }, NOW), false)

  // And the pause expires rather than being permanent.
  assert.equal(isRateLimited({ ...session, window_started_at: minutesAgo(LOOKUP_WINDOW_MINUTES + 1) }, NOW), false)
})

test('failures accumulate inside a window and reset once it ages out', () => {
  const inWindow = nextAttemptWindow({ failed_attempts: 2, window_started_at: minutesAgo(5) }, NOW)
  assert.equal(inWindow.attempts, 3)
  assert.equal(inWindow.windowStartedAt, minutesAgo(5))

  // An honest customer who mistyped last week starts clean.
  const expired = nextAttemptWindow({ failed_attempts: 4, window_started_at: minutesAgo(LOOKUP_WINDOW_MINUTES + 1) }, NOW)
  assert.equal(expired.attempts, 1)
  assert.equal(expired.windowStartedAt, NOW.toISOString())
})

// ── Send API limits ───────────────────────────────────────────────────────

test('long copy is trimmed rather than left for Meta to mangle', () => {
  const long = 'x'.repeat(2500)
  assert.equal(truncate(long).length, 2000)
  assert.ok(truncate(long).endsWith('…'))
  assert.equal(truncate('short'), 'short')
})
