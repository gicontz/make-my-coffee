// Analytics and advertising trackers, and the consent that gates them.
//
// Three rules hold here, and the privacy policy depends on all three:
//
//  1. Nothing loads without an id. Each tracker is dark unless its
//     NEXT_PUBLIC_ variable is set, so a deployment that configures none
//     behaves exactly as the site did before any of this existed.
//  2. Nothing loads before consent. Not the scripts, not a pixel, not a
//     cookie — a visitor who declines or simply never answers is never
//     touched by any of them. Advertising trackers firing before a person
//     agrees is the thing the Data Privacy Act is about.
//  3. The consent choice itself stays in the visitor's browser. It is a
//     localStorage value, never sent to us, and it identifies nobody.
//
// If a tracker is ever added outside this module, /privacy becomes wrong in
// the same commit. Keep them here. The same goes for what they are sent: the
// conversion events at the bottom of this file are the only data any of them
// receive beyond the page view, and /privacy says so.

import { productById } from './products.ts'

/**
 * What the visitor agreed to, by category.
 *
 * Two categories rather than one yes/no, because they are genuinely different
 * asks: "count my visit" and "let an advertiser follow me" are not the same
 * favour, and someone may reasonably grant the first and refuse the second.
 * Strictly necessary items are not represented — they are not optional and
 * offering a toggle that does nothing is theatre.
 */
export interface ConsentState {
  /** Audience measurement — GA4. */
  analytics: boolean
  /** Advertising measurement and targeting — Meta and TikTok pixels. */
  marketing: boolean
}

export type ConsentCategory = keyof ConsentState

export const CONSENT_KEY = 'mmc-consent'

/**
 * Fired by the footer link to reopen the settings panel.
 *
 * An event rather than shared state: the footer is a server component, and
 * this is the only client island that needs to know. A consent notice you can
 * answer exactly once, with no way back, is not really a choice.
 */
export const OPEN_COOKIE_SETTINGS_EVENT = 'mmc:open-cookie-settings'

/**
 * Bumped when the *meaning* of a stored answer changes — a new category, or a
 * tracker moving between categories. An older version is re-asked rather than
 * reinterpreted: consent given to one question is not consent to a different
 * one.
 */
export const CONSENT_VERSION = 2

interface StoredConsent extends ConsentState {
  v: number
}

export interface TrackerIds {
  ga4?: string
  metaPixel?: string
  tiktokPixel?: string
}

/**
 * Which trackers this deployment has been given ids for.
 *
 * Read at module scope from NEXT_PUBLIC_ variables, which Next inlines at
 * build time — so changing one needs a redeploy, not just an env edit.
 */
export const TRACKERS: TrackerIds = {
  ga4: process.env.NEXT_PUBLIC_GA4_ID || undefined,
  metaPixel: process.env.NEXT_PUBLIC_META_PIXEL_ID || undefined,
  tiktokPixel: process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID || undefined,
}

/** True when at least one tracker is configured — i.e. there is anything to ask about. */
export function hasTrackers(ids: TrackerIds = TRACKERS): boolean {
  return Boolean(ids.ga4 || ids.metaPixel || ids.tiktokPixel)
}

/**
 * True when an *advertising* tracker is configured, as opposed to analytics
 * alone.
 *
 * Copy depends on this: with only GA4 running, telling someone we want to
 * "measure our ads" claims a use that isn't happening, and a consent notice
 * that overstates what it does is no better than one that understates it.
 */
export function hasAdvertisingTrackers(ids: TrackerIds = TRACKERS): boolean {
  return Boolean(ids.metaPixel || ids.tiktokPixel)
}

/**
 * Human names for whatever is actually configured.
 *
 * The privacy page renders this rather than a hardcoded list, so the page
 * cannot claim a tracker the site doesn't run — or stay silent about one it
 * does.
 */
export function activeTrackerNames(ids: TrackerIds = TRACKERS): string[] {
  const names: string[] = []
  if (ids.ga4) names.push('Google Analytics 4')
  if (ids.metaPixel) names.push('Meta Pixel')
  if (ids.tiktokPixel) names.push('TikTok Pixel')
  return names
}

/**
 * Turns whatever is in storage into a decision, or null for "not decided".
 *
 * Exported and pure so the migration below is testable without a browser.
 */
export function parseConsent(raw: string | null): ConsentState | null {
  if (!raw) return null

  // v1 stored a bare 'granted' | 'denied'. Those people answered a banner that
  // asked about analytics and advertising together, so their answer maps
  // faithfully onto both categories — re-asking would be pestering someone who
  // already told us.
  if (raw === 'granted') return { analytics: true, marketing: true }
  if (raw === 'denied') return { analytics: false, marketing: false }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredConsent>
    // A future version is not ours to interpret; ask again.
    if (parsed?.v !== CONSENT_VERSION) return null
    return { analytics: parsed.analytics === true, marketing: parsed.marketing === true }
  } catch {
    return null
  }
}

/**
 * Reads the stored decision. Null when nothing has been decided.
 *
 * Every access is wrapped: a private window, cleared site data, or a browser
 * set to block storage all make this throw rather than return empty, and a
 * consent banner that crashes the page is worse than no banner.
 */
export function readConsent(): ConsentState | null {
  if (typeof window === 'undefined') return null
  try {
    return parseConsent(window.localStorage.getItem(CONSENT_KEY))
  } catch {
    // Storage unavailable — treat as undecided, which means nothing loads.
    return null
  }
}

export function writeConsent(state: ConsentState): void {
  try {
    const payload: StoredConsent = { ...state, v: CONSENT_VERSION }
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify(payload))
  } catch {
    // The choice is lost on reload and the banner asks again. Annoying, but it
    // fails toward *not* tracking, which is the right direction.
  }
}

export const ALL_OFF: ConsentState = { analytics: false, marketing: false }
export const ALL_ON: ConsentState = { analytics: true, marketing: true }

/**
 * Which categories this deployment actually has trackers for.
 *
 * A toggle for a category running nothing is a lie about what is on offer, so
 * the panel only shows the ones that exist.
 */
export function categoriesInUse(ids: TrackerIds = TRACKERS): ConsentCategory[] {
  const used: ConsentCategory[] = []
  if (ids.ga4) used.push('analytics')
  if (ids.metaPixel || ids.tiktokPixel) used.push('marketing')
  return used
}

export const CATEGORY_LABEL: Record<ConsentCategory, { title: string; blurb: string }> = {
  analytics: {
    title: 'Analytics',
    blurb: 'Counts visits and shows us which pages people actually use. Never used to advertise to you.',
  },
  marketing: {
    title: 'Advertising',
    blurb: 'Lets us measure whether our ads work. These companies may combine it with what they already know about you.',
  },
}

// ── Conversion events ───────────────────────────────────────────────────────
//
// What the ad platforms optimise toward. Given only PageView they bid for
// cheap traffic; given a purchase with a value they bid for buyers.
//
// Same gate as the scripts: GA4 hears these only under `analytics`, Meta and
// TikTok only under `marketing`, and consent is re-read at the moment of
// firing rather than trusted from when a script loaded — a script cannot be
// unloaded, so withdrawing mid-visit has to be honoured here instead.
//
// Nothing personal goes out: bottle ids, quantities, pesos and the order
// number. Never a name, email, phone or address — no "advanced matching".

export const CURRENCY = 'PHP'

/** A bottle and how many — all an event needs to know about a cart line. */
export interface ConversionLine {
  id: string
  quantity: number
}

/** What POST /api/orders actually charged, as it returned it. */
export interface PlacedOrder {
  orderId: number
  /** The amount charged: subtotal − discount + delivery after any voucher cap. */
  total: number
  shipping: number
  voucherCode: string | null
  items: ConversionLine[]
}

export type Conversion =
  | { kind: 'add_to_cart'; lines: ConversionLine[] }
  | { kind: 'begin_checkout'; lines: ConversionLine[] }
  | { kind: 'purchase'; order: PlacedOrder }

type Params = Record<string, unknown>

/** Each platform's call, ready to spread into gtag('event', …), fbq('track', …) and ttq.track(…). */
export interface ConversionCalls {
  ga4: [name: string, params: Params]
  meta: [name: string, params: Params, options?: { eventID: string }]
  tiktok: [name: string, params: Params, options?: { event_id: string }]
}

// TikTok has no "Purchase"; CompletePayment is the event its value
// optimisation reads. Nothing here verifies a payment either (D13) — "purchase"
// means "order placed", the same on all three, so they report the same thing.
const EVENT_NAMES = {
  add_to_cart: { ga4: 'add_to_cart', meta: 'AddToCart', tiktok: 'AddToCart' },
  begin_checkout: { ga4: 'begin_checkout', meta: 'InitiateCheckout', tiktok: 'InitiateCheckout' },
  purchase: { ga4: 'purchase', meta: 'Purchase', tiktok: 'CompletePayment' },
} as const

interface PricedConversionLine {
  id: string
  name: string
  price: number
  quantity: number
}

/**
 * Names and prices from lib/products.ts, never from the cart's own copy —
 * that is whatever sat in localStorage when the bottle was added, and can
 * predate a price change. Ids the catalog doesn't know are dropped.
 */
function priceLines(lines: ConversionLine[]): PricedConversionLine[] {
  const priced: PricedConversionLine[] = []
  for (const line of lines) {
    const product = productById(line.id)
    if (!product || !Number.isInteger(line.quantity) || line.quantity < 1) continue
    priced.push({ id: product.id, name: product.name, price: product.price, quantity: line.quantity })
  }
  return priced
}

/**
 * Each platform's payload for one conversion, or null when there is nothing
 * recognisable to report.
 *
 * Pure, so tests can pin exactly what each platform is told.
 *
 * Purchase value is the order's `total` as the server computed it — not a sum
 * of the items. A voucher discount, a free-delivery voucher capped at ₱150
 * and a live delivery quote all sit between the two, so the items alone would
 * misreport revenue. Cart and checkout events have no charge yet, so theirs is
 * the catalog value of what is in the cart.
 */
export function buildConversion(conversion: Conversion): ConversionCalls | null {
  const lines = priceLines(conversion.kind === 'purchase' ? conversion.order.items : conversion.lines)
  if (lines.length === 0) return null

  const value =
    conversion.kind === 'purchase'
      ? conversion.order.total
      : lines.reduce((sum, l) => sum + l.price * l.quantity, 0)
  const names = EVENT_NAMES[conversion.kind]

  const ga4: Params = {
    currency: CURRENCY,
    value,
    items: lines.map(l => ({ item_id: l.id, item_name: l.name, price: l.price, quantity: l.quantity })),
  }
  const meta: Params = {
    currency: CURRENCY,
    value,
    content_type: 'product',
    content_ids: lines.map(l => l.id),
    contents: lines.map(l => ({ id: l.id, quantity: l.quantity })),
    num_items: lines.reduce((sum, l) => sum + l.quantity, 0),
  }
  const tiktok: Params = {
    currency: CURRENCY,
    value,
    content_type: 'product',
    contents: lines.map(l => ({ content_id: l.id, content_name: l.name, price: l.price, quantity: l.quantity })),
  }

  if (conversion.kind !== 'purchase') {
    return { ga4: [names.ga4, ga4], meta: [names.meta, meta], tiktok: [names.tiktok, tiktok] }
  }

  // The order number is what lets each platform drop a repeat of the same
  // sale — GA4 by transaction_id, Meta and TikTok by event id.
  const { order } = conversion
  const eventId = `purchase-${order.orderId}`
  ga4.transaction_id = String(order.orderId)
  ga4.shipping = order.shipping
  if (order.voucherCode) ga4.coupon = order.voucherCode

  return {
    ga4: [names.ga4, ga4],
    meta: [names.meta, meta, { eventID: eventId }],
    tiktok: [names.tiktok, tiktok, { event_id: eventId }],
  }
}

type TrackerWindow = Window & {
  gtag?: (...args: unknown[]) => void
  fbq?: (...args: unknown[]) => void
  ttq?: { track: (...args: unknown[]) => void }
}

// The scripts load `afterInteractive`, so an event raised straight after a page
// load — begin_checkout on a refreshed /order — can arrive before the tracker
// exists. Wait a few seconds for it rather than drop the event; past that the
// script was blocked or failed, and there is nothing to send it to.
const READY_POLL_MS = 250
const READY_POLL_TRIES = 20

function whenReady(category: ConsentCategory, fire: (w: TrackerWindow) => boolean, triesLeft = READY_POLL_TRIES) {
  // Re-checked on every attempt: a "Reject all" during the wait wins.
  if (!readConsent()?.[category]) return
  try {
    if (fire(window as TrackerWindow)) return
  } catch (err) {
    // A retry runs from a timer, outside trackConversion's try — a throw here
    // would surface as an uncaught error on the page.
    console.error('Conversion tracking failed:', err)
    return
  }
  if (triesLeft > 0) setTimeout(() => whenReady(category, fire, triesLeft - 1), READY_POLL_MS)
}

/**
 * Reports a conversion to whichever trackers this visitor has allowed.
 *
 * Never throws: a tracker misbehaving must not break adding to cart or the
 * order confirmation, which is what calls this.
 */
export function trackConversion(conversion: Conversion): void {
  if (typeof window === 'undefined' || !hasTrackers()) return
  try {
    const calls = buildConversion(conversion)
    if (!calls) return

    if (TRACKERS.ga4) {
      whenReady('analytics', w => {
        if (typeof w.gtag !== 'function') return false
        w.gtag('event', ...calls.ga4)
        return true
      })
    }
    if (TRACKERS.metaPixel) {
      whenReady('marketing', w => {
        if (typeof w.fbq !== 'function') return false
        w.fbq('track', ...calls.meta)
        return true
      })
    }
    if (TRACKERS.tiktokPixel) {
      whenReady('marketing', w => {
        if (typeof w.ttq?.track !== 'function') return false
        w.ttq.track(...calls.tiktok)
        return true
      })
    }
  } catch (err) {
    console.error('Conversion tracking failed:', err)
  }
}
