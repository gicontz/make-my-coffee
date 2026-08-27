import { sql } from '@/lib/db'

// Shared by the admin dashboard (server component) and /api/admin/stats.
// The dashboard used to self-fetch its own API route over HTTP using a
// hardcoded localhost fallback (wrong port locally, and no fallback at all
// in production without NEXT_PUBLIC_URL set) — that request silently failed
// every time, which is why the dashboard always showed "—". Querying the DB
// directly removes the whole class of bug: no URL to get wrong, no extra
// network hop, works identically in dev and prod.
// The business (customers, delivery, staff) is entirely Manila-local, so
// "today" and "this week" must mean Manila's calendar day/week — not the
// database session's timezone (UTC on Neon). Without this, CURRENT_DATE /
// NOW() evaluate in UTC, and Today's Orders silently undercounts for the
// first 8 hours of every Manila day (Manila is UTC+8) since an order placed
// at 1am Manila time still reads as "yesterday" in UTC until 8am. The
// `date_trunc('day', NOW() AT TIME ZONE tz) AT TIME ZONE tz` idiom converts
// "now" to Manila wall-clock, truncates to Manila midnight, then converts
// that back to a real instant (timestamptz) to compare created_at against.
const TZ = 'Asia/Manila'

export async function getDashboardStats() {
  const [todayStats] = await sql`
    SELECT
      COUNT(*)::int                                      AS orders,
      COALESCE(SUM(total), 0)::int                       AS revenue
    FROM orders
    WHERE created_at >= date_trunc('day', NOW() AT TIME ZONE ${TZ}) AT TIME ZONE ${TZ}
  `

  const [weekStats] = await sql`
    SELECT
      COUNT(*)::int                                      AS orders,
      COALESCE(SUM(total), 0)::int                       AS revenue
    FROM orders
    WHERE created_at >= date_trunc('week', NOW() AT TIME ZONE ${TZ}) AT TIME ZONE ${TZ}
  `

  const [allStats] = await sql`
    SELECT
      COUNT(*)::int                                      AS orders,
      COALESCE(SUM(total), 0)::int                       AS revenue
    FROM orders
  `

  // "Pending" here means "placed but not concluded" — anything that hasn't
  // reached a terminal state (delivered or cancelled) yet, not just the
  // literal order_status = 'pending' row. An approved or shipped order is
  // still awaiting action from the operator's point of view.
  const [openCount] = await sql`
    SELECT COUNT(*)::int AS count FROM orders WHERE order_status NOT IN ('delivered', 'cancelled')
  `

  const statusBreakdown = await sql`
    SELECT order_status, COUNT(*)::int AS count
    FROM orders
    GROUP BY order_status
  `

  const daily = (await sql`
    SELECT
      TO_CHAR(d.day, 'Mon DD')                           AS date,
      COALESCE(COUNT(o.id), 0)::int                      AS orders,
      COALESCE(SUM(o.total), 0)::int                     AS revenue
    FROM generate_series(
      (NOW() AT TIME ZONE ${TZ})::date - INTERVAL '6 days',
      (NOW() AT TIME ZONE ${TZ})::date,
      INTERVAL '1 day'
    ) AS d(day)
    LEFT JOIN orders o ON (o.created_at AT TIME ZONE ${TZ})::date = d.day
    GROUP BY d.day
    ORDER BY d.day ASC
  `) as { date: string; orders: number; revenue: number }[]

  const recentOrders = (await sql`
    SELECT id, first_name, last_name, city, total, order_status, payment_status, created_at
    FROM orders
    ORDER BY created_at DESC
    LIMIT 5
  `) as {
    id: number; first_name: string; last_name: string; city: string
    total: number; order_status: string; payment_status: string; created_at: string
  }[]

  return {
    today: { orders: todayStats.orders, revenue: todayStats.revenue },
    week: { orders: weekStats.orders, revenue: weekStats.revenue },
    all: { orders: allStats.orders, revenue: allStats.revenue },
    pendingCount: openCount.count,
    statusBreakdown: statusBreakdown as { order_status: string; count: number }[],
    daily,
    recentOrders,
  }
}
