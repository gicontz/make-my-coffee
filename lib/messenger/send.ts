// Outbound half of the Messenger Platform: the Send API.

import type { Reply } from './conversation.ts'

const GRAPH_VERSION = 'v21.0'

// Messenger truncates a text message past this and rejects quick-reply titles
// past 20 characters. Trimming here beats having Meta silently mangle copy.
const MAX_TEXT = 2000
const MAX_QUICK_REPLY_TITLE = 20
const MAX_QUICK_REPLIES = 13

export function truncate(text: string, max = MAX_TEXT): string {
  return text.length <= max ? text : text.slice(0, max - 1).trimEnd() + '…'
}

/**
 * Sends one reply to one person.
 *
 * Deliberately swallows nothing: the caller decides what a failure means. In
 * the webhook that means logging and moving on — the HTTP 200 has already gone
 * back to Meta by then, and retrying inside a serverless function that is
 * about to be frozen achieves nothing.
 */
export async function sendReply(psid: string, reply: Reply): Promise<void> {
  const token = process.env.FB_PAGE_ACCESS_TOKEN
  if (!token) throw new Error('FB_PAGE_ACCESS_TOKEN is not set')

  const message: Record<string, unknown> = { text: truncate(reply.text) }

  if (reply.quickReplies?.length) {
    message.quick_replies = reply.quickReplies.slice(0, MAX_QUICK_REPLIES).map(qr => ({
      content_type: 'text',
      title: truncate(qr.title, MAX_QUICK_REPLY_TITLE),
      payload: qr.payload,
    }))
  }

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/me/messages?access_token=${encodeURIComponent(token)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: psid },
        // RESPONSE is the standard 24-hour window: a reply to something the
        // customer just sent. Anything proactive outside that window needs a
        // message tag instead, and using a tag for marketing is how a Page
        // gets restricted — so this bot only ever answers.
        messaging_type: 'RESPONSE',
        message,
      }),
    }
  )

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Send API rejected the message (${res.status}): ${detail.slice(0, 300)}`)
  }
}

/** The typing indicator, so a slow LLM reply doesn't look like being ignored. */
export async function sendTypingOn(psid: string): Promise<void> {
  const token = process.env.FB_PAGE_ACCESS_TOKEN
  if (!token) return
  await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/me/messages?access_token=${encodeURIComponent(token)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: { id: psid }, sender_action: 'typing_on' }),
    }
  ).catch(() => {
    // Cosmetic. Never let it break the actual reply.
  })
}
