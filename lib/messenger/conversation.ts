// The deterministic half of the bot: buttons, and the parsing that turns
// "#41 juan@example.com" into a lookup.
//
// Everything here is pure — no DB, no network, no env — so it can be tested
// directly and so the answers it gives are the same every time. Prices and
// delivery rules are read from lib/products.ts and lib/shipping.ts rather than
// written out, because copy that restates a number goes stale silently and
// nobody notices until a customer is quoted the wrong figure.

import { products } from '../products.ts'
import { FLAT_SHIPPING_FEE } from '../shipping.ts'
import { slotLabel } from '../deliverySlots.ts'
import { paymentMethodLabel, qrAccountFor } from '../paymentMethods.ts'

export interface QuickReply {
  title: string
  payload: string
}

export interface Reply {
  text: string
  quickReplies?: QuickReply[]
}

export const PAYLOADS = {
  menu: 'MMC_MENU',
  track: 'MMC_TRACK',
  payment: 'MMC_PAYMENT',
  delivery: 'MMC_DELIVERY',
  products: 'MMC_PRODUCTS',
  human: 'MMC_HUMAN',
} as const

export type Payload = (typeof PAYLOADS)[keyof typeof PAYLOADS]

// Messenger renders at most 13 quick replies and truncates titles past 20
// characters. Keep them short enough to survive on a phone.
const MENU: QuickReply[] = [
  { title: 'Track my order', payload: PAYLOADS.track },
  { title: 'Payment options', payload: PAYLOADS.payment },
  { title: 'Delivery & fees', payload: PAYLOADS.delivery },
  { title: 'What you sell', payload: PAYLOADS.products },
  { title: 'Talk to a human', payload: PAYLOADS.human },
]

export function menuReply(text = 'What can I help you with?'): Reply {
  return { text, quickReplies: MENU }
}

export function greeting(): Reply {
  return menuReply(
    'Hi! ☕ This is Make My Coffee — bottled Aconchego espresso shots. What can I help you with?'
  )
}

function productsReply(): Reply {
  const lines = products.map(p => `• ${p.name} — ${p.shots} shots / ${p.volume} — ₱${p.price.toLocaleString()}`)
  return menuReply(
    `We bottle one blend, Aconchego, in three sizes:\n\n${lines.join('\n')}\n\nEach shot is 30ml — mix your own latte, iced coffee, whatever you like.`
  )
}

function paymentReply(): Reply {
  const wallets = ['gcash', 'maya', 'gotyme']
    .map(m => qrAccountFor(m))
    .filter((a): a is NonNullable<typeof a> => a !== null)

  return menuReply(
    'You can pay Cash on Delivery, or send it ahead by QR — ' +
      wallets.map(w => w.label).join(', ') +
      '.\n\nPick one at checkout and the QR appears there; it is in your confirmation email too. ' +
      'We confirm QR payments by hand, so please send us a screenshot of your receipt with your order number.'
  )
}

function deliveryReply(): Reply {
  return menuReply(
    `Delivery is ₱${FLAT_SHIPPING_FEE} flat, and free to Pasig City on orders of ₱1,000 or more. ` +
      'We deliver between 9:00 AM and 7:00 PM — you pick your time windows at checkout.'
  )
}

function trackReply(): Reply {
  return {
    text:
      'Happy to check. Send me your order number and the email address you used, like:\n\n' +
      '#41 juan@example.com\n\n' +
      'I need both — the order number on its own is not enough to prove the order is yours.',
  }
}

function humanReply(): Reply {
  return {
    text:
      "Of course — I've flagged this for the team and someone will reply here shortly. " +
      'Leave any details (order number, screenshots) and they will see them.',
  }
}

/** Maps a tapped quick reply or button to its answer. Null if unrecognised. */
export function replyForPayload(payload: string): Reply | null {
  switch (payload) {
    case PAYLOADS.menu: return menuReply()
    case PAYLOADS.track: return trackReply()
    case PAYLOADS.payment: return paymentReply()
    case PAYLOADS.delivery: return deliveryReply()
    case PAYLOADS.products: return productsReply()
    case PAYLOADS.human: return humanReply()
    default: return null
  }
}

/**
 * A handful of typed phrases route straight to a button answer, so someone who
 * types "menu" or "help" doesn't burn an LLM call to be shown a list. Kept
 * deliberately tiny: anything ambiguous belongs to the model, not to a
 * keyword table that will quietly mis-answer.
 */
export function payloadForText(text: string): Payload | null {
  const t = text.trim().toLowerCase()
  if (/^(hi|hello|hey|menu|help|start|get started)\b/.test(t)) return PAYLOADS.menu
  if (/\b(talk|speak) to (a )?(human|person|agent|staff)\b/.test(t)) return PAYLOADS.human
  return null
}

export interface OrderReference {
  orderId: number
  email: string
}

// Order numbers are shown to customers as "#41" but people type them every
// way imaginable, so accept a bare number too — the email is what actually
// authorises the lookup, not the format of the number.
const ORDER_ID_RE = /(?:^|[^\d])#?(\d{1,9})(?![\d])/
const EMAIL_RE = /[^\s<>()[\],;:@"]+@[^\s<>()[\],;:@"]+\.[a-z]{2,}/i

/**
 * Pulls an order number and an email out of free text, in either order.
 * Returns null unless **both** are present — a lookup needs the pair, and
 * accepting a lone order number is precisely the enumeration hole to avoid
 * (order ids are sequential).
 */
export function parseOrderReference(text: string): OrderReference | null {
  const email = text.match(EMAIL_RE)?.[0]
  if (!email) return null

  // Strip the email before hunting for digits, or an address like
  // juan2024@example.com donates "2024" as the order number.
  const withoutEmail = text.replace(EMAIL_RE, ' ')
  const digits = withoutEmail.match(ORDER_ID_RE)?.[1]
  if (!digits) return null

  const orderId = Number(digits)
  if (!Number.isSafeInteger(orderId) || orderId <= 0) return null

  return { orderId, email: email.toLowerCase() }
}

export interface TrackableOrder {
  id: number
  order_status: string
  payment_status: string
  payment_method: string
  total: number
  delivery_slots: string[] | null
  created_at: string | Date
}

const STATUS_TEXT: Record<string, string> = {
  pending: 'received and waiting to be approved',
  approved: 'approved and being prepared',
  shipped: 'out for delivery',
  delivered: 'delivered',
  cancelled: 'cancelled',
}

/**
 * What a verified customer is told about their own order.
 *
 * Status, window, total and whether we've recorded payment — and nothing else.
 * The row also holds their address, phone and pinned coordinates; none of that
 * goes back over Messenger, because proving one email does not justify
 * reprinting a home address into a chat window.
 */
export function formatOrderStatus(order: TrackableOrder): string {
  const window = order.delivery_slots?.length
    ? [...order.delivery_slots].sort().map(slotLabel).join(', ')
    : null

  const paid = order.payment_status === 'paid'
  const method = paymentMethodLabel(order.payment_method)

  const lines = [
    `Order #${order.id} — ${STATUS_TEXT[order.order_status] ?? order.order_status}.`,
    `Total: ₱${Number(order.total).toLocaleString()}`,
  ]
  if (window) lines.push(`Delivery window: ${window}`)
  lines.push(
    paid
      ? `Payment: recorded as paid (${method}).`
      : `Payment: not yet recorded. You chose ${method}` +
        (qrAccountFor(order.payment_method)
          ? ' — if you have already sent it, reply here with a screenshot of your receipt and we will confirm it by hand.'
          : ' — please have it ready on delivery.')
  )

  return lines.join('\n')
}

export function orderNotFoundReply(): Reply {
  return {
    text:
      "I couldn't match that order number and email. Please check both — the email has to be the one used when ordering. " +
      'If it still fails, tap below and a human will take a look.',
    quickReplies: [{ title: 'Talk to a human', payload: PAYLOADS.human }],
  }
}

export function rateLimitedReply(): Reply {
  return {
    text:
      "That's a few failed attempts, so I've paused order lookups for a bit. " +
      'A human can check it for you right away.',
    quickReplies: [{ title: 'Talk to a human', payload: PAYLOADS.human }],
  }
}

/**
 * The answer to anything that went wrong — an LLM call that failed, an
 * unhandled attachment, an unexpected event shape. Never silence, and never an
 * apology that leaves the customer with nothing to do next.
 */
export function fallbackReply(): Reply {
  return menuReply(
    "Sorry — I didn't quite get that. Here's what I can help with, or I can pass you to a human."
  )
}

export function receiptAcknowledgement(): Reply {
  return {
    text:
      "Thanks — I've passed that to the team. Payments are confirmed by hand, so someone will check it and " +
      'update your order. You do not need to send it again.',
  }
}
