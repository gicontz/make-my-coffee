import { NextRequest, NextResponse } from 'next/server'
import { sendAdminNotice } from '@/lib/email'
import { assistantReply } from '@/lib/messenger/assistant'
import {
  fallbackReply,
  formatOrderStatus,
  greeting,
  orderNotFoundReply,
  parseOrderReference,
  payloadForText,
  rateLimitedReply,
  receiptAcknowledgement,
  replyForPayload,
  type Reply,
} from '@/lib/messenger/conversation'
import { sendReply, sendTypingOn } from '@/lib/messenger/send'
import { verificationChallenge, verifyWebhookSignature } from '@/lib/messenger/signature'
import { claimEvent, lookupOrder, verifiedOrderFor } from '@/lib/messenger/store'

// Reads headers and a raw body; nothing here is ever prerenderable.
export const dynamic = 'force-dynamic'

/**
 * Meta's subscription handshake. It will not save a callback URL until this
 * answers, which means the route has to be deployed *before* the webhook can
 * be configured in the app dashboard — use a preview deployment for that.
 */
export async function GET(request: NextRequest) {
  const challenge = verificationChallenge(
    new URL(request.url).searchParams,
    process.env.FB_VERIFY_TOKEN
  )
  if (challenge === null) {
    return new NextResponse('Forbidden', { status: 403 })
  }
  // Echoed verbatim as plain text — Meta compares the body byte for byte.
  return new NextResponse(challenge, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  })
}

export async function POST(request: NextRequest) {
  // The raw body, before anything parses it: the signature covers the exact
  // bytes Meta sent, and re-serialising parsed JSON produces different bytes.
  const raw = await request.text()

  if (!verifyWebhookSignature(raw, request.headers.get('x-hub-signature-256'), process.env.FB_APP_SECRET)) {
    // This route is public by necessity — Meta has to reach it, and
    // middleware.ts only guards /admin — so the signature is the only thing
    // between it and anyone who knows the URL.
    return new NextResponse('Forbidden', { status: 403 })
  }

  let payload: MessengerWebhookBody
  try {
    payload = JSON.parse(raw)
  } catch {
    return new NextResponse('Bad Request', { status: 400 })
  }

  // Meta ignores the body of a 200 and retries anything else. Work happens
  // before responding because this runs on serverless — there is no "after the
  // response" to defer to on Next 14 — so every handler below is bounded and
  // every failure is swallowed into a log rather than a non-200.
  try {
    for (const entry of payload.entry ?? []) {
      for (const event of entry.messaging ?? []) {
        await handleEvent(event).catch(err =>
          console.error('messenger: event handling failed:', err)
        )
      }
    }
  } catch (err) {
    console.error('messenger: webhook body was not shaped as expected:', err)
  }

  return NextResponse.json({ received: true })
}

async function handleEvent(event: MessagingEvent): Promise<void> {
  const psid = event.sender?.id
  if (!psid) return

  // Echoes of our own messages, delivery receipts and read receipts all arrive
  // here too. Answering them would talk to ourselves.
  if (event.message?.is_echo || event.delivery || event.read) return

  const mid = event.message?.mid ?? `${psid}:${event.timestamp ?? ''}:${event.postback?.payload ?? ''}`
  if (!(await claimEvent(mid))) return

  const reply = await composeReply(psid, event)
  if (!reply) return

  await sendReply(psid, reply).catch(err =>
    console.error(`messenger: could not reply to ${psid}:`, err)
  )
}

async function composeReply(psid: string, event: MessagingEvent): Promise<Reply | null> {
  // A tapped button or quick reply — deterministic, and the common case.
  const payload = event.postback?.payload ?? event.message?.quick_reply?.payload
  if (payload) {
    // get_started is what Meta sends on a first-ever conversation.
    if (payload === 'get_started') return greeting()
    return replyForPayload(payload) ?? fallbackReply()
  }

  const attachments = event.message?.attachments
  if (attachments?.length) {
    return handleAttachment(psid, attachments)
  }

  const text = event.message?.text?.trim()
  if (!text) return null

  const keyword = payloadForText(text)
  if (keyword) return replyForPayload(keyword)

  // "#41 juan@example.com" — both halves, or it isn't a lookup.
  const ref = parseOrderReference(text)
  if (ref) {
    const result = await lookupOrder(psid, ref)
    if (result.ok) return { text: formatOrderStatus(result.order) }
    return result.reason === 'rate_limited' ? rateLimitedReply() : orderNotFoundReply()
  }

  // Everything else goes to the model, which may call back into the same
  // authorised lookup. A null answer — no key, a refusal, a failure, a loop
  // that ran long — degrades to the menu.
  await sendTypingOn(psid)
  const verifiedOrder = await verifiedOrderFor(psid).catch(() => null)
  const answer = await assistantReply(text, {
    verifiedOrder,
    lookupOrder: async (orderId, email) => {
      const result = await lookupOrder(psid, { orderId, email })
      return result.ok ? result.order : null
    },
  })

  return answer ?? fallbackReply()
}

async function handleAttachment(psid: string, attachments: Attachment[]): Promise<Reply> {
  const isImage = attachments.some(a => a.type === 'image')
  if (!isImage) return fallbackReply()

  // Almost always a payment screenshot — #10 asks customers for exactly this.
  // It is evidence for a human, never a state change: nothing here marks an
  // order paid, because nothing here can tell a real receipt from a picture
  // of one.
  const order = await verifiedOrderFor(psid).catch(() => null)
  const url = attachments.find(a => a.type === 'image')?.payload?.url

  await sendAdminNotice(
    order ? `Messenger: image received for order #${order.id}` : 'Messenger: image received',
    [
      order
        ? `A customer sent an image on a thread verified against order #${order.id} (${order.payment_status}, ${order.order_status}).`
        : 'A customer sent an image on a Messenger thread with no verified order.',
      'It is most likely a payment screenshot. Nothing has been marked paid — confirm it in the admin yourself.',
      url ? `Image: ${url}` : 'The image is in the Page inbox.',
    ].join('\n\n')
  ).catch(err => console.error('messenger: could not email the receipt notice:', err))

  return receiptAcknowledgement()
}

// ── Webhook payload shapes ────────────────────────────────────────────────
// Only the fields this route reads. Meta sends a great deal more.

interface Attachment {
  type?: string
  payload?: { url?: string }
}

interface MessagingEvent {
  sender?: { id?: string }
  timestamp?: number
  message?: {
    mid?: string
    text?: string
    is_echo?: boolean
    quick_reply?: { payload?: string }
    attachments?: Attachment[]
  }
  postback?: { payload?: string }
  delivery?: unknown
  read?: unknown
}

interface MessengerWebhookBody {
  entry?: { messaging?: MessagingEvent[] }[]
}
