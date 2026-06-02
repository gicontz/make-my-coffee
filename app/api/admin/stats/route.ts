import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET() {
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

  const [pendingCount] = await sql`
    SELECT COUNT(*)::int AS count FROM orders WHERE order_status = 'pending'
  `

  const statusBreakdown = await sql`
    SELECT order_status, COUNT(*)::int AS count
    FROM orders
    GROUP BY order_status
  `

  const daily = await sql`
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
  `

  const recentOrders = await sql`
    SELECT id, first_name, last_name, city, total, order_status, payment_status, created_at
    FROM orders
    ORDER BY created_at DESC
    LIMIT 5
  `

  return NextResponse.json({
    today: { orders: todayStats.orders, revenue: todayStats.revenue },
    week: { orders: weekStats.orders, revenue: weekStats.revenue },
    all: { orders: allStats.orders, revenue: allStats.revenue },
    pendingCount: pendingCount.count,
    statusBreakdown,
    daily,
    recentOrders,
  })
}
