// Conversion events (issue #33): what each ad platform is told, and when.
//
// Two failures matter here and neither is visible from the site. A purchase
// reported at the wrong value teaches the ad platforms to bid for the wrong
// customers, and nobody notices until the money is spent. An event fired
// without consent is a tracker reaching someone who said no.

// Must stay first: it sets the tracker ids analytics reads at load time.
import './helpers/trackerIds.ts'
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildConversion, trackConversion, CONSENT_KEY, CONSENT_VERSION, CURRENCY } from '../lib/analytics.ts'
import { productById } from '../lib/products.ts'

const classic = productById('7-shot')!
const reserve = productById('10-shot')!

// ── Payloads ──

test('purchase value is the total the server charged, not the sum of the bottles', () => {
  // Two Classics and a Reserve is ₱1,497 of bottles; a ₱100 voucher and ₱120
  // of delivery make the charge ₱1,517. Reporting ₱1,497 would misstate it.
  const calls = buildConversion({
    kind: 'purchase',
    order: {
      orderId: 42,
      total: 1517,
      shipping: 120,
      voucherCode: 'HELLO100',
      items: [{ id: '7-shot', quantity: 2 }, { id: '10-shot', quantity: 1 }],
    },
  })!

  assert.equal(calls.ga4[1].value, 1517)
  assert.equal(calls.meta[1].value, 1517)
  assert.equal(calls.tiktok[1].value, 1517)
  for (const [, params] of [calls.ga4, calls.meta, calls.tiktok]) assert.equal(params.currency, 'PHP')
  assert.equal(CURRENCY, 'PHP')
})

test('a purchase carries the order number, so each platform can drop a repeat', () => {
  const calls = buildConversion({
    kind: 'purchase',
    order: { orderId: 42, total: 449, shipping: 0, voucherCode: null, items: [{ id: '7-shot', quantity: 1 }] },
  })!

  assert.equal(calls.ga4[1].transaction_id, '42')
  assert.deepEqual(calls.meta[2], { eventID: 'purchase-42' })
  assert.deepEqual(calls.tiktok[2], { event_id: 'purchase-42' })
  assert.equal(calls.ga4[1].shipping, 0)
  assert.equal('coupon' in calls.ga4[1], false, 'no voucher means no coupon key, not an empty one')
})

test('each platform gets its own name for the same moment', () => {
  const lines = [{ id: '7-shot', quantity: 1 }]
  const order = { orderId: 1, total: 449, shipping: 0, voucherCode: null, items: lines }

  const names = (c: ReturnType<typeof buildConversion>) => [c!.ga4[0], c!.meta[0], c!.tiktok[0]]
  assert.deepEqual(names(buildConversion({ kind: 'add_to_cart', lines })), ['add_to_cart', 'AddToCart', 'AddToCart'])
  assert.deepEqual(names(buildConversion({ kind: 'begin_checkout', lines })), [
    'begin_checkout',
    'InitiateCheckout',
    'InitiateCheckout',
  ])
  assert.deepEqual(names(buildConversion({ kind: 'purchase', order })), ['purchase', 'Purchase', 'CompletePayment'])
})

test('cart and checkout are valued from the catalog, and carry no order id', () => {
  const calls = buildConversion({
    kind: 'begin_checkout',
    lines: [{ id: '7-shot', quantity: 2 }, { id: '10-shot', quantity: 1 }],
  })!

  assert.equal(calls.ga4[1].value, classic.price * 2 + reserve.price)
  assert.equal(calls.meta[1].num_items, 3)
  assert.equal(calls.meta[2], undefined)
  assert.equal(calls.tiktok[2], undefined)
  assert.equal('transaction_id' in calls.ga4[1], false)
})

test('item names and prices come from lib/products.ts, never retyped', () => {
  const calls = buildConversion({ kind: 'add_to_cart', lines: [{ id: '10-shot', quantity: 3 }] })!

  assert.deepEqual(calls.ga4[1].items, [
    { item_id: '10-shot', item_name: reserve.name, price: reserve.price, quantity: 3 },
  ])
  assert.equal(calls.ga4[1].value, reserve.price * 3)
  assert.deepEqual(calls.meta[1].content_ids, ['10-shot'])
})

test('lines the catalog does not know are dropped, and nothing at all is reported for none', () => {
  const calls = buildConversion({
    kind: 'add_to_cart',
    lines: [{ id: 'gone-bottle', quantity: 1 }, { id: '7-shot', quantity: 1 }],
  })!
  assert.deepEqual(calls.meta[1].content_ids, ['7-shot'])

  assert.equal(buildConversion({ kind: 'add_to_cart', lines: [{ id: 'gone-bottle', quantity: 1 }] }), null)
  assert.equal(buildConversion({ kind: 'begin_checkout', lines: [] }), null)
  assert.equal(buildConversion({ kind: 'add_to_cart', lines: [{ id: '7-shot', quantity: 0 }] }), null)
})

// ── The consent gate ──

interface Fake {
  gtag: unknown[][]
  fbq: unknown[][]
  ttq: unknown[][]
}

/** A browser with the given consent stored and every tracker loaded. */
function fakeBrowser(consent: { analytics: boolean; marketing: boolean } | null, loaded = true): Fake {
  const calls: Fake = { gtag: [], fbq: [], ttq: [] }
  const store = new Map<string, string>()
  if (consent) store.set(CONSENT_KEY, JSON.stringify({ ...consent, v: CONSENT_VERSION }))
  const win: Record<string, unknown> = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
    },
  }
  if (loaded) {
    win.gtag = (...a: unknown[]) => calls.gtag.push(a)
    win.fbq = (...a: unknown[]) => calls.fbq.push(a)
    win.ttq = { track: (...a: unknown[]) => calls.ttq.push(a) }
  }
  ;(globalThis as unknown as { window: unknown }).window = win
  return calls
}

/** The window the current fake browser installed, to change mid-test. */
function fakeWindow(): Record<string, unknown> {
  return (globalThis as unknown as { window: Record<string, unknown> }).window
}

const addOne = { kind: 'add_to_cart' as const, lines: [{ id: '7-shot', quantity: 1 }] }
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

test('no stored answer means no event reaches anyone', async () => {
  const calls = fakeBrowser(null)
  trackConversion(addOne)
  await wait(300)
  assert.deepEqual(calls, { gtag: [], fbq: [], ttq: [] })
})

test('allowing analytics alone reaches GA4 and no advertiser', () => {
  const calls = fakeBrowser({ analytics: true, marketing: false })
  trackConversion(addOne)
  assert.equal(calls.gtag.length, 1)
  assert.equal(calls.gtag[0][0], 'event')
  assert.equal(calls.gtag[0][1], 'add_to_cart')
  assert.deepEqual(calls.fbq, [])
  assert.deepEqual(calls.ttq, [])
})

test('allowing advertising alone reaches Meta and TikTok, not GA4', () => {
  const calls = fakeBrowser({ analytics: false, marketing: true })
  trackConversion({
    kind: 'purchase',
    order: { orderId: 7, total: 449, shipping: 0, voucherCode: null, items: [{ id: '7-shot', quantity: 1 }] },
  })
  assert.deepEqual(calls.gtag, [])
  assert.equal(calls.fbq[0][0], 'track')
  assert.equal(calls.fbq[0][1], 'Purchase')
  assert.deepEqual(calls.fbq[0][3], { eventID: 'purchase-7' })
  assert.equal(calls.ttq[0][0], 'CompletePayment')
})

test('an event raised before the tracker loads is delivered once it does', async () => {
  const calls = fakeBrowser({ analytics: true, marketing: false }, false)
  trackConversion(addOne)
  assert.deepEqual(calls.gtag, [])

  const win = fakeWindow()
  win.gtag = (...a: unknown[]) => calls.gtag.push(a)
  await wait(400)
  assert.equal(calls.gtag.length, 1)
})

test('rejecting while an event waits for its tracker means it is never sent', async () => {
  const calls = fakeBrowser({ analytics: true, marketing: true }, false)
  trackConversion(addOne)

  const win = fakeWindow()
  ;(win.localStorage as { setItem: (k: string, v: string) => void }).setItem(
    CONSENT_KEY,
    JSON.stringify({ analytics: false, marketing: false, v: CONSENT_VERSION })
  )
  win.gtag = (...a: unknown[]) => calls.gtag.push(a)
  win.fbq = (...a: unknown[]) => calls.fbq.push(a)
  await wait(400)
  assert.deepEqual(calls.gtag, [])
  assert.deepEqual(calls.fbq, [])
})

test('a tracker that throws does not break the caller', () => {
  fakeBrowser({ analytics: true, marketing: false })
  const win = fakeWindow()
  win.gtag = () => {
    throw new Error('blocked')
  }
  const quiet = console.error
  console.error = () => {}
  try {
    assert.doesNotThrow(() => trackConversion(addOne))
  } finally {
    console.error = quiet
  }
})
