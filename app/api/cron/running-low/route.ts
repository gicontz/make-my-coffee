import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { claimReminder, reminderCandidates, releaseReminder } from '@/lib/subscriberStore'
import { sendRunningLowEmail } from '@/lib/email'
import { isReminderDue, reminderDueDate, totalShots } from '@/lib/subscribe'
import { manilaDay } from '@/lib/deliveryDate'

// The running-low reminder (#39), run daily by Vercel Cron (vercel.json).
//
// This reads customer names and email addresses out of `orders`, so it is
// not a public route: Vercel sends `Authorization: Bearer $CRON_SECRET` with
// each scheduled call, and without that secret configured the job refuses to
// run at all rather than run open.
export const dynamic = 'force-dynamic'

function authorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const given = Buffer.from(request.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.warn('CRON_SECRET is not set — running-low reminders are disabled.')
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }
  if (!authorised(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const today = manilaDay(now)
  let sent = 0
  let failed = 0

  try {
    const candidates = await reminderCandidates(now)
    const due = candidates.filter(c => isReminderDue(reminderDueDate(c.deliveryDate, totalShots(c.items)), today))

    // One at a time: a day's volume is a handful, and a burst is what gets a
    // new sending domain throttled.
    for (const c of due) {
      if (!(await claimReminder(c.orderId))) continue
      try {
        await sendRunningLowEmail({
          orderId: c.orderId,
          firstName: c.firstName,
          email: c.email,
          shots: totalShots(c.items),
          deliveryDate: c.deliveryDate,
          unsubscribeToken: c.unsubscribeToken,
          now,
        })
        sent++
      } catch (err) {
        failed++
        console.error(`Running-low reminder for order ${c.orderId} failed:`, err)
        // Within REMINDER_GRACE_DAYS, tomorrow's run picks it up again.
        await releaseReminder(c.orderId).catch(releaseErr =>
          console.error('Failed to release reminder claim:', releaseErr)
        )
      }
    }

    return NextResponse.json({ day: today, considered: candidates.length, due: due.length, sent, failed })
  } catch (err) {
    console.error('GET /api/cron/running-low error:', err)
    return NextResponse.json({ error: 'Reminder run failed', sent, failed }, { status: 500 })
  }
}
