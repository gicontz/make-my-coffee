// CSV export of the maintenance brew log (issue #51). Pure — no db import —
// so the escaping, the date range and the filename are unit-tested without a
// connection string. The route only queries and hands rows to brewsToCsv().
//
// CSV rather than XLSX or XML: it opens directly in Excel and Google Sheets,
// which is where it is going (the profit analysis), and it needs no library.

import { addDays, manilaDay } from './deliveryDate.ts'
import { MAINTENANCE_STATUS_LABEL, type MaintenanceBrew } from './maintenanceBrews.ts'

/** An inclusive range of Asia/Manila calendar days, by date logged. Either end may be open. */
export interface ExportRange {
  from: string | null
  to: string | null
}

/**
 * A real YYYY-MM-DD calendar day. addDays() normalises through Date.UTC, so a
 * day that doesn't exist (2026-02-30) comes back as a different string.
 */
function isCalendarDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && addDays(value, 0) === value
}

/** `?from=&to=` → a range, or a message. Blank means open-ended, not an error. */
export function parseExportRange(
  from: string | null | undefined,
  to: string | null | undefined
): { error: string; range?: undefined } | { error?: undefined; range: ExportRange } {
  const f = from?.trim() || null
  const t = to?.trim() || null
  if (f !== null && !isCalendarDay(f)) return { error: 'From must be a date (YYYY-MM-DD).' }
  if (t !== null && !isCalendarDay(t)) return { error: 'To must be a date (YYYY-MM-DD).' }
  // ISO dates compare correctly as strings.
  if (f !== null && t !== null && f > t) return { error: 'From must be on or before To.' }
  return { range: { from: f, to: t } }
}

/**
 * One CSV field. RFC 4180 quoting, plus a guard against formula injection: a
 * cell starting with = + - @ (or a tab or CR, which some spreadsheet apps strip
 * before reading the formula) runs as a formula when the file is opened in
 * Excel or Sheets, so `=HYPERLINK(...)` typed as an activity would become a
 * live link on the admin's machine. A leading apostrophe makes it plain text.
 * Only strings are guarded — numbers are ours, never typed by anyone.
 */
export function csvCell(value: string | number | null): string {
  if (value === null) return ''
  if (typeof value === 'number') return String(value)
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/**
 * `YYYY-MM-DD HH:mm` in Asia/Manila. Sortable as text, and Excel and Sheets
 * both read it as a date-time. The zone is in the column header, not each cell.
 */
export function manilaStamp(iso: string | null): string | null {
  if (!iso) return null
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    })
      .formatToParts(new Date(iso))
      .map(p => [p.type, p.value])
  )
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`
}

export const CSV_HEADER = [
  'ID',
  'Activity',
  'Beans (g)',
  'Counted as used',
  'Assignee',
  'Status',
  'Logged at (Manila)',
  'Closed at (Manila)',
] as const

/**
 * The log as CSV. No totals row: one would be summed into itself by a later
 * SUM and breaks sorting and filtering. "Counted as used" carries the rule
 * instead (done only — see gramsUsed()), so `=SUMIF(D:D,"Yes",C:C)` matches
 * the page.
 *
 * Starts with a UTF-8 BOM, without which Excel on Windows reads the file as
 * the local codepage and mangles any ñ or ₱ in an activity. CRLF line ends,
 * per RFC 4180.
 */
export function brewsToCsv(brews: MaintenanceBrew[]): string {
  const rows = brews.map(b => [
    b.id,
    b.activity,
    b.beans_grams,
    b.status === 'done' ? 'Yes' : 'No',
    b.operator_name,
    MAINTENANCE_STATUS_LABEL[b.status] ?? b.status,
    manilaStamp(b.created_at),
    manilaStamp(b.done_at ?? b.failed_at),
  ])
  return '﻿' + [CSV_HEADER, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

/** e.g. maintenance-brews_2026-10-01_to_2026-10-31.csv; open ends read as start/today. */
export function exportFilename(range: ExportRange, now = new Date()): string {
  const to = range.to ?? manilaDay(now)
  return range.from
    ? `maintenance-brews_${range.from}_to_${to}.csv`
    : `maintenance-brews_up-to_${to}.csv`
}
