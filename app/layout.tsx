import type { Metadata } from 'next'
import { Playfair_Display, Work_Sans } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { CartProvider } from '@/context/CartContext'

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
      <body className="bg-espresso-50 text-espresso-900 antialiased" style={{ fontFamily: 'var(--font-work-sans), system-ui, sans-serif' }}>
        <CartProvider>
          <Navbar />
          <main className="pt-16">{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  )
}
