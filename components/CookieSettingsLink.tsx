'use client'

import { OPEN_COOKIE_SETTINGS_EVENT, hasTrackers } from '@/lib/analytics'

/**
 * Reopens the cookie settings panel from the footer.
 *
 * A consent notice you can answer exactly once, with no way back, isn't really
 * a choice — and "clear your browser data" is not a withdrawal mechanism any
 * customer will use. This is the way back, on every page.
 *
 * Hidden when the deployment has no trackers configured: there would be
 * nothing but the locked "strictly necessary" row to show.
 */
export default function CookieSettingsLink({ className }: { className?: string }) {
  if (!hasTrackers()) return null

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT))}
      className={className}
    >
      Cookie settings
    </button>
  )
}
