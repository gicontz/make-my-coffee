import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { isAdminAuthenticated } from '@/lib/session'
import { MAINTENANCE_STATUS_LABEL, parseBrewId, parseCloseStatus, type MaintenanceStatus } from '@/lib/maintenanceBrews'

export const dynamic = 'force-dynamic'

/**
 * Close a brew: `{ status: 'done' }` or `{ status: 'failed' }`. The only write
 * this route makes, and it goes one way — in_progress to one of those, once.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = parseBrewId(params.id)
  if (id === null) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const status = parseCloseStatus(await request.json().catch(() => null))
  if (status === null) return NextResponse.json({ error: 'status must be "done" or "failed"' }, { status: 400 })

  try {
    // `AND status = 'in_progress'` makes this a real transition or nothing,
    // the same pattern as order status: a second click, a retried request or
    // two admins on one row cannot re-stamp it, or flip done to failed. An
    // empty RETURNING is the signal that nothing changed. Two literal
    // statements rather than one with an interpolated status, so each sets
    // exactly its own timestamp.
    const changed = status === 'done'
      ? await sql`
          UPDATE maintenance_brews SET status = 'done', done_at = NOW()
          WHERE id = ${id} AND status = 'in_progress'
          RETURNING id, status, done_at, failed_at
        `
      : await sql`
          UPDATE maintenance_brews SET status = 'failed', failed_at = NOW()
          WHERE id = ${id} AND status = 'in_progress'
          RETURNING id, status, done_at, failed_at
        `
    if (changed.length) return NextResponse.json(changed[0])

    const existing = (await sql`SELECT status FROM maintenance_brews WHERE id = ${id}`) as { status: MaintenanceStatus }[]
    if (existing.length === 0) return NextResponse.json({ error: 'Brew not found' }, { status: 404 })
    const current = MAINTENANCE_STATUS_LABEL[existing[0].status] ?? existing[0].status
    return NextResponse.json({ error: `This brew is already marked ${current}.` }, { status: 409 })
  } catch (err) {
    console.error('PATCH /api/admin/maintenance-brews/[id] error:', err)
    return NextResponse.json({ error: 'Failed to update brew' }, { status: 500 })
  }
}
