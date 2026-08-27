import { NextResponse } from 'next/server'
import { getDashboardStats } from '@/lib/stats'

// Admin dashboard stats must be live, never build-time cached. Marking the
// route dynamic also keeps `next build` from executing these queries during
// static prerender (which would require DATABASE_URL at build).
export const dynamic = 'force-dynamic'

export async function GET() {
  const stats = await getDashboardStats()
  return NextResponse.json(stats)
}
