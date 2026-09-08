import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { sendAdminNotice } from '@/lib/email'
import { greeting, quickReplyTitle } from '@/lib/chat/conversation'
import { respondToPayload, respondToText, type RespondDeps } from '@/lib/chat/respond'
import {
  appendMessage,
  claimAssistantCall,
  findSession,
  getOrCreateSession,
  lookupOrder,
  markNeedsHuman,
  messagesFor,
  verifiedOrderFor,
  type ChatSession,
} from '@/lib/chat/store'

export const dynamic = 'force-dynamic'

const COOKIE = 'mmc-chat'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

// Long enough for a real question, short enough that nobody pastes a novel
// into the model's context on our budget.
const MAX_BODY_LENGTH = 1000

/**
 * The transcript so far — which is what lets a conversation survive a page
 * reload, something the old m.me link could never do.
 *
 * With `?after=N` it becomes the widget's poll for staff replies. An empty
 * conversation gets the greeting without it being written to the transcript:
 * a visitor who opens the widget and closes it again should leave nothing in
 * the staff inbox.
 */
export async function GET(request: NextRequest) {
  const visitorId = request.cookies.get(COOKIE)?.value
  const session = visitorId ? await findSession(visitorId) : null

  if (!session) {
    return NextResponse.json({ messages: [], opening: greeting().text, quickReplies: greeting().quickReplies })
  }

  const raw = Number(new URL(request.url).searchParams.get('after') ?? 0)
  const after = Number.isSafeInteger(raw) && raw > 0 ? raw : 0
  const messages = await messagesFor(session.id, after)
  const isEmpty = after === 0 && messages.length === 0

  return NextResponse.json({
    messages,
    needsHuman: session.needs_human,
    ...(isEmpty ? { opening: greeting().text, quickReplies: greeting().quickReplies } : {}),
  })
}

export async function POST(request: NextRequest) {
  let body: { text?: unknown; payload?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const text = typeof body.text === 'string' ? body.text.trim() : ''
  const payload = typeof body.payload === 'string' ? body.payload.trim() : ''

  if (!text && !payload) {
    return NextResponse.json({ error: 'Nothing to send' }, { status: 400 })
  }
  if (text.length > MAX_BODY_LENGTH) {
    return NextResponse.json({ error: 'That message is a bit long — could you shorten it?' }, { status: 400 })
  }

  // The visitor cookie is this channel's answer to Messenger's PSID: an
  // anonymous web visitor has no PSID, and there is no API to mint one. It is
  // opaque, httpOnly and ours — and it authenticates nothing. It means "same
  // browser as before", which is exactly why an order lookup still demands the
  // order number *and* the email on that order.
  const existing = request.cookies.get(COOKIE)?.value
  const visitorId = existing ?? randomUUID()

  try {
    const session = await getOrCreateSession(visitorId)
    const deps = depsFor(session)

    // Recorded before the reply is computed, so a slow or failing answer still
    // leaves the visitor's question in the transcript for a human to find.
    const visitorMessage = await appendMessage(
      session.id,
      'visitor',
      text || quickReplyTitle(payload)
    )

    const reply = payload
      ? await respondToPayload(payload, deps)
      : await respondToText(text, deps)

    const botMessage = await appendMessage(session.id, 'bot', reply.text)

    const response = NextResponse.json({
      messages: [visitorMessage, botMessage],
      quickReplies: reply.quickReplies ?? [],
    })

    if (!existing) {
      response.cookies.set(COOKIE, visitorId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: COOKIE_MAX_AGE,
      })
    }
    return response
  } catch (err) {
    console.error('POST /api/chat error:', err)
    return NextResponse.json({ error: 'Sorry — something went wrong. Please try again.' }, { status: 500 })
  }
}

// The on-site half of the contract in lib/chat/respond.ts. The decision
// sequence is shared with the Messenger webhook; only the state's home differs.
function depsFor(session: ChatSession): RespondDeps {
  return {
    lookupOrder: ref => lookupOrder(session, ref),
    verifiedOrder: () => verifiedOrderFor(session.id),
    // Unlike Messenger — where the thread is already sitting in the Page inbox
    // — nobody is watching this by default. Flag it *and* tell someone.
    onHumanRequested: async () => {
      await markNeedsHuman(session.id)
      await sendAdminNotice(
        'Someone is asking for a person in the website chat',
        'A visitor asked to speak to a human.\n\n' +
          'Open /admin/chat to answer. They are waiting on the site — this is the only notification anyone gets.'
      ).catch(err => console.error('chat: could not email the handoff notice:', err))
    },
    // This endpoint is public with nothing in front of it, so the budget is
    // the difference between a support bot and free compute for a stranger.
    canUseAssistant: () => claimAssistantCall(session),
  }
}
