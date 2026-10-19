import { NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/session'
import { subscriberSummary } from '@/lib/subscriberStore'

// Counts only — how the signup list and its welcome codes are doing. Shown on
// /admin/vouchers, where the welcome codes would otherwise be invisible (they
// are kept out of that list, one row per signup being noise).
export const dynamic = 'force-dynamic'

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    return NextResponse.json(await subscriberSummary())
  } catch (err) {
    console.error('GET /api/admin/subscribers error:', err)
    return NextResponse.json({ error: 'Failed to load subscriber summary' }, { status: 500 })
  }
}
