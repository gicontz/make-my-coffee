import { pageMeta } from '@/lib/seo'

// noindex: a cart is per-visitor and holds nothing anyone could search for.
// Still `follow`, so the links out of it keep passing signal.
export const metadata = pageMeta({
  title: 'Your cart',
  description: 'Review your Make My Coffee order before checkout.',
  path: '/cart',
  noindex: true,
})

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
