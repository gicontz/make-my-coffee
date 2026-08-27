import { neon, type NeonQueryFunction } from '@neondatabase/serverless'

// Match the type the original `neon(url)` call produced (arrayMode=false,
// fullResults=false) so `sql`...`` still returns Record<string, any>[] rows.
type Sql = NeonQueryFunction<false, false>

let cached: Sql | undefined

// Initialize the Neon client lazily. Doing it at module-import time meant
// `next build` (which evaluates route modules during static generation)
// required DATABASE_URL to be present at build, so any environment without
// the secret set — e.g. Vercel Preview — failed the build. Deferring the
// check to first query keeps the build free of runtime secrets; the error
// still surfaces (clearly) the moment a query actually runs without a URL.
function getSql(): Sql {
  if (!cached) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is not set')
    cached = neon(url)
  }
  return cached
}

// A Proxy forwards both tagged-template calls (sql`...`) and property access
// (sql.query, sql.transaction, ...) to the lazily-created client, so call
// sites keep using `sql` exactly as before.
export const sql: Sql = new Proxy(function () {} as unknown as Sql, {
  apply(_target, _thisArg, args: unknown[]) {
    return (getSql() as unknown as (...a: unknown[]) => unknown)(...args)
  },
  get(_target, prop) {
    return (getSql() as unknown as Record<string | symbol, unknown>)[prop]
  },
})
