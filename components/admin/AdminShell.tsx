'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'

/**
 * The backoffice frame: a permanent sidebar from `lg` up, a drawer below it.
 *
 * Client-side only because the drawer needs open/closed state. The layout
 * itself stays a server component and hands off here, so nothing else in
 * /admin is pulled into the client bundle.
 */
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false)
  const pathname = usePathname()

  // The login page is full-bleed and has no business showing a nav rail to
  // someone who has not signed in yet.
  if (pathname?.startsWith('/admin/login')) return <>{children}</>

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />

      {/* Mobile top bar. Hidden from `lg`, where the rail is always visible. */}
      <header className="lg:hidden sticky top-0 z-20 flex items-center gap-3 bg-espresso-900 px-4 h-14">
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          aria-label="Open menu"
          aria-expanded={navOpen}
          className="-ml-1 p-2 text-espresso-300 hover:text-espresso-50 transition-colors"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <div className="min-w-0">
          <p className="text-espresso-400 text-[10px] font-semibold tracking-widest uppercase leading-none">Make My Coffee</p>
          <p className="text-espresso-100 text-sm font-bold leading-tight">Admin Panel</p>
        </div>
      </header>

      <div className="lg:ml-56 min-h-screen">{children}</div>
    </div>
  )
}
