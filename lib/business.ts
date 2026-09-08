// Who we are, for the pages that have to say so.
//
// One place, because a contact address that appears in three files is a
// contact address that gets changed in two.

/**
 * ⚠️ Currently a personal Gmail — it is the address that actually receives
 * order mail today (ADMIN_EMAIL), so it works. Swap it for an address on the
 * domain (hello@makemycoffee.cafe) once Resend verification is done, and
 * update ADMIN_EMAIL in Vercel to match.
 */
export const CONTACT_EMAIL = 'gimelcontz@gmail.com'

/**
 * Left blank on purpose rather than invented. A contact page that prints a
 * made-up phone number or address is worse than one that omits them — fill
 * these in and they appear automatically.
 */
// Typed as string, not inferred as the empty-string literal — otherwise
// TypeScript narrows `if (CONTACT_PHONE)` to `never` and filling one in stops
// compiling.
export const CONTACT_PHONE: string = ''
export const BUSINESS_ADDRESS: string = ''

/** Registered entity name, if and when there is one. */
export const LEGAL_NAME = 'Make My Coffee'

/** Delivery hours, matching the slots offered at checkout. */
export const DELIVERY_HOURS = '9:00 AM – 7:00 PM daily'

/**
 * Last substantive change to the privacy policy. Bump it when the policy
 * changes, not when the page is merely touched.
 */
export const PRIVACY_UPDATED = '8 September 2026'
