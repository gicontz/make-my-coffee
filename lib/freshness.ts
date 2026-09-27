// What we can honestly say about how fresh a bottle is, and how long it keeps.
//
// This exists because the product pages used to say nothing at all on the
// subject: none of it was recorded anywhere, and a guess about how long a
// perishable keeps is not a guess worth publishing. These three facts are now
// known, so they are stated — from here, in one place, so the site, the shop
// banner and the chat bot cannot drift apart on a food claim.
//
// ⚠️ Read WHAT_WE_DO_NOT_KNOW before adding to this. Two obvious-looking
// sentences are deliberately missing, and inventing either of them would put
// an unfounded food-safety claim on a live storefront.

/**
 * Made to order — this is the strongest freshness claim the business has, and
 * it was invisible to customers until now.
 *
 * Nothing is brewed in advance and there is no stock: bottles are made on the
 * day they ship, which is also the day they arrive. `lib/products.ts` already
 * relies on this for the `InStock` claim in the Product schema ("a bottle on
 * the site is one we will make").
 */
export const MADE_TO_ORDER =
  'Nothing is made in advance. We brew your bottles on the delivery date you choose, and they reach you that same day.'

/**
 * Why no cold chain is needed, stated as the consequence of same-day delivery
 * rather than as a property of the coffee — because that is what makes it
 * true. It is safe in transit because the transit is hours, not because the
 * product is shelf-stable.
 */
export const TRANSIT_STORAGE =
  'Because it is brewed and delivered the same day, nothing needs refrigerating on the way to you.'

/** Days after opening the flavour holds up. Quality, not safety. */
export const DAYS_AFTER_OPENING = 7

/**
 * A best-before, and labelled as one.
 *
 * The customer told us this is "just a best-day-before thing", so the copy
 * says flavour rather than safety. Presenting a quality window as a safety
 * deadline would be its own kind of inaccuracy.
 */
export const AFTER_OPENING = `Once opened, they are at their best within ${DAYS_AFTER_OPENING} days — that is about flavour, not safety.`

/**
 * WHAT_WE_DO_NOT_KNOW
 *
 * Neither of these has an answer yet, so nothing anywhere may state one:
 *
 *  1. **Unopened shelf life.** How long a sealed bottle keeps is still
 *     unrecorded. Made-to-order makes it less pressing — every bottle arrives
 *     brewed that day — but it does not answer it, and a customer who leaves a
 *     sealed bottle for a fortnight has no guidance.
 *  2. **Whether it needs refrigerating after opening.** Same-day delivery was
 *     ruled out as needing a cold chain; the customer's own kitchen was not.
 *     A concentrate left out for seven days is a different claim from one kept
 *     in a fridge.
 *
 * Until both are answered, `AFTER_OPENING` says only how long the flavour
 * holds and says nothing about where to keep it.
 */
export const FRESHNESS_SUMMARY = `${MADE_TO_ORDER} ${TRANSIT_STORAGE} ${AFTER_OPENING}`
