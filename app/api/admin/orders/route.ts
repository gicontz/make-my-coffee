import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

// This route reads request.url (the ?status= filter) and lists live orders, so
// it can never be prerendered. Without this, `next build` tries to render it
// statically, Next throws DYNAMIC_SERVER_USAGE to bail out — and the try/catch
// below swallows that bailout into a 500, which surfaces as an error in the
// Vercel deployment log rather than as the "this route is dynamic" signal it
// actually is. The other admin GET routes already declare this.
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const rows = status && status !== 'all'
      ? await sql`
          SELECT * FROM orders
          WHERE order_status = ${status}
          ORDER BY created_at DESC
        `
      : await sql`SELECT * FROM orders ORDER BY created_at DESC`

    return NextResponse.json(rows)
  } catch (err) {
    console.error('GET /api/admin/orders error:', err)
    return NextResponse.json({ error: 'Failed to load orders' }, { status: 500 })
  }
}
