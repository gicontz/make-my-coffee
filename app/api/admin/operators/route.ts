import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { isAdminAuthenticated } from '@/lib/session'
import { isUndefinedTable } from '@/lib/dbErrors'

export const dynamic = 'force-dynamic'

// Read-only, deliberately: operators are seeded by migration 0011 and adding
// one is a migration (issue #51). Don't add a POST here without that decision.
export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    return NextResponse.json(await sql`SELECT id, name FROM operators ORDER BY name`)
  } catch (err) {
    if (isUndefinedTable(err, 'operators')) {
      console.error('GET /api/admin/operators: table missing, apply lib/migrations/0011_add_maintenance_brews.sql')
      return NextResponse.json(
        { error: 'Operators need migration 0011 — apply lib/migrations/0011_add_maintenance_brews.sql.' },
        { status: 503 }
      )
    }
    console.error('GET /api/admin/operators error:', err)
    return NextResponse.json({ error: 'Failed to load operators' }, { status: 500 })
  }
}
