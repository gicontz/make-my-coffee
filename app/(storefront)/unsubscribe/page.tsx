import { pageMeta } from '@/lib/seo'
import UnsubscribeForm from './UnsubscribeForm'

// Where the footer link in every marketing email lands (#39). noindex and out
// of the sitemap: it is one person's link, with nothing on it to rank.
export const metadata = pageMeta({
  title: 'Unsubscribe',
  description: 'Stop marketing emails from Make My Coffee.',
  path: '/unsubscribe',
  noindex: true,
})

export default function UnsubscribePage({ searchParams }: { searchParams: { token?: string | string[] } }) {
  const token = typeof searchParams.token === 'string' ? searchParams.token : ''
  return (
    <div className="min-h-[80vh] bg-espresso-50 px-4 pt-28 sm:pt-36 pb-24">
      <div className="bg-white rounded-2xl border border-espresso-100 shadow-sm p-6 sm:p-8 max-w-md mx-auto">
        <UnsubscribeForm token={token} />
      </div>
    </div>
  )
}
