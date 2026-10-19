import { NextRequest, NextResponse } from 'next/server'
import { unsubscribe } from '@/lib/subscriberStore'
import { isUnsubscribeToken } from '@/lib/subscribe'

// Two callers, one action:
//
//   - Gmail/Yahoo's own Unsubscribe button, via the List-Unsubscribe header.
//     RFC 8058: a POST to the URL in the header, body
//     `List-Unsubscribe=One-Click`, and no further interaction allowed — the
//     token rides in the query string because that URL is all they have.
//   - The /unsubscribe page's button, which sends the token in a JSON body.
//
// POST only. Mail scanners GET every link in a message, and an unsubscribe on
// GET would take people off the list who never asked to leave.
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    let token: unknown = request.nextUrl.searchParams.get('token')
    if (!token && request.headers.get('content-type')?.includes('application/json')) {
      token = (await request.json().catch(() => ({})))?.token
    }

    if (!isUnsubscribeToken(token)) {
      return NextResponse.json({ error: 'That unsubscribe link isn’t valid.' }, { status: 400 })
    }

    if (!(await unsubscribe(token))) {
      return NextResponse.json({ error: 'We don’t recognise that unsubscribe link.' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST /api/unsubscribe error:', err)
    return NextResponse.json({ error: 'Couldn’t unsubscribe you just now. Please try again.' }, { status: 500 })
  }
}
