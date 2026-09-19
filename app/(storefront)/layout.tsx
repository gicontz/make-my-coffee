import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import ChatWidget from '@/components/ChatWidget'
import { CartProvider } from '@/context/CartContext'

/**
 * The shop's chrome — navbar, footer, cart state, chat widget.
 *
 * A route group, so none of it reaches /admin. It used to live in the root
 * layout, which meant the backoffice rendered a storefront header complete
 * with a shopping-cart icon above its own sidebar: two competing navigations,
 * and on a phone they ate the screen between them before any content loaded.
 *
 * `(storefront)` is a grouping only — it changes no URLs. `/`, `/shop`,
 * `/cart`, `/order`, `/contact` and `/privacy` are exactly where they were.
 */
export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <Navbar />
      <main className="pt-16">{children}</main>
      <Footer />
      <ChatWidget />
    </CartProvider>
  )
}
