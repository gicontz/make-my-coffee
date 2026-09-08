// The bot's decision sequence, with no idea what it is talking over.
//
// Messenger and the on-site widget both route through here. That is the point:
// a second copy of "payload → keyword → order reference → model → menu" is how
// the two channels start giving different answers to the same question, and
// how a security rule gets tightened in one place and not the other.
//
// Everything channel-specific — how a message arrives, how a reply is
// delivered, where session state lives — is supplied by the caller as `deps`.

import {
  fallbackReply,
  formatOrderStatus,
  orderNotFoundReply,
  parseOrderReference,
  payloadForText,
  rateLimitedReply,
  replyForPayload,
  type OrderReference,
  type Reply,
  type TrackableOrder,
} from './conversation.ts'
import { assistantReply } from './assistant.ts'
import { PAYLOADS } from './conversation.ts'

export type LookupOutcome =
  | { ok: true; order: TrackableOrder }
  | { ok: false; reason: 'not_found' | 'rate_limited' }

export interface RespondDeps {
  /** Authorised lookup — must check the email, not just the order number. */
  lookupOrder: (ref: OrderReference) => Promise<LookupOutcome>
  /** The order this conversation already proved, if any. */
  verifiedOrder: () => Promise<TrackableOrder | null>
  /**
   * Called when the visitor asks for a person. Channels differ in what that
   * means — Messenger already puts the thread in the Page inbox, the widget
   * has to flag the session and email someone.
   */
  onHumanRequested?: () => Promise<void>
  /**
   * Whether this conversation may still spend money on the model. Channels
   * that are open to the internet have to say no eventually; returning false
   * degrades to the menu rather than failing.
   */
  canUseAssistant?: () => Promise<boolean>
  /** Lets a channel show a typing indicator before a slow answer. */
  onThinking?: () => Promise<void>
}

export async function respondToPayload(payload: string, deps: RespondDeps): Promise<Reply> {
  const reply = replyForPayload(payload)
  if (payload === PAYLOADS.human && deps.onHumanRequested) {
    await deps.onHumanRequested().catch(err => console.error('chat: human handoff failed:', err))
  }
  return reply ?? fallbackReply()
}

export async function respondToText(text: string, deps: RespondDeps): Promise<Reply> {
  const trimmed = text.trim()
  if (!trimmed) return fallbackReply()

  // A handful of typed phrases route straight to a button answer, so "menu"
  // or "help" doesn't burn a model call to be shown a list.
  const keyword = payloadForText(trimmed)
  if (keyword) return respondToPayload(keyword, deps)

  // "#41 juan@example.com" — both halves, or it isn't a lookup. A bare order
  // number must never resolve: orders.id is a SERIAL and #1, #2, #3 are
  // guesses anyone can make.
  const ref = parseOrderReference(trimmed)
  if (ref) {
    const result = await deps.lookupOrder(ref)
    if (result.ok) return { text: formatOrderStatus(result.order) }
    return result.reason === 'rate_limited' ? rateLimitedReply() : orderNotFoundReply()
  }

  if (deps.canUseAssistant && !(await deps.canUseAssistant())) {
    return fallbackReply()
  }

  await deps.onThinking?.().catch(() => {})

  const verifiedOrder = await deps.verifiedOrder().catch(() => null)
  const answer = await assistantReply(trimmed, {
    verifiedOrder,
    lookupOrder: async (orderId, email) => {
      // The model's tool goes through the same authorised path as everything
      // else — one place an order can ever be revealed.
      const result = await deps.lookupOrder({ orderId, email })
      return result.ok ? result.order : null
    },
  })

  // A null answer — no key, a refusal, a failure, a tool loop that ran long —
  // degrades to the menu. Never silence, never a crash.
  return answer ?? fallbackReply()
}
