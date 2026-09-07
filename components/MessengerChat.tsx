'use client'

import { usePathname } from 'next/navigation'

// Where the launcher must not appear.
//
// /order because a floating button sits exactly where the Place Order button
// is on a phone, and checkout is not the place to lose a tap. /admin because
// the backoffice is not a storefront.
function isHiddenPath(pathname: string | null): boolean {
  if (!pathname) return false
  return pathname.startsWith('/order') || pathname.startsWith('/admin')
}

/**
 * Opens a Messenger thread with the Page.
 *
 * This is an m.me link, not Meta's Chat Plugin — **the Chat Plugin was
 * discontinued on 9 May 2024** and no longer exists to embed. The remaining
 * supported ways to put Messenger on a website are an m.me link, a third-party
 * widget, or a hosted live-chat platform connected to the Page.
 *
 * An m.me link is the better trade anyway: no third-party script on a page
 * that already carries Leaflet and web fonts, no Facebook SDK, no domain
 * allowlisting step, and the button is ours to style rather than an iframe we
 * cannot theme. What we give up is the inline conversation — the customer
 * lands in Messenger itself, in the app if they have it.
 *
 * `NEXT_PUBLIC_FB_PAGE_ID` accepts the numeric Page ID or the Page username;
 * m.me resolves both. A username makes for a friendlier link.
 */
export default function MessengerChat() {
  const pageRef = process.env.NEXT_PUBLIC_FB_PAGE_ID
  const pathname = usePathname()

  if (!pageRef || isHiddenPath(pathname)) return null

  return (
    <a
      href={`https://m.me/${pageRef}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on Messenger"
      className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-espresso-900 hover:bg-espresso-700 text-espresso-50 shadow-lg transition-colors px-4 py-3 sm:px-5"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="flex-shrink-0">
        <path d="M12 2C6.24 2 2 6.22 2 11.78c0 2.9 1.2 5.42 3.16 7.16.16.15.26.35.27.57l.05 1.78c.02.57.6.94 1.12.71l1.99-.88a.79.79 0 0 1 .53-.04c.91.25 1.88.38 2.88.38 5.76 0 10-4.22 10-9.78S17.76 2 12 2Zm6 7.46-2.94 4.66c-.47.74-1.47.93-2.18.4l-2.34-1.75a.6.6 0 0 0-.72 0l-3.16 2.4c-.42.32-.97-.18-.69-.63l2.94-4.66c.47-.74 1.47-.93 2.18-.4l2.34 1.75a.6.6 0 0 0 .72 0l3.16-2.4c.42-.32.97.18.69.63Z" />
      </svg>
      {/* The label is the affordance; on a narrow screen the icon carries it
          alone and aria-label does the rest. */}
      <span className="hidden sm:inline text-sm font-bold">Chat with us</span>
    </a>
  )
}
