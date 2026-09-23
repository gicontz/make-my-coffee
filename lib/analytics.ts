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

/** The visitor's answer. `null` = not asked yet, or answered in another browser. */
export type ConsentChoice = 'granted' | 'denied'

export const CONSENT_KEY = 'mmc-consent'

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
 * Reads the stored choice. Returns null when nothing has been decided.
 *
 * Every access is wrapped: a private window, cleared site data, or a browser
 * set to block storage all make this throw rather than return empty, and a
 * consent banner that crashes the page is worse than no banner.
 */
export function readConsent(): ConsentChoice | null {
  if (typeof window === 'undefined') return null
  try {
    const value = window.localStorage.getItem(CONSENT_KEY)
    return value === 'granted' || value === 'denied' ? value : null
  } catch {
    // Storage unavailable — treat as undecided, which means nothing loads.
    return null
  }
}

export function writeConsent(choice: ConsentChoice): void {
  try {
    window.localStorage.setItem(CONSENT_KEY, choice)
  } catch {
    // The choice is lost on reload, and the banner asks again. Annoying, but
    // it fails toward *not* tracking, which is the right direction.
  }
}
