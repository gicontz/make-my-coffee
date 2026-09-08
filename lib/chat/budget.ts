// How much model spend one conversation may cause. Pure, so the rule can be
// tested without a database.
//
// This matters more on the widget than on Messenger. POST /api/chat is open to
// the internet with nothing in front of it — no Meta, no login — so an
// uncapped model call behind it is somebody else's free compute. The cap
// degrades to the button menu rather than erroring: a visitor who exhausts it
// still gets answers, just not generated ones.

/** Model answers one visitor may cause in a day. */
export const MAX_ASSISTANT_CALLS_PER_SESSION = 30

/** Model answers the whole site may cause in a day, across every visitor. */
export const MAX_ASSISTANT_CALLS_PER_DAY = 1000

export interface AssistantBudget {
  assistant_calls: number
  /** The day those calls were counted against, as YYYY-MM-DD. */
  assistant_day: string
}

/**
 * The counter state after one more model call, and whether it is allowed.
 *
 * A day rolls over by resetting rather than by expiring rows, so a visitor who
 * used their allowance yesterday starts clean today.
 */
export function nextAssistantBudget(
  session: AssistantBudget,
  today: string
): { calls: number; day: string; allowed: boolean } {
  const sameDay = session.assistant_day === today
  const used = sameDay ? session.assistant_calls : 0
  const allowed = used < MAX_ASSISTANT_CALLS_PER_SESSION
  return { calls: allowed ? used + 1 : used, day: today, allowed }
}

/** Asia/Manila date as YYYY-MM-DD — the day boundary the shop actually lives in. */
export function manilaDay(now = new Date()): string {
  // Matching lib/stats.ts's discipline: never let the runtime's zone (UTC on
  // Vercel) decide what "today" means, or a cap resets in the middle of an
  // evening's traffic.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(now)
}
