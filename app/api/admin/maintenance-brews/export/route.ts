import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/session'
import { isUndefinedTable } from '@/lib/dbErrors'
import { brewsToCsv, exportFilename, parseExportRange } from '@/lib/maintenanceExport'
import { listMaintenanceBrews } from '@/lib/maintenanceStore'

export const dynamic = 'force-dynamic'

/** GET ?from=YYYY-MM-DD&to=YYYY-MM-DD → the log as a CSV download. Both optional. */
export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const params = request.nextUrl.searchParams
  const parsed = parseExportRange(params.get('from'), params.get('to'))
  if (parsed.error !== undefined) return NextResponse.json({ error: parsed.error }, { status: 400 })

  try {
    const csv = brewsToCsv(await listMaintenanceBrews(parsed.range))
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${exportFilename(parsed.range)}"`,
        // Staff names and a cost record: nothing in between should keep a copy.
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    if (isUndefinedTable(err)) {
      console.error('GET /api/admin/maintenance-brews/export: tables missing, apply lib/migrations/0011_add_maintenance_brews.sql')
      return NextResponse.json(
        { error: 'Maintenance brews need migration 0011 — apply lib/migrations/0011_add_maintenance_brews.sql.' },
        { status: 503 }
      )
    }
    console.error('GET /api/admin/maintenance-brews/export error:', err)
    return NextResponse.json({ error: 'Failed to export maintenance brews' }, { status: 500 })
  }
}
