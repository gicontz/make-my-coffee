// The free-text half of the bot: Claude, for anything the buttons don't cover.
//
// Two rules shape all of this.
//
// 1. The model is never the source of a fact. Prices, sizes and delivery rules
//    are rendered into the system prompt from lib/products.ts and
//    lib/shipping.ts on every call, and order details come back from a tool
//    that queries our own database. Nothing it "knows" is allowed to reach a
//    customer as a number.
// 2. Any failure degrades to the buttons. A missing key, a refusal, a timeout,
//    a malformed tool call — all end with the deterministic fallback reply, so
//    the worst case is a menu rather than silence or a stack trace.

import Anthropic from '@anthropic-ai/sdk'
import { products } from '../products.ts'
import { FREE_SHIPPING_MIN_SUBTOTAL } from '../shipping.ts'
import { DELIVERY_SLOTS } from '../deliverySlots.ts'
import { CHECKOUT_PAYMENT_METHODS, paymentMethodLabel, qrAccountFor } from '../paymentMethods.ts'
import { formatOrderStatus, parseOrderReference, type Reply, type TrackableOrder } from './conversation.ts'

const MODEL = 'claude-opus-5'

// Messenger caps a message at 2000 characters and support answers should be
// short anyway — this is a deliberate ceiling, not a lowball.
const MAX_TOKENS = 1024

// Two round trips: one to call the tool, one to answer with the result. More
// than that on a support question means something has gone wrong, and a
// serverless function is not the place for an open-ended loop.
const MAX_ITERATIONS = 2

export interface AssistantContext {
  /** Set when this chatter already proved an order earlier in the thread. */
  verifiedOrder: TrackableOrder | null
  /** Runs the same authorisation path the button flow uses. */
  lookupOrder: (orderId: number, email: string) => Promise<TrackableOrder | null>
}

function systemPrompt(ctx: AssistantContext): string {
  const catalogue = products
    .map(p => `- ${p.name}: ${p.shots} shots, ${p.volume}, ₱${p.price}`)
    .join('\n')

  const wallets = CHECKOUT_PAYMENT_METHODS.filter(m => qrAccountFor(m))
    .map(m => paymentMethodLabel(m))
    .join(', ')

  const slots = `${DELIVERY_SLOTS[0].label.split('–')[0].trim()} to ${DELIVERY_SLOTS[DELIVERY_SLOTS.length - 1].label.split('–')[1].trim()}`

  return `You are the customer-support assistant for Make My Coffee, a small Philippine shop selling bottled Aconchego espresso shots. You answer inside Facebook Messenger.

FACTS (the only ones you may state — everything below is generated from the live code, so it is current):
Products, each shot 30ml:
${catalogue}
Delivery: the fee is worked out per order from the exact location the customer pins at checkout, and is shown to them before they pay. You do NOT know what it will be. Free to Pasig City on orders of ₱${FREE_SHIPPING_MIN_SUBTOTAL.toLocaleString()} or more. Delivery windows run ${slots}, chosen by the customer at checkout.
Payment: Cash on Delivery, or pay ahead by QR with ${wallets}. QR payments are NOT verified automatically — a human confirms each one, and the customer should send a screenshot of their receipt with their order number.
Currency is Philippine pesos.

RULES:
- Never state a price, delivery fee, delivery date, refund or stock level that is not in the FACTS above or in a tool result. If you do not have it, say so and offer to pass them to a human.
- Never quote a delivery fee as a number, not even an estimate or a "usually around". It is computed per order from the pinned location and you cannot know it. Tell them to pin their location at checkout and the exact fee appears before payment.
- Never guess when an order will arrive. You do not have that information.
- To answer anything about a specific order, call look_up_order. It needs BOTH the order number and the email used to place it. If the customer gives only one, ask for the other — never look up an order on the number alone, and never reveal any detail of an order you have not looked up.
- Never repeat back a customer's address or phone number.
- Keep replies under 60 words, plain text, no markdown. This is a chat window.
- Warm and direct. No emoji spam, at most one.
- If the customer is upset, wants a refund or cancellation, or asks anything you cannot answer from the FACTS or a tool, say a human will take over.
${ctx.verifiedOrder ? `\nThis customer has already verified order #${ctx.verifiedOrder.id} in this conversation, so you may call look_up_order for it without asking again.` : ''}`
}

const LOOKUP_TOOL: Anthropic.Tool = {
  name: 'look_up_order',
  description:
    'Look up one order. Requires both the order number and the email address used to place it — the pair is what proves the order belongs to this customer. Returns status, delivery window, total and whether payment has been recorded. Returns not_found if the pair does not match.',
  input_schema: {
    type: 'object',
    properties: {
      order_id: { type: 'integer', description: 'The order number, e.g. 41' },
      email: { type: 'string', description: 'The email address used when placing the order' },
    },
    required: ['order_id', 'email'],
    additionalProperties: false,
  },
  strict: true,
}

/**
 * Answers free text, or returns null when the caller should use its own
 * fallback. Never throws.
 */
export async function assistantReply(
  text: string,
  ctx: AssistantContext
): Promise<Reply | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null

  try {
    const client = new Anthropic()
    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: text }]

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        // Support answers don't need deep reasoning, and effort is the main
        // cost lever — a whole conversation should cost a fraction of a peso.
        thinking: { type: 'adaptive' },
        output_config: { effort: 'low' },
        system: [
          {
            type: 'text',
            text: systemPrompt(ctx),
            // Identical on every call, so cache it rather than paying for the
            // catalogue and the rules on each message.
            cache_control: { type: 'ephemeral' },
          },
        ],
        tools: [LOOKUP_TOOL],
        messages,
      })

      // A safety decline is not an error and not something to relay verbatim —
      // hand to a human like any other thing the bot can't do.
      if (response.stop_reason === 'refusal') return null

      if (response.stop_reason !== 'tool_use') {
        const answer = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map(b => b.text)
          .join('\n')
          .trim()
        return answer ? { text: answer } : null
      }

      messages.push({ role: 'assistant', content: response.content })

      // Every tool_use block gets a tool_result, in one user message —
      // splitting them or dropping one leaves the conversation malformed.
      const results: Anthropic.ToolResultBlockParam[] = []
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue
        results.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: await runLookup(block.input, ctx),
        })
      }
      messages.push({ role: 'user', content: results })
    }

    // Still calling tools after the cap: give up rather than loop.
    return null
  } catch (err) {
    console.error('messenger: assistant call failed, falling back to menu:', err)
    return null
  }
}

async function runLookup(input: unknown, ctx: AssistantContext): Promise<string> {
  // Tool inputs are model-generated JSON — validate them exactly as if they
  // came from a browser. `strict: true` makes this unlikely, not impossible.
  const args = (input ?? {}) as { order_id?: unknown; email?: unknown }
  const orderId = Number(args.order_id)
  const email = typeof args.email === 'string' ? args.email : ''

  if (!Number.isSafeInteger(orderId) || orderId <= 0 || !parseOrderReference(`#${orderId} ${email}`)) {
    return 'invalid_arguments: an order number and the email used to place the order are both required'
  }

  try {
    const order = await ctx.lookupOrder(orderId, email)
    if (!order) return 'not_found: no order matches that number and email'
    return formatOrderStatus(order)
  } catch (err) {
    console.error('messenger: order lookup failed inside tool call:', err)
    return 'lookup_failed: could not reach the order system; tell the customer a human will check'
  }
}
