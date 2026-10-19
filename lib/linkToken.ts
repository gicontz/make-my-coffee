// Bearer links — a URL that is, by itself, a customer's credential for one
// thing they own (today: managing a subscription, lib/subscriptions.ts).
//
// Pure and runtime-agnostic: Web Crypto only, no Node `crypto` and no Buffer,
// so it loads in a route, in a client bundle and under
// `node --experimental-strip-types` alike.
//
// The rules every bearer link here follows:
//
// - **256 bits, never an id.** `orders.id` and friends are SERIALs, so anything
//   keyed on one lets a stranger walk the table.
// - **Only a SHA-256 of the token is stored.** Read access to the database is
//   then not write access to anyone's subscription.
// - **The token rides in the URL fragment** (`/page#<token>`). Browsers never
//   send a fragment to a server or put it in a Referer, so it stays out of
//   request logs and out of the page_location analytics tags report. The page
//   reads it, strips it from the address bar, and POSTs it.
//
// The review link (#37) follows the same rules with its own copy of these
// helpers; whichever of the two lands second should switch to this module.

const TOKEN_BYTES = 32
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...Array.from(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Cheap shape check before touching the database. */
export function isLinkTokenShape(value: unknown): value is string {
  return typeof value === 'string' && TOKEN_PATTERN.test(value)
}

/** What the database stores and looks up by — never the token itself. */
export async function hashLinkToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * A token *derived* from a server secret, for a link that has to be sent more
 * than once.
 *
 * A random token whose only copy is a hash can be emailed exactly once — the
 * review link's shape. A subscription's manage link belongs in every weekly
 * email, so it has to be reproducible: HMAC-SHA256(secret, message) gives the
 * same 256 bits every time for the same message, and nobody without the
 * secret can produce them, even with the whole database in hand.
 *
 * Put a version in `message` so one link can be revoked by bumping it.
 */
export async function deriveLinkToken(secret: string, message: string): Promise<string> {
  if (!secret) throw new Error('deriveLinkToken: secret is empty')
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return base64Url(new Uint8Array(sig).slice(0, TOKEN_BYTES))
}
