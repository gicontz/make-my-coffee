// Maintenance brews (issue #51): beans brewed for dialing in, cleaning,
// calibration and testing — never sold, so absent from `orders`. Pure: types
// and input validation only, no db import, so tests load it without a
// connection string. Lives in lib/ rather than a route file because Next's
// App Router rejects route.ts exports that aren't handlers or config.

export const MAINTENANCE_STATUSES = ['in_progress', 'done', 'failed'] as const
export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number]

/**
 * Where an in-progress brew can go, once. `failed` means the assignee never
 * did it — a brew that never happened, so its grams are not beans used and
 * stay out of every total. A brew that was attempted and ruined did use its
 * beans: that is `done`.
 */
export const CLOSED_STATUSES = ['done', 'failed'] as const
export type ClosedStatus = (typeof CLOSED_STATUSES)[number]

export const MAINTENANCE_STATUS_LABEL: Record<MaintenanceStatus, string> = {
  in_progress: 'In Progress',
  done: 'Done',
  failed: 'Failed',
}

/** Mirrors the `char_length(activity) BETWEEN 1 AND 200` CHECK in migration 0011. */
export const ACTIVITY_MAX_LENGTH = 200

/**
 * A typo guard, not a business rule: the column takes any positive INTEGER,
 * but a maintenance brew is grams to a few hundred grams, and a value past a
 * 10 kg bag is an extra zero, not a brew. It also keeps a huge number from
 * overflowing INTEGER and surfacing as a 500 instead of a message.
 */
export const MAX_BEANS_GRAMS = 10_000

export interface Operator {
  id: number
  name: string
}

/** A row of GET /api/admin/maintenance-brews: the brew joined with its assignee. */
export interface MaintenanceBrew {
  id: number
  activity: string
  beans_grams: number
  operator_id: number
  operator_name: string
  status: MaintenanceStatus
  created_at: string
  done_at: string | null
  failed_at: string | null
}

export interface MaintenanceBrewInput {
  activity: string
  beansGrams: number
  operatorId: number
}

/**
 * Whole numbers only, from a JSON number or a string of digits. `Number()`
 * alone is too forgiving here: it reads `true` as 1, `''` and `' '` as 0, and
 * `'1e3'` as 1000.
 */
function wholeNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isInteger(value) ? value : undefined
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim())
  return undefined
}

/**
 * Validates POST /api/admin/maintenance-brews. The form is a convenience; this
 * is the check. Whether `operatorId` names a real operator is the route's job —
 * that needs the database.
 */
export function validateMaintenanceBrewInput(
  body: unknown
): { error: string; values?: undefined } | { error?: undefined; values: MaintenanceBrewInput } {
  if (!body || typeof body !== 'object') return { error: 'Invalid request.' }
  const b = body as Record<string, unknown>

  const activity = typeof b.activity === 'string' ? b.activity.trim() : ''
  if (!activity) return { error: 'Describe the maintenance activity.' }
  // Counted in code points, as Postgres's char_length does — `.length` counts
  // UTF-16 units and would reject an emoji-bearing note the column accepts.
  if (Array.from(activity).length > ACTIVITY_MAX_LENGTH) {
    return { error: `Keep the activity to ${ACTIVITY_MAX_LENGTH} characters or fewer.` }
  }

  const beansGrams = wholeNumber(b.beansGrams)
  if (beansGrams === undefined || beansGrams < 1) {
    return { error: 'Beans must be a whole number of grams, at least 1.' }
  }
  if (beansGrams > MAX_BEANS_GRAMS) {
    return { error: `Beans can't exceed ${MAX_BEANS_GRAMS.toLocaleString('en-PH')} g — check for an extra zero.` }
  }

  const operatorId = wholeNumber(b.operatorId)
  if (operatorId === undefined || operatorId < 1) return { error: 'Pick an assignee.' }

  return { values: { activity, beansGrams, operatorId } }
}

/**
 * PATCH /api/admin/maintenance-brews/[id] body → the status to close with.
 * Explicit, never defaulted: a bare PATCH meaning "done" would turn any
 * malformed "mark failed" request into a brew wrongly counted as beans used.
 */
export function parseCloseStatus(body: unknown): ClosedStatus | null {
  if (!body || typeof body !== 'object') return null
  const status = (body as Record<string, unknown>).status
  return (CLOSED_STATUSES as readonly unknown[]).includes(status) ? (status as ClosedStatus) : null
}

/** Grams that actually left the bag: done brews only. */
export function gramsUsed(brews: Pick<MaintenanceBrew, 'status' | 'beans_grams'>[]): number {
  return brews.reduce((sum, b) => (b.status === 'done' ? sum + b.beans_grams : sum), 0)
}

/** Route param → brew id, or null for anything that isn't a positive integer. */
export function parseBrewId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null
  const id = Number(raw)
  return id >= 1 && id <= 2_147_483_647 ? id : null
}
