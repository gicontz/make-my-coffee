import { NextRequest, NextResponse } from 'next/server'
import { isReviewTokenShape } from '@/lib/reviews'
import { viewReviewRequest } from '@/lib/reviewStore'

export const dynamic = 'force-dynamic'

/**
 * What /review shows for a token: whose order, what was in it, and whether a
 * review can still be written.
 *
 * POST, not GET with the token in the query string — a query string lands in
 * request logs, and the token is the customer's only credential here.
 *
 * Keyed on the token alone, never on an order number: `orders.id` is a
 * SERIAL, and a lookup by number would let anyone walk the table.
 */
export async function POST(request: NextRequest) {
  const { token } = (await request.json().catch(() => ({}))) as { token?: unknown }
  if (!isReviewTokenShape(token)) {
    return NextResponse.json({ error: 'This review link is not valid.' }, { status: 404 })
  }

  let view
  try {
    view = await viewReviewRequest(token)
  } catch (err) {
    console.error('POST /api/reviews/request error:', err)
    return NextResponse.json({ error: 'Could not load this order. Please try again later.' }, { status: 500 })
  }
  if (!view) return NextResponse.json({ error: 'This review link is not valid.' }, { status: 404 })
  return NextResponse.json(view)
}
