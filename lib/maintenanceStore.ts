import { sql } from '@/lib/db'
import type { MaintenanceBrew } from '@/lib/maintenanceBrews'
import type { ExportRange } from '@/lib/maintenanceExport'

/**
 * The maintenance log, newest first, joined with each assignee's name. One
 * query for the page and the CSV export, so the file can't drift from what
 * the admin sees.
 *
 * The range is Manila calendar days by date logged, inclusive at both ends.
 * Each bound becomes that day's Manila midnight as an instant — `::timestamp
 * AT TIME ZONE 'Asia/Manila'` — because created_at is a TIMESTAMPTZ and the
 * database session is UTC: comparing against a bare date would cut each day
 * at 8am Manila time.
 */
export async function listMaintenanceBrews(range: ExportRange = { from: null, to: null }): Promise<MaintenanceBrew[]> {
  return (await sql`
    SELECT b.id, b.activity, b.beans_grams, b.operator_id, o.name AS operator_name,
           b.status, b.created_at, b.done_at, b.failed_at
    FROM maintenance_brews b
    JOIN operators o ON o.id = b.operator_id
    WHERE (${range.from}::date IS NULL OR b.created_at >= (${range.from}::date)::timestamp AT TIME ZONE 'Asia/Manila')
      AND (${range.to}::date   IS NULL OR b.created_at <  (${range.to}::date + 1)::timestamp AT TIME ZONE 'Asia/Manila')
    ORDER BY b.created_at DESC, b.id DESC
  `) as MaintenanceBrew[]
}
