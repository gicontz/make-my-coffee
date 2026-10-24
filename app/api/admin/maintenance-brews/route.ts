import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { isAdminAuthenticated } from '@/lib/session'
import { isUndefinedTable } from '@/lib/dbErrors'
import { validateMaintenanceBrewInput } from '@/lib/maintenanceBrews'
import { listMaintenanceBrews } from '@/lib/maintenanceStore'

export const dynamic = 'force-dynamic'

const MIGRATION_MISSING = 'Maintenance brews need migration 0011 — apply lib/migrations/0011_add_maintenance_brews.sql.'

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    return NextResponse.json(await listMaintenanceBrews())
  } catch (err) {
    // Deployed ahead of its migration (#52): say which one, not just "failed".
    if (isUndefinedTable(err)) {
      console.error('GET /api/admin/maintenance-brews: tables missing, apply lib/migrations/0011_add_maintenance_brews.sql')
      return NextResponse.json({ error: MIGRATION_MISSING }, { status: 503 })
    }
    console.error('GET /api/admin/maintenance-brews error:', err)
    return NextResponse.json({ error: 'Failed to load maintenance brews' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = validateMaintenanceBrewInput(await request.json().catch(() => null))
  if (parsed.error !== undefined) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const v = parsed.values

  try {
    // INSERT … SELECT FROM operators is the existence check: an unknown
    // operator selects no row, so nothing is inserted and RETURNING is empty —
    // no window between a lookup and the write. Status is never taken from
    // the request; a new brew is always in_progress (the column default).
    const rows = await sql`
      INSERT INTO maintenance_brews (activity, beans_grams, operator_id)
      SELECT ${v.activity}, ${v.beansGrams}, o.id FROM operators o WHERE o.id = ${v.operatorId}
      RETURNING id, activity, beans_grams, operator_id,
                (SELECT name FROM operators WHERE id = operator_id) AS operator_name,
                status, created_at, done_at, failed_at
    `
    if (rows.length === 0) return NextResponse.json({ error: 'Pick an assignee from the list.' }, { status: 400 })
    return NextResponse.json(rows[0], { status: 201 })
  } catch (err) {
    if (isUndefinedTable(err)) {
      console.error('POST /api/admin/maintenance-brews: tables missing, apply lib/migrations/0011_add_maintenance_brews.sql')
      return NextResponse.json({ error: MIGRATION_MISSING }, { status: 503 })
    }
    console.error('POST /api/admin/maintenance-brews error:', err)
    return NextResponse.json({ error: 'Failed to log brew' }, { status: 500 })
  }
}
