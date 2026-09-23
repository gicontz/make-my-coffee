// Every cookie and stored value this site sets, in one place.
//
// The code that sets them and the policy that documents them both read this
// list, so /cookies cannot describe something the app no longer sets or stay
// silent about something new. A cookie policy that has quietly drifted from
// the code is worse than none: it reads as a statement of fact and isn't one.
//
// Third-party cookies (Google, Meta) are NOT listed here — we don't set them
// and can't enumerate them authoritatively. The policy names the ones observed
// on the live site and links out for the rest.

export type StoredKind = 'cookie' | 'localStorage'

export interface StoredItem {
  name: string
  kind: StoredKind
  /** What it does, in a customer's words. */
  purpose: string
  /** How long it lasts, written for a reader rather than in seconds. */
  life: string
  /** When it gets set — a visitor should be able to avoid it if they want. */
  setWhen: string
  /** Functional items are needed for the site to work; none of these track anyone. */
  essential: boolean
}

/** The chat widget's visitor session (app/api/chat/route.ts). */
export const CHAT_COOKIE = 'mmc-chat'

/** Staff sign-in (lib/session.ts). Never set for a customer. */
export const ADMIN_COOKIE = 'mmc_admin'

/** The cart, kept in the browser (context/CartContext.tsx). */
export const CART_STORAGE_KEY = 'mmc-cart'

export const OWN_STORAGE: StoredItem[] = [
  {
    name: CHAT_COOKIE,
    kind: 'cookie',
    purpose:
      'Keeps your chat conversation attached to your browser, so it is still there if you reload the page. It holds a random identifier and nothing about you.',
    life: '1 year',
    setWhen: 'Only when you send your first chat message',
    essential: true,
  },
  {
    name: CART_STORAGE_KEY,
    kind: 'localStorage',
    purpose: 'Remembers what is in your cart until you place the order. It stays in your browser and is never sent to us before checkout.',
    life: 'Until you clear your browser data',
    setWhen: 'When you add something to your cart',
    essential: true,
  },
  {
    name: 'mmc-consent',
    kind: 'localStorage',
    purpose:
      'Remembers whether you accepted or declined analytics, so you are only asked once. It never reaches our servers and identifies nobody.',
    life: 'Until you clear your browser data',
    setWhen: 'When you answer the banner',
    essential: true,
  },
  {
    name: ADMIN_COOKIE,
    kind: 'cookie',
    purpose: 'Signs shop staff in to the back office. It is never set for customers.',
    life: '7 days',
    setWhen: 'Only when a member of staff signs in',
    essential: true,
  },
]

/**
 * Third-party cookies, grouped by the tracker that sets them.
 *
 * Names and lifetimes were observed on the live site rather than copied from
 * a template; a provider can add or rename its own cookies without telling us,
 * which is why the policy says so and links to their documentation.
 */
export interface ThirdPartyGroup {
  /** Matches a key of TrackerIds in lib/analytics.ts. */
  tracker: 'ga4' | 'metaPixel' | 'tiktokPixel'
  provider: string
  policyUrl: string
  cookies: { name: string; purpose: string; life: string }[]
}

export const THIRD_PARTY_STORAGE: ThirdPartyGroup[] = [
  {
    tracker: 'ga4',
    provider: 'Google Analytics',
    policyUrl: 'https://policies.google.com/technologies/cookies',
    cookies: [
      { name: '_ga', purpose: 'Tells returning visits apart from new ones', life: '13 months' },
      { name: '_ga_<id>', purpose: 'Keeps the state of your visit for this site', life: '13 months' },
    ],
  },
  {
    tracker: 'metaPixel',
    provider: 'Meta (Facebook)',
    policyUrl: 'https://www.facebook.com/policies/cookies/',
    cookies: [
      { name: 'fr', purpose: 'Used by Meta to measure and target advertising', life: '90 days' },
      { name: '_fbp', purpose: 'Identifies a browser to Meta for advertising measurement', life: '90 days' },
    ],
  },
  {
    tracker: 'tiktokPixel',
    provider: 'TikTok',
    policyUrl: 'https://www.tiktok.com/legal/page/global/cookie-policy/en',
    cookies: [{ name: '_ttp', purpose: 'Measures advertising for TikTok', life: '13 months' }],
  },
]
