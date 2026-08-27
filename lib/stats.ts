import { sql } from '@/lib/db'

// Shared by the admin dashboard (server component) and /api/admin/stats.
// The dashboard used to self-fetch its own API route over HTTP using a
// hardcoded localhost fallback (wrong port locally, and no fallback at all
// in production without NEXT_PUBLIC_URL set) — that request silently failed
// every time, which is why the dashboard always showed "—". Querying the DB
// directly removes the whole class of bug: no URL to get wrong, no extra
// network hop, works identically in dev and prod.
export async function getDashboardStats() {
  const [todayStats] = await sql`
    SELECT
      COUNT(*)::int                                      AS orders,
      COALESCE(SUM(total), 0)::int                       AS revenue
    FROM orders
    WHERE created_at >= CURRENT_DATE
  `

  const [weekStats] = await sql`
    SELECT
      COUNT(*)::int                                      AS orders,
      COALESCE(SUM(total), 0)::int                       AS revenue
    FROM orders
    WHERE created_at >= date_trunc('week', NOW())
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
      CURRENT_DATE - INTERVAL '6 days',
      CURRENT_DATE,
      INTERVAL '1 day'
    ) AS d(day)
    LEFT JOIN orders o ON DATE(o.created_at) = d.day
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
