import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET(request: NextRequest) {
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
}
