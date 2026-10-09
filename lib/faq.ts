// The FAQ, assembled from the modules that own each fact.
//
// Nothing here is a fact of its own. Every answer is built from the constant
// that the checkout, the product pages and the chat bot already read — an FAQ
// that has drifted from the code reads as a statement of fact and isn't one,
// the same reasoning that builds /cookies from lib/cookies.ts.
//
// Plain strings, not JSX, because the same text goes into the FAQPage JSON-LD:
// structured data has to match what the page visibly says.
//
// ⚠️ Two rules that matter more than the rest:
//   - No number in the delivery-fee answer at all — no fee, no "usually
//     around", not even the free-delivery threshold. The fee isn't knowable
//     before the customer pins a location; see the comment on deliveryReply().
//   - The freshness facts travel together. "No refrigeration" is true only of
//     the journey and the 7 days only refrigerated, so an answer carrying
//     either one carries REFRIGERATE too. tests/faq.test.ts holds both.

import { MADE_TO_ORDER, REFRIGERATE, RETURNS, SHELF_LIFE, TRANSIT_STORAGE } from './freshness.ts'
import { PROVINCES } from './phLocations.ts'
import { MAX_DAYS_AHEAD, MIN_LEAD_DAYS } from './deliveryDate.ts'
import { DELIVERY_SLOTS, PERIOD_LABEL } from './deliverySlots.ts'
import { CHECKOUT_PAYMENT_METHODS, paymentMethodLabel, qrAccountFor } from './paymentMethods.ts'
import { SHOT_ML, pricePerShot, products } from './products.ts'
import { BLEND_ORIGIN } from './seo.ts'

export interface Faq {
  /** Anchor on /faq — /faq#<id>. Changing it breaks links to the answer. */
  id: string
  question: string
  answer: string
}

/** "a, b and c" — or "a, b or c". */
export function joinList(items: readonly string[], conjunction: 'and' | 'or'): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} ${conjunction} ${items[items.length - 1]}`
}

/** "9:00 AM" from 9, "7:00 PM" from 19. */
function clock(hour: number): string {
  const suffix = hour < 12 ? 'AM' : 'PM'
  return `${hour % 12 === 0 ? 12 : hour % 12}:00 ${suffix}`
}

/**
 * The delivery day, read from the slot ids ("09-10" … "18-19") rather than
 * typed. Ids, not labels: a label only carries AM/PM on its end time, so
 * splitting one drops the meridiem from the start.
 */
export function deliveryHours(): string {
  const start = Number(DELIVERY_SLOTS[0].id.split('-')[0])
  const end = Number(DELIVERY_SLOTS[DELIVERY_SLOTS.length - 1].id.split('-')[1])
  return `${clock(start)} and ${clock(end)}`
}

/** "morning", "afternoon–evening" — the checkout's own period names, run into prose. */
function period(p: keyof typeof PERIOD_LABEL): string {
  return PERIOD_LABEL[p].toLowerCase().replace(/\s*–\s*/g, '–')
}

function earliestDay(): string {
  return MIN_LEAD_DAYS === 1 ? 'tomorrow' : `${MIN_LEAD_DAYS} days from today`
}

/** Wallets that actually have a QR configured — the same filter the chat bot uses. */
function qrWallets(): string[] {
  return CHECKOUT_PAYMENT_METHODS.filter(m => qrAccountFor(m) !== null).map(paymentMethodLabel)
}

function cheapestDrink(): number {
  return Math.min(...products.map(pricePerShot))
}

export const faqs: readonly Faq[] = [
  {
    id: 'espresso-machine',
    question: 'Do I need an espresso machine?',
    answer:
      `No — that is the whole idea. Every bottle holds ready-made ${SHOT_ML}ml shots of Aconchego, ` +
      `our ${BLEND_ORIGIN} blend. Pour one over ice or warm milk and you have a latte, from about ` +
      `₱${cheapestDrink()} a drink. No machine, no pods, no barista.`,
  },
  {
    id: 'refrigeration',
    question: 'Does it need refrigerating?',
    answer: `${MADE_TO_ORDER} ${TRANSIT_STORAGE} ${REFRIGERATE}`,
  },
  {
    id: 'shelf-life',
    question: 'How long does it keep?',
    // The fridge instruction leads, so this answer quoted on its own in a
    // search result still carries the condition the window depends on.
    answer: `${REFRIGERATE} ${SHELF_LIFE}`,
  },
  {
    id: 'delivery-area',
    question: 'Where do you deliver?',
    answer:
      `Across ${joinList(PROVINCES, 'and')}. Checkout lists every city we cover in each — ` +
      'if yours is there, we deliver to it. You pin the exact drop-off spot on a map when you order.',
  },
  {
    id: 'delivery-fee',
    question: 'How much is delivery?',
    // No number of any kind — not a fee, and not the free-delivery threshold
    // either. A figure in a delivery answer reads as a price promise.
    answer:
      'It depends on exactly where you are, so we work it out from the spot you pin at checkout and show you ' +
      'the fee before you pay.',
  },
  {
    id: 'delivery-time',
    question: 'When can it arrive?',
    answer:
      `Any day from ${earliestDay()} up to ${MAX_DAYS_AHEAD} days ahead; you choose the date at checkout. ` +
      `We deliver between ${deliveryHours()}. Pick the time windows that suit you (at least one ` +
      `${period('morning')} and one ${period('afternoon')}) and we arrive within them.`,
  },
  {
    id: 'payment',
    question: 'How do I pay?',
    answer:
      `${paymentMethodLabel('cod')}, or pay ahead by scanning a ${joinList(qrWallets(), 'or')} QR at checkout — ` +
      'the QR is in your confirmation email too. We confirm QR payments by hand, so please send us a ' +
      'screenshot of your receipt with your order number.',
  },
  {
    id: 'returns',
    question: 'What if my order arrives wrong?',
    answer: `${RETURNS} Send the photo through the chat on any page, or by email — our contact page has the address.`,
  },
]

