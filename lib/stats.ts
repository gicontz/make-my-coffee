import { sql } from '@/lib/db'

// Shared by the admin dashboard (server component) and /api/admin/stats.
// The dashboard used to self-fetch its own API route over HTTP using a
// hardcoded localhost fallback (wrong port locally, and no fallback at all
// in production without NEXT_PUBLIC_URL set) — that request silently failed
// every time, which is why the dashboard always showed "—". Querying the DB
// directly removes the whole class of bug: no URL to get wrong, no extra
// network hop, works identically in dev and prod.
//
// Two rules govern every money figure below:
//
//   1. Revenue means MONEY COLLECTED: payment_status = 'paid' on an order that
//      wasn't cancelled. This is COD — an order exists long before any cash
//      does, and a cancelled one never produces any. Summing `total` over all
//      orders (what this file used to do) reported ₱3,379 of "revenue" for a
//      store whose entire history was 5 cancelled orders and 1 unpaid one:
//      ₱0 actually collected. Money still owed is reported separately as
//      `uncollected`, so nothing is hidden — just not counted as earned.
//   2. "Today" and "this week" are Asia/Manila days, not the server's. Vercel
//      runs UTC, so a bare CURRENT_DATE files every order placed between
//      Manila midnight and 8am under the previous day.
//
// Orders and revenue are bucketed by two DIFFERENT days, because they answer
// different questions: order counts (today_orders, uncollected, cancelled)
// are keyed on created_at — when the order was PLACED. Revenue is keyed on
// paid_at (0005_add_paid_at.sql) — when the cash actually came in, set by the
// PATCH handler in app/api/admin/orders/[id]/route.ts the moment payment_status
// flips to 'paid'. An order placed Aug 30 and paid Sep 2 counts as an Aug 30
// order but Sep 2 revenue. For same-day COD collection these coincide; the gap
// only shows up once collection starts lagging placement.
//
// The paid/owed conditions are written out in each query rather than shared as
// a constant: the neon() HTTP driver has no SQL-fragment composition, so an
// interpolated `${...}` becomes a bound parameter, not spliced-in SQL.
export async function getDashboardStats() {
  const [totals] = (await sql`
    WITH o AS (
      SELECT
        total,
        order_status,
        payment_status = 'paid'   AND order_status <> 'cancelled' AS is_paid,
        payment_status = 'unpaid' AND order_status <> 'cancelled' AS is_owed,
        (created_at AT TIME ZONE 'Asia/Manila')::date             AS order_day,
        (paid_at    AT TIME ZONE 'Asia/Manila')::date             AS paid_day
      FROM orders
    ),
    b AS (
      SELECT (NOW() AT TIME ZONE 'Asia/Manila')::date                   AS today,
             date_trunc('week', NOW() AT TIME ZONE 'Asia/Manila')::date AS week_start
    )
    SELECT
      COUNT(*)              FILTER (WHERE o.order_day = b.today)::int                     AS today_orders,
      COALESCE(SUM(o.total) FILTER (WHERE o.paid_day = b.today AND o.is_paid), 0)::int    AS today_revenue,
      COALESCE(SUM(o.total) FILTER (WHERE o.order_day = b.today AND o.is_owed), 0)::int   AS today_uncollected,
      COUNT(*)              FILTER (WHERE o.order_day = b.today
                                      AND o.order_status = 'cancelled')::int              AS today_cancelled,

      COUNT(*)              FILTER (WHERE o.order_day >= b.week_start)::int                     AS week_orders,
      COALESCE(SUM(o.total) FILTER (WHERE o.paid_day >= b.week_start AND o.is_paid), 0)::int    AS week_revenue,
      COALESCE(SUM(o.total) FILTER (WHERE o.order_day >= b.week_start AND o.is_owed), 0)::int   AS week_uncollected,

      COUNT(*)::int                                                                    AS all_orders,
      COALESCE(SUM(o.total) FILTER (WHERE o.is_paid), 0)::int                          AS all_revenue,
      COALESCE(SUM(o.total) FILTER (WHERE o.is_owed), 0)::int                          AS all_uncollected,
      COUNT(*)              FILTER (WHERE o.order_status = 'cancelled')::int           AS all_cancelled,
      COALESCE(SUM(o.total) FILTER (WHERE o.order_status = 'cancelled'), 0)::int       AS all_cancelled_value
    FROM o CROSS JOIN b
  `) as {
    today_orders: number; today_revenue: number; today_uncollected: number; today_cancelled: number
    week_orders: number; week_revenue: number; week_uncollected: number
    all_orders: number; all_revenue: number; all_uncollected: number
    all_cancelled: number; all_cancelled_value: number
  }[]

  // "Pending" here means "placed but not concluded" — anything that hasn't
  // reached a terminal state (delivered or cancelled) yet, not just the
  // literal order_status = 'pending' row. An approved or shipped order is
  // still awaiting action from the operator's point of view.
  const [openCount] = await sql`
    SELECT COUNT(*)::int AS count FROM orders WHERE order_status NOT IN ('delivered', 'cancelled')
  `

  // Delivered but never marked paid: COD cash that should already be in hand.
  // This is the number that turns "revenue looks wrong" into a to-do list.
  const [awaitingCollection] = (await sql`
    SELECT COUNT(*)::int AS count, COALESCE(SUM(total), 0)::int AS value
    FROM orders
    WHERE order_status = 'delivered' AND payment_status = 'unpaid'
  `) as { count: number; value: number }[]

  const statusBreakdown = await sql`
    SELECT order_status, COUNT(*)::int AS count
    FROM orders
    GROUP BY order_status
  `

  // Two separate joins, not one: `orders` and `uncollected` are keyed on the
  // day an order was PLACED (created_at), `revenue` on the day it was PAID
  // (paid_at) — the same split as `totals` above, and for the same reason. An
  // order placed on one day and paid on another must be able to show up as an
  // order bar on the first day and a revenue point on the second.
  const daily = (await sql`
    WITH days AS (
      SELECT generate_series(
        (NOW() AT TIME ZONE 'Asia/Manila')::date - INTERVAL '6 days',
        (NOW() AT TIME ZONE 'Asia/Manila')::date,
        INTERVAL '1 day'
      )::date AS day
    ),
    by_order_day AS (
      SELECT
        (created_at AT TIME ZONE 'Asia/Manila')::date AS day,
        COUNT(*)::int AS orders,
        COALESCE(SUM(total) FILTER (WHERE payment_status = 'unpaid' AND order_status <> 'cancelled'), 0)::int AS uncollected
      FROM orders
      GROUP BY 1
    ),
    by_paid_day AS (
      SELECT
        (paid_at AT TIME ZONE 'Asia/Manila')::date AS day,
        COALESCE(SUM(total) FILTER (WHERE payment_status = 'paid' AND order_status <> 'cancelled'), 0)::int AS revenue
      FROM orders
      WHERE paid_at IS NOT NULL
      GROUP BY 1
    )
    SELECT
      TO_CHAR(d.day, 'Mon DD')          AS date,
      COALESCE(o.orders, 0)::int        AS orders,
      COALESCE(p.revenue, 0)::int       AS revenue,
      COALESCE(o.uncollected, 0)::int   AS uncollected
    FROM days d
    LEFT JOIN by_order_day o ON o.day = d.day
    LEFT JOIN by_paid_day p ON p.day = d.day
    ORDER BY d.day ASC
  `) as { date: string; orders: number; revenue: number; uncollected: number }[]

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
    today: {
      orders: totals.today_orders,
      revenue: totals.today_revenue,
      uncollected: totals.today_uncollected,
      cancelled: totals.today_cancelled,
    },
    week: {
      orders: totals.week_orders,
      revenue: totals.week_revenue,
      uncollected: totals.week_uncollected,
    },
    all: {
      orders: totals.all_orders,
      revenue: totals.all_revenue,
      uncollected: totals.all_uncollected,
      cancelled: totals.all_cancelled,
      cancelledValue: totals.all_cancelled_value,
    },
    pendingCount: openCount.count,
    awaitingCollection,
    statusBreakdown: statusBreakdown as { order_status: string; count: number }[],
    daily,
    recentOrders,
  }
}
