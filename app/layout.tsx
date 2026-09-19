import type { Metadata } from 'next'
import { Playfair_Display, Work_Sans } from 'next/font/google'
import './globals.css'

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
  title: 'Make My Coffee — Pure Espresso Shots',
  description:
    'Pure Brazilian Aconchego espresso shots, bottled for your custom coffee creations. Choose 4, 7, or 10 shot bottles.',
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
