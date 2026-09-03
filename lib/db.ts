import { neon } from '@neondatabase/serverless'

// cache: 'no-store' is not optional. The Neon HTTP driver issues each query as
// a fetch(), and Next patches global fetch with its Data Cache — so query
// results were being cached and replayed. The admin dashboard served numbers
// frozen at the first request of the deployment: an order placed, cancelled or
// marked paid afterwards changed nothing on screen, and `export const dynamic
// = 'force-dynamic'` on the page does not help, because it governs route
// rendering, not the fetches the render performs. Verified by inserting a row
// and re-requesting /api/admin/stats: stale before this option, live after.
function connect() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  return neon(url, { fetchOptions: { cache: 'no-store' } })
}

// Lazy, behind a Proxy: connecting at module scope makes DATABASE_URL a
// *build-time* dependency, because `next build` imports every route module to
// collect its page data. A Preview deploy without the env var then fails the
// build ("Failed to collect page data for /api/admin/orders/[id]") instead of
// failing the request. Every route that touches the DB is force-dynamic, so
// the connection is only ever needed at request time. (Same pattern as
// e2e/helpers/db.ts. This has regressed before — re-check with a build that
// has DATABASE_URL unset before merging any change to this file.)
// Typed off connect(), not off `neon` itself: ReturnType<typeof neon> is the
// generic NeonQueryFunction<boolean, boolean>, whose result type is a union
// that callers can't index — every `rows[0]` in the app stops type-checking.
type Sql = ReturnType<typeof connect>
let client: Sql | null = null

export const sql: Sql = new Proxy((() => {}) as unknown as Sql, {
  apply: (_target, _thisArg, args) => {
    client ??= connect()
    return (client as unknown as (...a: unknown[]) => unknown)(...args)
  },
  get: (_target, prop) => {
    client ??= connect()
    return (client as unknown as Record<string | symbol, unknown>)[prop]
  },
})
