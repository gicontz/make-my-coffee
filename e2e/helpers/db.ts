// Direct database access for the e2e suite: seeds the vouchers a spec needs,
// reads back what the app wrote, and cleans up after itself.
//
// Everything this file creates is tagged so cleanup can find it without
// touching anything else in the database: voucher codes start with E2E and
// customer emails end in @e2e.test.

import { neon } from '@neondatabase/serverless'
import dotenv from 'dotenv'
import fs from 'node:fs'

dotenv.config({ path: '.env.e2e' })

export const CODE_PREFIX = 'E2E'
export const EMAIL_DOMAIN = 'e2e.test'

function resolveDatabaseUrl(): string {
  const url = process.env.E2E_DATABASE_URL
  if (!url) {
    throw new Error(
      'E2E_DATABASE_URL is not set. Copy .env.e2e.example to .env.e2e and point it at a throwaway database (a Neon branch works well). The e2e suite creates and deletes orders and vouchers, so it must never run against the real shop.'
    )
  }

  // Hard stop against the developer's real database. The suite deletes rows
  // and asserts on exact redemption counts — pointed at production it would
  // corrupt live voucher state and inject fake orders.
  if (fs.existsSync('.env.local')) {
    const local = dotenv.parse(fs.readFileSync('.env.local'))
    if (local.DATABASE_URL && local.DATABASE_URL.trim() === url.trim()) {
      throw new Error(
        'E2E_DATABASE_URL is the same as DATABASE_URL in .env.local. Point the e2e suite at a separate throwaway database — it deletes rows and would corrupt live voucher state.'
      )
    }
  }

  return url
}

// Lazy, so importing this module (to list tests, or to type-check) doesn't
// require a database — the guard above fires on first actual use instead.
type Sql = ReturnType<typeof neon>
let client: Sql | null = null

export const sql: Sql = new Proxy((() => {}) as unknown as Sql, {
  apply: (_t, _this, args) => {
    client ??= neon(resolveDatabaseUrl())
    return (client as unknown as (...a: unknown[]) => unknown)(...args)
  },
  get: (_t, prop) => {
    client ??= neon(resolveDatabaseUrl())
    return (client as unknown as Record<string | symbol, unknown>)[prop]
  },
})

/* ── Schema ─────────────────────────────────────────────────────────────
   The project has no migration runner (decision.md D4), so the suite applies
   lib/db-setup.sql itself. Every statement in it is idempotent
   (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS), so a Neon branch of
   production and a blank database both end up correct. */
export async function ensureSchema(): Promise<void> {
  const ddl = fs.readFileSync('lib/db-setup.sql', 'utf8')
  // Strip comments, then split on the statement terminator. The file contains
  // no functions or dollar-quoted bodies, so a naive split is safe here.
  const statements = ddl
    .replace(/^\s*--.*$/gm, '')
    .split(';')
    .map(s => s.trim())
    .filter(Boolean)

  for (const statement of statements) {
    await sql.query(statement)
  }
}

/* ── Seeding ── */

export interface SeedVoucher {
  code: string
  discount_type?: 'percent' | 'fixed' | 'free_shipping'
  discount_value?: number
  max_discount?: number | null
  min_subtotal?: number
  max_redemptions?: number | null
  once_per_email?: boolean
  starts_at?: string | null
  expires_at?: string | null
  is_active?: boolean
  description?: string
}

export interface VoucherRow extends Required<Omit<SeedVoucher, 'code'>> {
  id: number
  code: string
  redemption_count: number
}

// Codes are unique, so a spec re-run must replace rather than collide.
export async function seedVoucher(v: SeedVoucher): Promise<VoucherRow> {
  if (!v.code.startsWith(CODE_PREFIX)) {
    throw new Error(`e2e voucher codes must start with ${CODE_PREFIX} so cleanup can find them (got ${v.code})`)
  }

  await sql`DELETE FROM vouchers WHERE code = ${v.code}`

  const rows = (await sql`
    INSERT INTO vouchers (
      code, description, discount_type, discount_value, max_discount,
      min_subtotal, max_redemptions, once_per_email, starts_at, expires_at, is_active
    ) VALUES (
      ${v.code}, ${v.description ?? 'e2e fixture'}, ${v.discount_type ?? 'percent'},
      ${v.discount_value ?? 10}, ${v.max_discount ?? null},
      ${v.min_subtotal ?? 0}, ${v.max_redemptions ?? null}, ${v.once_per_email ?? false},
      ${v.starts_at ?? null}, ${v.expires_at ?? null}, ${v.is_active ?? true}
    )
    RETURNING *
  `) as VoucherRow[]

  return rows[0]
}

export async function getVoucher(code: string): Promise<VoucherRow | null> {
  const rows = (await sql`SELECT * FROM vouchers WHERE code = ${code}`) as VoucherRow[]
  return rows[0] ?? null
}

export interface OrderRow {
  id: number
  email: string
  subtotal: number
  discount: number
  shipping: number
  total: number
  voucher_code: string
  voucher_id: number | null
  items: { id: string; name: string; price: number; quantity: number }[]
  order_status: string
  payment_status: string
  payment_method: string
  paid_at: string | null
}

// Inserts an order in a known state, for specs that assert on aggregates
// (dashboard stats) rather than on the checkout flow. `createdAt` is what makes
// the Asia/Manila day-boundary testable: pass an instant that is today in
// Manila but yesterday in UTC and the stats must still file it under today.
export interface SeedOrder {
  total: number
  order_status?: 'pending' | 'approved' | 'shipped' | 'delivered' | 'cancelled'
  payment_status?: 'unpaid' | 'paid'
  payment_method?: string
  createdAt?: Date | string
  // Only meaningful when payment_status is 'paid'. Defaults to createdAt (or
  // now, if createdAt is also unset) — mirrors the real PATCH handler, which
  // stamps paid_at the moment payment_status flips to 'paid'. Set explicitly
  // to seed an order paid on a different Manila day than it was placed.
  paidAt?: Date | string
  email?: string
}

export async function seedOrder(o: SeedOrder): Promise<number> {
  const email = o.email ?? uniqueEmail('stats')
  if (!email.endsWith('@' + EMAIL_DOMAIN)) {
    throw new Error(`e2e order emails must end in @${EMAIL_DOMAIN} so cleanup can find them (got ${email})`)
  }

  const items = JSON.stringify([{ id: '7-shot', name: 'Aconchego Classic', price: o.total, quantity: 1 }])
  const createdAt = o.createdAt ? new Date(o.createdAt).toISOString() : null
  const paidAt = o.payment_status === 'paid'
    ? new Date(o.paidAt ?? o.createdAt ?? Date.now()).toISOString()
    : null

  const rows = (await sql`
    INSERT INTO orders (
      first_name, last_name, email, items, subtotal, total,
      order_status, payment_status, payment_method, paid_at, created_at
    ) VALUES (
      'E2E', 'Fixture', ${email}, ${items}::jsonb, ${o.total}, ${o.total},
      ${o.order_status ?? 'pending'}, ${o.payment_status ?? 'unpaid'}, ${o.payment_method ?? 'cod'},
      ${paidAt}::timestamptz,
      COALESCE(${createdAt}::timestamptz, NOW())
    )
    RETURNING id
  `) as { id: number }[]

  return rows[0].id
}

export async function getOrder(id: number): Promise<OrderRow | null> {
  const rows = (await sql`SELECT * FROM orders WHERE id = ${id}`) as OrderRow[]
  return rows[0] ?? null
}

export async function countRedemptions(voucherId: number): Promise<number> {
  const rows = (await sql`
    SELECT COUNT(*)::int AS count FROM voucher_redemptions WHERE voucher_id = ${voucherId}
  `) as { count: number }[]
  return rows[0].count
}

/* ── Cleanup ── */

export async function cleanup(): Promise<void> {
  // Orders first: voucher_redemptions.order_id references them, and deleting a
  // voucher would otherwise leave redemption rows pointing at test orders.
  await sql`DELETE FROM orders WHERE email LIKE ${'%@' + EMAIL_DOMAIN}`
  await sql`DELETE FROM vouchers WHERE code LIKE ${CODE_PREFIX + '%'}`
}

// Unique per run so parallel branches or a re-run mid-flight can't collide.
export function uniqueEmail(tag: string): string {
  return `${tag}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}@${EMAIL_DOMAIN}`
}
