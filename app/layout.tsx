import type { Metadata } from 'next'
import { Playfair_Display, Work_Sans } from 'next/font/google'
import './globals.css'
import { BLEND_ORIGIN, SITE_NAME } from '@/lib/seo'
import { siteUrl } from '@/lib/siteUrl'

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
})

const workSans = Work_Sans({
  subsets: ['latin'],
  variable: '--font-work-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  // `%s` is filled by each page's own title; pages that want the bare form
  // set `absolute`. Before this every page shared one title and one
  // description, so Google had nothing to tell them apart.
  title: {
    default: `${SITE_NAME} — Bottled espresso shots, delivered`,
    template: `%s — ${SITE_NAME}`,
  },
  // The blend is Cambodia & Indonesia. This said "Brazilian" until now, which
  // contradicted the page it described — a bad snippet and, on a food product,
  // a labelling problem. BLEND_ORIGIN is the single source.
  description: `Bottled ${BLEND_ORIGIN} espresso shots for lattes, iced coffee and tonics at home. No machine needed. Delivered across Metro Manila and nearby provinces.`,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${workSans.variable}`}>
      {/* Nothing but the document shell lives here. The shop's navbar, footer,
          cart and chat widget belong to the (storefront) route group; /admin
          brings its own chrome and should inherit none of it. */}
      <body className="bg-espresso-50 text-espresso-900 antialiased" style={{ fontFamily: 'var(--font-work-sans), system-ui, sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
