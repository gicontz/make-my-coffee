import { NextRequest, NextResponse } from 'next/server'
import { isLinkTokenShape } from '@/lib/linkToken'
import { isSubscriptionAction } from '@/lib/subscriptions'
import { actOnSubscription, viewSubscription } from '@/lib/subscriptionStore'

export const dynamic = 'force-dynamic'

const INVALID = 'This subscription link is not valid.'

/**
 * The /subscription page's only backend: `{ token }` reads the subscription,
 * `{ token, action }` pauses, resumes, skips or cancels it.
 *
 * Public, and keyed on the manage token alone — 256 bits derived from a server
 * secret (lib/linkToken.ts), so there is nothing to guess and no order number
 * or email to walk. POST, not GET with the token in the query string: a query
 * string lands in request logs, and the token is the customer's only
 * credential here.
 */
export async function POST(request: NextRequest) {
  const { token, action } = (await request.json().catch(() => ({}))) as { token?: unknown; action?: unknown }
  if (!isLinkTokenShape(token)) {
    return NextResponse.json({ error: INVALID }, { status: 404 })
  }
  if (action !== undefined && !isSubscriptionAction(action)) {
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  }

  try {
    if (action === undefined) {
      const view = await viewSubscription(token)
      return view
        ? NextResponse.json(view)
        : NextResponse.json({ error: INVALID }, { status: 404 })
    }

    const outcome = await actOnSubscription(token, action)
    switch (outcome.kind) {
      case 'ok':        return NextResponse.json(outcome.view)
      case 'not-found': return NextResponse.json({ error: INVALID }, { status: 404 })
      case 'refused':   return NextResponse.json({ error: outcome.error }, { status: 422 })
      case 'conflict':
        return NextResponse.json(
          { error: 'Your subscription changed while you were looking at it. Here is how it stands now.' },
          { status: 409 },
        )
    }
  } catch (err) {
    console.error('POST /api/subscriptions/manage error:', err)
    return NextResponse.json({ error: 'Could not reach your subscription. Please try again later.' }, { status: 500 })
  }
}
