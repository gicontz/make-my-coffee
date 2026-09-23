import { NextResponse } from 'next/server'
import { getDashboardStats } from '@/lib/stats'
import { isAdminAuthenticated } from '@/lib/session'

// Admin dashboard stats must be live, never build-time cached. Marking the
// route dynamic also keeps `next build` from executing these queries during
// static prerender (which would require DATABASE_URL at build).
export const dynamic = 'force-dynamic'

export async function GET() {
  // Guarded here as well as in middleware.ts — revenue and order counts are
  // not public, and this answered anyone who asked until now.
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const stats = await getDashboardStats()
  return NextResponse.json(stats)
}
