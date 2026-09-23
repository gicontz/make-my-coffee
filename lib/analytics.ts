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
// the same commit. Keep them here.

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
