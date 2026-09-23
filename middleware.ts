import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { COOKIE_NAME } from '@/lib/session'

async function createToken(username: string): Promise<string> {
  const secret = process.env.SESSION_SECRET || 'make-my-coffee-dev-secret'
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(`${username}:${secret}`))
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// Reachable without a session, by necessity: you cannot sign in if the
// sign-in endpoint demands a session, and signing out must work from a stale
// one.
const PUBLIC_ADMIN_PATHS = ['/admin/login', '/api/admin/login', '/api/admin/logout']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // `/api/admin/*` is guarded here as well as in each route handler.
  //
  // It was not, and the matcher below said `/admin/:path*` — pages only. The
  // admin *pages* redirected to a login while the APIs behind them answered
  // anyone: GET /api/admin/orders returned every customer's name, email,
  // phone, address and pinned coordinates to an unauthenticated request, and
  // PATCH /api/admin/orders/[id] let a stranger mark orders paid.
  //
  // Two layers now, deliberately. A route handler can be added without its
  // guard, and a matcher can be narrowed by someone who has not read this —
  // either alone is one edit away from reopening the hole.
  const isAdminPath = pathname.startsWith('/admin') || pathname.startsWith('/api/admin')

  if (isAdminPath && !PUBLIC_ADMIN_PATHS.some(p => pathname.startsWith(p))) {
    const isApi = pathname.startsWith('/api/')
    const cookie = request.cookies.get(COOKIE_NAME)

    const deny = () => {
      // An API answers 401; a page sends the person somewhere they can act.
      if (isApi) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      const res = NextResponse.redirect(new URL('/admin/login', request.url))
      res.cookies.delete(COOKIE_NAME)
      return res
    }

    if (!cookie?.value) return deny()

    const username = process.env.ADMIN_USERNAME || 'admin'
    const expected = await createToken(username)

    if (cookie.value !== expected) return deny()
  }

  return NextResponse.next()
}

export const config = {
  // Both, and keep them both. `/admin/:path*` does NOT cover `/api/admin/*`
  // — that gap is what exposed every customer's details.
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}
