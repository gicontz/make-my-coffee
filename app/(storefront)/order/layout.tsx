import { pageMeta } from '@/lib/seo'

// noindex, same reasoning as the cart — and a checkout form carries a
// customer's details, which has no business in a search index.
export const metadata = pageMeta({
  title: 'Checkout',
  description: 'Choose your delivery date, time window and payment method.',
  path: '/order',
  noindex: true,
})

export default function OrderLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
