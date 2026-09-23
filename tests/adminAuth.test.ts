// Every admin API must refuse an unauthenticated request.
//
// This is a regression test for a live exposure: `middleware.ts` matched
// `/admin/:path*`, which covers pages and NOT `/api/admin/*`. The admin pages
// redirected to a login while the APIs behind them answered anyone —
// `GET /api/admin/orders` returned every customer's name, email, phone,
// address and pinned coordinates to an anonymous request on the public site,
// and `PATCH /api/admin/orders/[id]` let a stranger mark orders paid.
//
// It is a source test rather than an HTTP one on purpose. The e2e suite needs
// a throwaway Neon branch and credentials, so it does not run on every change;
// this does, and the failure it guards against is a route file being added
// without its guard — which is exactly a source-level mistake.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ADMIN_API_DIR = fileURLToPath(new URL('../app/api/admin', import.meta.url))

/**
 * Reachable without a session by necessity: you cannot sign in if the sign-in
 * endpoint demands a session, and signing out must work from a stale one.
 * Anything else added here needs a reason written next to it.
 */
const PUBLIC_BY_DESIGN = new Set(['login', 'logout'])

function routeFiles(dir: string, trail: string[] = []): { path: string; route: string }[] {
  return readdirSync(dir).flatMap(entry => {
    const full = `${dir}/${entry}`
    if (statSync(full).isDirectory()) return routeFiles(full, [...trail, entry])
    return entry === 'route.ts' ? [{ path: full, route: `/api/admin/${trail.join('/')}` }] : []
  })
}

test('every admin API route asserts the session itself', () => {
  const routes = routeFiles(ADMIN_API_DIR)
  assert.ok(routes.length >= 7, `expected to find the admin routes, found ${routes.length}`)

  const unguarded = routes
    .filter(r => !PUBLIC_BY_DESIGN.has(r.route.split('/').pop() ?? ''))
    .filter(r => !readFileSync(r.path, 'utf8').includes('isAdminAuthenticated'))
    .map(r => r.route)

  assert.deepEqual(
    unguarded,
    [],
    `these admin APIs would answer an anonymous request:\n  ${unguarded.join('\n  ')}\n` +
      'Add `if (!(await isAdminAuthenticated())) return 401` to each. Do not rely on ' +
      'middleware.ts alone — its matcher missed /api/admin once already.'
  )
})

test('the middleware matcher still covers the admin APIs', () => {
  // The per-route guards above are the real protection; this is the second
  // layer. Losing it silently is how the first hole opened.
  const middleware = readFileSync(fileURLToPath(new URL('../middleware.ts', import.meta.url)), 'utf8')
  assert.match(middleware, /'\/api\/admin\/:path\*'/, 'middleware.ts must match /api/admin/:path*')
  assert.match(middleware, /'\/admin\/:path\*'/, 'middleware.ts must still match /admin/:path*')
})

test('login and logout stay reachable without a session', () => {
  // Guarding these would lock everyone out of the backoffice permanently.
  for (const route of ['login', 'logout']) {
    const source = readFileSync(`${ADMIN_API_DIR}/${route}/route.ts`, 'utf8')
    assert.ok(
      !source.includes('isAdminAuthenticated'),
      `/api/admin/${route} must not require a session — nobody could ever sign in`
    )
  }
})
