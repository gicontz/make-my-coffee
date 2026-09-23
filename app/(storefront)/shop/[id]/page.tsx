import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import bottleImg from '@/app/assets/bottle.png'
import { pricePerShot, productById, products } from '@/lib/products'
import { PROVINCES } from '@/lib/phLocations'
import { FREE_SHIPPING_MIN_SUBTOTAL } from '@/lib/shipping'
import { BLEND_ORIGIN, pageMeta } from '@/lib/seo'
import { siteUrl } from '@/lib/siteUrl'
import AddToCart from './AddToCart'

const serif = { fontFamily: 'var(--font-playfair), Georgia, serif' }

// Three bottles, known at build time — so all three product pages are static.
export function generateStaticParams() {
  return products.map(p => ({ id: p.id }))
}

export function generateMetadata({ params }: { params: { id: string } }) {
  const product = productById(params.id)
  if (!product) return {}

  return pageMeta({
    title: product.name,
    description:
      `${product.shots} × 30ml ${BLEND_ORIGIN} espresso shots in a ${product.volume} bottle, ₱${product.price}. ` +
      `About ₱${pricePerShot(product)} per drink — pour over ice or milk, no machine needed.`,
    path: `/shop/${product.id}`,
  })
}

/**
 * One page per bottle.
 *
 * "View Details" used to point back at /shop, so there was no URL for a
 * specific bottle to rank, appear as a rich result, or be linked to. Each
 * bottle now has its own page carrying Product structured data.
 *
 * Every claim here is read from code — price and shots from lib/products.ts,
 * the delivery area from lib/phLocations.ts. Nothing about shelf life,
 * storage or returns appears, because none of it is recorded anywhere and a
 * guess about how long a perishable keeps is not a guess worth making.
 */
export default function ProductPage({ params }: { params: { id: string } }) {
  const product = productById(params.id)
  if (!product) notFound()

  const perDrink = pricePerShot(product)
  const others = products.filter(p => p.id !== product.id)

  const productLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: `${siteUrl()}/og-image.png`,
    brand: { '@type': 'Brand', name: 'Aconchego' },
    category: 'Coffee',
    offers: {
      '@type': 'Offer',
      url: `${siteUrl()}/shop/${product.id}`,
      priceCurrency: 'PHP',
      price: product.price,
      // There is no inventory tracking; bottles are made to order, so a
      // bottle on the site is one we will make.
      availability: 'https://schema.org/InStock',
      seller: { '@type': 'Organization', name: 'Make My Coffee' },
    },
  }

  return (
    <div className="min-h-screen bg-espresso-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productLd) }}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center gap-2 text-espresso-400 text-sm mb-8">
          <Link href="/shop" className="hover:text-espresso-700 transition-colors">Shop</Link>
          <span>›</span>
          <span className="text-espresso-700">{product.name}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="bg-white rounded-2xl border border-espresso-100 p-8 flex items-center justify-center relative">
            {product.badge && (
              <span className="absolute top-5 left-5 bg-espresso-400 text-espresso-900 text-xs font-bold px-3 py-1 rounded-full">
                {product.badge}
              </span>
            )}
            <Image
              src={bottleImg}
              alt={`${product.name} — a ${product.volume} bottle holding ${product.shots} espresso shots`}
              className="w-full max-w-xs h-auto object-contain"
              priority
            />
          </div>

          <div>
            <h1 className="text-espresso-900 text-4xl font-bold mb-3" style={serif}>{product.name}</h1>
            <p className="text-espresso-600 leading-relaxed mb-6">{product.description}</p>

            <div className="flex items-baseline gap-3 mb-1">
              <span className="text-espresso-900 text-4xl font-bold">₱{product.price.toLocaleString()}</span>
              <span className="text-espresso-500 text-sm">{product.shots} shots · {product.volume}</span>
            </div>
            {/* The plan's sharpest hook, and it costs nothing to state
                honestly: the figure is the bottle divided by its shots. */}
            <p className="text-espresso-700 text-sm font-semibold mb-8">
              About ₱{perDrink} a drink — add your own milk or ice.
            </p>

            <AddToCart product={product} />

            <dl className="mt-10 space-y-4 text-sm border-t border-espresso-200 pt-8">
              <div>
                <dt className="text-espresso-800 font-semibold">Where we deliver</dt>
                <dd className="text-espresso-600">{PROVINCES.join(', ')}.</dd>
              </div>
              <div>
                <dt className="text-espresso-800 font-semibold">When it arrives</dt>
                <dd className="text-espresso-600">
                  You pick the date and time windows at checkout — earliest is the next day, and we deliver
                  between 9:00 AM and 7:00 PM.
                </dd>
              </div>
              <div>
                <dt className="text-espresso-800 font-semibold">Delivery fee</dt>
                <dd className="text-espresso-600">
                  Worked out from the exact spot you pin at checkout and shown before you pay. Free to Pasig City
                  on orders of ₱{FREE_SHIPPING_MIN_SUBTOTAL.toLocaleString()} or more.
                </dd>
              </div>
              <div>
                <dt className="text-espresso-800 font-semibold">How to pay</dt>
                <dd className="text-espresso-600">
                  Cash on delivery, or scan a GCash, Maya or GoTyme QR at checkout.
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="mt-16">
          <h2 className="text-espresso-900 text-2xl font-bold mb-6" style={serif}>Other sizes</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {others.map(other => (
              <Link
                key={other.id}
                href={`/shop/${other.id}`}
                className="flex items-center gap-4 bg-white rounded-2xl border border-espresso-100 hover:border-espresso-400 p-5 transition-colors"
              >
                <div className="w-16 h-16 bg-espresso-50 rounded-xl flex-shrink-0 relative">
                  <Image src={bottleImg} alt="" fill className="object-contain p-2" />
                </div>
                <div className="min-w-0">
                  <p className="text-espresso-900 font-bold">{other.name}</p>
                  <p className="text-espresso-500 text-sm">
                    {other.shots} shots · ₱{other.price.toLocaleString()} · about ₱{pricePerShot(other)} a drink
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
