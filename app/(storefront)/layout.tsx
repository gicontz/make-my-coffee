import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import ChatWidget from '@/components/ChatWidget'
import { CartProvider } from '@/context/CartContext'
import { BUSINESS_ADDRESS, CONTACT_EMAIL, CONTACT_PHONE, LEGAL_NAME } from '@/lib/business'
import { BLEND_ORIGIN } from '@/lib/seo'
import { siteUrl } from '@/lib/siteUrl'

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
  // Organization and WebSite data, on the storefront only — the backoffice is
  // not a public face of the business. Contact details come from env
  // (lib/business.ts), so nothing personal is committed to this public repo,
  // and an unset value simply drops out rather than emitting an empty field.
  const organizationLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: LEGAL_NAME,
    url: siteUrl(),
    logo: `${siteUrl()}/og-image.png`,
    description: `Bottled ${BLEND_ORIGIN} espresso shots delivered across Metro Manila and nearby provinces.`,
    ...(CONTACT_EMAIL || CONTACT_PHONE
      ? {
          contactPoint: {
            '@type': 'ContactPoint',
            contactType: 'customer service',
            ...(CONTACT_EMAIL ? { email: CONTACT_EMAIL } : {}),
            ...(CONTACT_PHONE ? { telephone: CONTACT_PHONE } : {}),
            areaServed: 'PH',
            availableLanguage: 'en',
          },
        }
      : {}),
    ...(BUSINESS_ADDRESS ? { address: { '@type': 'PostalAddress', streetAddress: BUSINESS_ADDRESS, addressCountry: 'PH' } } : {}),
  }

  return (
    <CartProvider>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd) }}
      />
      <Navbar />
      <main className="pt-16">{children}</main>
      <Footer />
      <ChatWidget />
    </CartProvider>
  )
}
