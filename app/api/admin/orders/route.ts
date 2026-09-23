import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { isAdminAuthenticated } from '@/lib/session'

// This route reads request.url (the ?status= filter) and lists live orders, so
// it can never be prerendered. Without this, `next build` tries to render it
// statically, Next throws DYNAMIC_SERVER_USAGE to bail out — and the try/catch
// below swallows that bailout into a 500, which surfaces as an error in the
// Vercel deployment log rather than as the "this route is dynamic" signal it
// actually is. The other admin GET routes already declare this.
export const dynamic = 'force-dynamic'

// Every query below re-selects delivery_date cast to text. The neon driver
// parses a DATE into a JS Date at the *machine's* local midnight, so
// 2026-09-23 arrives as 2026-09-22T16:00:00Z in Manila and 2026-09-23T00:00:00Z
// on Vercel. Serialised to JSON, the first of those reads back as the wrong
// day — a bug that would only appear in one environment. Asking Postgres for
// the text keeps every zone out of it.

export async function GET(request: NextRequest) {
  // Guarded here as well as in middleware.ts. The middleware matcher missed
  // `/api/admin/*` entirely once, and this endpoint answered every customer's
  // name, email, phone and address to anyone who asked. One layer is one edit
  // away from doing it again.
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const rows = status && status !== 'all'
      ? await sql`
          SELECT *, delivery_date::text AS delivery_date FROM orders
          WHERE order_status = ${status}
          ORDER BY created_at DESC
        `
      : await sql`SELECT *, delivery_date::text AS delivery_date FROM orders ORDER BY created_at DESC`

    return NextResponse.json(rows)
  } catch (err) {
    console.error('GET /api/admin/orders error:', err)
    return NextResponse.json({ error: 'Failed to load orders' }, { status: 500 })
  }
}
