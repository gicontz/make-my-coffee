import type { Metadata } from 'next'
import { SITE_NAME, pageMeta } from '@/lib/seo'

// shop/page.tsx is a client component (cart interactions), and a client
// component cannot export metadata — hence this layout.
const base = pageMeta({
  title: 'Shop espresso shots',
  description:
    'Three sizes of bottled Aconchego espresso: 4 shots (₱299), 7 shots (₱449) and 10 shots (₱599). Each 30ml shot makes one drink at home.',
  path: '/shop',
})

// The template is restated here on purpose. This layout sits between the root
// and /shop/[id], and a product page's title came out bare ("Aconchego
// Classic") without it — verified in the built output, not assumed.
export const metadata: Metadata = {
  ...base,
  title: { default: 'Shop espresso shots', template: `%s — ${SITE_NAME}` },
}

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
