// What we can honestly say about how fresh a bottle is, how to keep it, and
// what happens if one turns up wrong.
//
// This exists because the product pages used to say nothing on the subject:
// none of it was recorded anywhere, and a guess about how long a perishable
// keeps is not a guess worth publishing. All of it is recorded now, and it
// lives here — in one place — so the shop banner, the product pages and the
// chat bot cannot drift apart on a food claim.
//
// ⚠️ The pieces below are load-bearing on each other. The 7-day window is
// only true *refrigerated*, and the "no cold chain" line is only true *in
// transit*. Splitting one from the other turns a correct pair of statements
// into a wrong one, which is why every surface renders them together.

/**
 * Made to order — the strongest freshness claim the business has, and it was
 * invisible to customers until now.
 *
 * Nothing is brewed in advance and there is no stock: bottles are made on the
 * day they ship, which is also the day they arrive. The `InStock` claim in the
 * Product schema already leans on this ("a bottle on the site is one we will
 * make").
 */
export const MADE_TO_ORDER =
  'Nothing is made in advance. We brew your bottles on the delivery date you choose, and they reach you that same day.'

/**
 * Why no cold chain is needed, stated as a consequence of same-day delivery
 * rather than as a property of the coffee — because that is what makes it
 * true. It survives the journey because the journey is hours, not because it
 * is shelf-stable.
 *
 * ⚠️ Never render this without {@link REFRIGERATE}. On its own it reads as
 * "refrigeration is optional", which is the opposite of the instruction.
 */
export const TRANSIT_STORAGE =
  'It needs no refrigeration on the way, because brewing and delivery happen the same day.'

/** Fridge from arrival, sealed or not. */
export const REFRIGERATE = 'Once it reaches you, keep it in the fridge — whether you have opened it or not.'

/** Days the flavour holds from delivery, refrigerated. One window, opened or sealed. */
export const DAYS_FROM_DELIVERY = 7

/**
 * A best-before, and labelled as one.
 *
 * The customer called it "just a best-day-before thing", so the copy says
 * flavour rather than safety: presenting a quality window as a use-by date is
 * its own kind of inaccuracy.
 *
 * One number covers sealed and opened alike, by decision — two windows invite
 * a customer to misremember which applies to them, and the honest answer was
 * the same either way.
 */
export const SHELF_LIFE =
  `Refrigerated, it is at its best for ${DAYS_FROM_DELIVERY} days from delivery, opened or not — ` +
  'that is about flavour, not safety.'

/**
 * What happens when something is wrong.
 *
 * A photo rather than a returned bottle: there is no returns pipeline, the
 * product is perishable, and shipping a spoiled bottle back tells us nothing a
 * picture does not. Opened bottles are excluded because a made-to-order
 * perishable cannot be resold — not as a way of refusing complaints, which is
 * why the replace-or-refund half comes first.
 */
export const RETURNS =
  'If an order turns up wrong, damaged or spoiled, send us a photo and we will replace it or refund you. ' +
  'Because these are perishable and made to order, we cannot take back bottles that have been opened.'

/** The full freshness story, in the order it should be read. */
export const FRESHNESS_SUMMARY = `${MADE_TO_ORDER} ${TRANSIT_STORAGE} ${REFRIGERATE} ${SHELF_LIFE}`
