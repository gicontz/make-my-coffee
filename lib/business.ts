// Who we are, for the pages that have to say so.
//
// Read from the environment rather than hardcoded, because this repository is
// public: a personal phone number or a home address committed here is
// committed permanently, and rewriting git history is not a privacy control.
// The values still end up on a public page — that is their purpose — but they
// live in Vercel, where they can be changed or removed.
//
// These are read at module scope and the pages that use them are statically
// prerendered, so a change needs a redeploy to appear. Setting the variable is
// not enough on its own.
//
// Server-side names deliberately (no NEXT_PUBLIC_ prefix): the pages are server
// components, so the values reach the HTML without also being inlined into the
// JavaScript bundle of every other page.

/**
 * Where customers write to. Falls back to ADMIN_EMAIL — the address that
 * already receives order mail — so the contact page is never dead, and then to
 * a domain address as a last resort.
 */
export const CONTACT_EMAIL =
  process.env.CONTACT_EMAIL || process.env.ADMIN_EMAIL || 'hello@makemycoffee.cafe'

/**
 * Both optional. Unset renders nothing at all rather than an empty row — a
 * contact page printing a blank or invented phone number is worse than one
 * that simply omits it.
 */
export const CONTACT_PHONE = process.env.CONTACT_PHONE || ''
export const BUSINESS_ADDRESS = process.env.BUSINESS_ADDRESS || ''

/** Registered entity name, if and when there is one. */
export const LEGAL_NAME = process.env.LEGAL_NAME || 'Make My Coffee'

/** Delivery hours, matching the slots offered at checkout. */
export const DELIVERY_HOURS = '9:00 AM – 7:00 PM daily'

/**
 * Last substantive change to the privacy policy. Deliberately a code constant,
 * not an env var: the date is a claim about when the policy text changed, so it
 * belongs in the same commit as the text it describes.
 */
export const PRIVACY_UPDATED = '8 September 2026'
