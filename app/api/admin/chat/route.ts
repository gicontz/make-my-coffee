import { NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/session'
import { listSessions } from '@/lib/chat/store'

export const dynamic = 'force-dynamic'

// Guarded here rather than relying on middleware.ts, whose matcher is
// `/admin/:path*` — pages only, not `/api/admin/*` (decision.md open items).
export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    return NextResponse.json(await listSessions())
  } catch (err) {
    console.error('GET /api/admin/chat error:', err)
    return NextResponse.json({ error: 'Failed to load conversations' }, { status: 500 })
  }
}
