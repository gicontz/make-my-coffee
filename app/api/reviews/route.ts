import { NextRequest, NextResponse } from 'next/server'
import { sendAdminNotice } from '@/lib/email'
import { isReviewTokenShape, validateReviewInput } from '@/lib/reviews'
import { submitReview } from '@/lib/reviewStore'
import { siteUrl } from '@/lib/siteUrl'

export const dynamic = 'force-dynamic'

/**
 * A customer submits the review for their delivered order.
 *
 * The token from the delivered email is the only credential, and the store
 * re-checks in the INSERT itself that it maps to an order still marked
 * delivered (lib/reviewStore.ts). Nothing goes public from here — every
 * review lands in the moderation queue at /admin/reviews.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  if (!isReviewTokenShape(body.token)) {
    return NextResponse.json({ error: 'This review link is not valid.' }, { status: 404 })
  }

  const input = validateReviewInput(body)
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 })

  let outcome
  try {
    outcome = await submitReview(body.token, input.value)
  } catch (err) {
    console.error('POST /api/reviews error:', err)
    return NextResponse.json({ error: 'Your review could not be saved. Please try again in a few minutes.' }, { status: 500 })
  }
  switch (outcome.kind) {
    case 'not-found':
      return NextResponse.json({ error: 'This review link is not valid.' }, { status: 404 })
    case 'not-delivered':
      return NextResponse.json({ error: 'This order is not marked as delivered, so it cannot be reviewed yet.' }, { status: 409 })
    case 'reviewed':
      return NextResponse.json({ error: 'This order has already been reviewed — thank you.' }, { status: 409 })
  }

  // Fire-and-forget (D5). Nothing the customer wrote goes into this email:
  // sendAdminNotice() interpolates its body as HTML, and the review is one
  // click away in the queue anyway.
  await sendAdminNotice(
    `New review on order #${outcome.orderId}`,
    `A ${outcome.rating}-star review is waiting for moderation. Nothing is published until it is approved:\n${siteUrl()}/admin/reviews`
  ).catch(err => console.error(`Review notice failed for order ${outcome.orderId}:`, err))

  return NextResponse.json({ ok: true }, { status: 201 })
}
