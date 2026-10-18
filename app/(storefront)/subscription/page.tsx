import { pageMeta } from '@/lib/seo'
import ManageSubscription from './ManageSubscription'

// Per-customer and reached only from an email, so there is nothing to rank;
// left out of the sitemap and disallowed in robots, like /cart and /order.
// no-referrer as a second belt: the token lives in the fragment, which no
// browser puts in a Referer anyway, but nothing on this page needs to tell the
// next site where the visitor came from.
export const metadata = {
  ...pageMeta({
    title: 'Your subscription',
    description: 'Pause, skip or cancel your weekly Aconchego delivery.',
    path: '/subscription',
    noindex: true,
  }),
  referrer: 'no-referrer' as const,
}

const serif = { fontFamily: 'var(--font-playfair), Georgia, serif' }

export default function SubscriptionPage() {
  return (
    <div className="min-h-screen bg-espresso-50">
      <div className="bg-espresso-900 py-14 px-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold text-espresso-50" style={serif}>Your subscription</h1>
          <p className="text-espresso-300 mt-3">Pause, skip a week or cancel — it takes effect straight away.</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <ManageSubscription />
      </div>
    </div>
  )
}
