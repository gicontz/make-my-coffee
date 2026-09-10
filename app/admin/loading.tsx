/**
 * Shown the instant an admin page is navigated to, while its server component
 * runs. Next renders this automatically — no route needs to opt in.
 *
 * Without it, navigating to a `force-dynamic` admin page showed the *previous*
 * page until the new one was fully ready. After signing in that meant the
 * login form sat there, apparently doing nothing, for as long as the dashboard
 * took to query. Nothing was broken; there was simply no evidence of progress.
 *
 * Shaped like the dashboard — a heading, a row of stat cards, a panel — so the
 * layout does not jump when the real content lands.
 */
export default function AdminLoading() {
  return (
    <div className="p-8" role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>

      <div className="mb-6">
        <div className="h-7 w-40 rounded-lg bg-espresso-100 animate-pulse" />
        <div className="h-4 w-64 rounded bg-espresso-100/70 animate-pulse mt-2.5" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-espresso-100 p-5">
            <div className="h-3 w-20 rounded bg-espresso-100 animate-pulse" />
            <div className="h-7 w-28 rounded-lg bg-espresso-100 animate-pulse mt-3" />
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-espresso-100 p-5 space-y-3">
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="flex items-center gap-4">
            <div className="h-4 w-10 rounded bg-espresso-100 animate-pulse" />
            <div className="h-4 flex-1 rounded bg-espresso-100/70 animate-pulse" />
            <div className="h-4 w-20 rounded bg-espresso-100 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
