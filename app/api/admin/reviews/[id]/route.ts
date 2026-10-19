import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { isAdminAuthenticated } from '@/lib/session'
import { REVIEWS_TAG, moderateReview } from '@/lib/reviewStore'

export const dynamic = 'force-dynamic'

/**
 * Publish (`{ approved: true }`) or reject (`{ approved: false }`) a review.
 *
 * That is the whole of what moderation can do. There is deliberately no way
 * to edit a review's words, rating or name, and no route that creates one —
 * an admin rewriting a customer's review is writing a review (lib/reviews.ts).
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const body = await request.json().catch(() => null)
  if (typeof body?.approved !== 'boolean') {
    return NextResponse.json({ error: 'approved must be true or false' }, { status: 400 })
  }

  try {
    const review = await moderateReview(id, body.approved)
    if (!review) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Product pages are static; without this a decision would not show until
    // the hourly revalidation.
    revalidateTag(REVIEWS_TAG)
    for (const productId of (review.product_ids as string[]) ?? []) revalidatePath(`/shop/${productId}`)

    return NextResponse.json(review)
  } catch (err) {
    console.error('PATCH /api/admin/reviews/[id] error:', err)
    return NextResponse.json({ error: 'Failed to update the review' }, { status: 500 })
  }
}
