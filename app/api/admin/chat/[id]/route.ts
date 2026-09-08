import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/session'
import { appendStaffReply, messagesFor } from '@/lib/chat/store'

export const dynamic = 'force-dynamic'

// Session ids are UUIDs. Checked before they reach a query so a malformed id
// is a 400 rather than a Postgres cast error surfacing as a 500.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const MAX_REPLY_LENGTH = 2000

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!UUID.test(params.id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  try {
    return NextResponse.json({ messages: await messagesFor(params.id) })
  } catch (err) {
    console.error('GET /api/admin/chat/[id] error:', err)
    return NextResponse.json({ error: 'Failed to load the conversation' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!UUID.test(params.id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const text = typeof body?.text === 'string' ? body.text.trim() : ''

  if (!text) return NextResponse.json({ error: 'Nothing to send' }, { status: 400 })
  if (text.length > MAX_REPLY_LENGTH) {
    return NextResponse.json({ error: 'Reply is too long' }, { status: 400 })
  }

  try {
    // Replying clears needs_human — someone has picked this up.
    return NextResponse.json(await appendStaffReply(params.id, text))
  } catch (err) {
    console.error('POST /api/admin/chat/[id] error:', err)
    return NextResponse.json({ error: 'Failed to send the reply' }, { status: 500 })
  }
}
