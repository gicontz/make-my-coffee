import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/session'
import { isModerationFilter, listReviews } from '@/lib/reviewStore'

export const dynamic = 'force-dynamic'

/** The moderation queue (?status=pending, the default), or what was decided. */
export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const status = request.nextUrl.searchParams.get('status') ?? 'pending'
  if (!isModerationFilter(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  try {
    return NextResponse.json(await listReviews(status))
  } catch (err) {
    console.error('GET /api/admin/reviews error:', err)
    return NextResponse.json({ error: 'Failed to load reviews' }, { status: 500 })
  }
}
