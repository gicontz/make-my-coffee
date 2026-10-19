import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { productImage, productImageAlt } from '../images'
import SizeComparison from '@/components/SizeComparison'
import { pricePerShot, productById, products } from '@/lib/products'
import { PROVINCES } from '@/lib/phLocations'
import { FREE_SHIPPING_MIN_SUBTOTAL } from '@/lib/shipping'
import { BLEND_ORIGIN, jsonLd, pageMeta } from '@/lib/seo'
import { FRESHNESS_SUMMARY, RETURNS } from '@/lib/freshness'
import { siteUrl } from '@/lib/siteUrl'
import { productReviewLd, reviewMonth } from '@/lib/reviews'
import { approvedReviewsFor } from '@/lib/reviewStore'
import StarRating from '@/components/StarRating'
import AddToCart from './AddToCart'

const serif = { fontFamily: 'var(--font-playfair), Georgia, serif' }

// Three bottles, known at build time — so all three product pages are static.
export function generateStaticParams() {
  return products.map(p => ({ id: p.id }))
}

// Static, but with approved reviews on them: approving or rejecting one
// revalidates these pages straight away (app/api/admin/reviews/[id]). The
// hour is only a backstop — e.g. for a build that ran while the database was
// unreachable and so rendered no reviews.
export const revalidate = 3600

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
 * the delivery area from lib/phLocations.ts, freshness from lib/freshness.ts.
 *
 * Freshness and returns render whole from lib/freshness.ts rather than being
 * paraphrased here: the no-cold-chain line holds only in transit and the
 * 7-day window only refrigerated, so quoting half of either would publish a
 * claim the business cannot stand behind.
 */
export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = productById(params.id)
  if (!product) notFound()

  // Approved reviews from delivered orders that contained this bottle. None —
  // the usual case at first — renders no section and no rating markup at
  // all. Never fill the gap: see the hard rule in lib/reviews.ts.
  const { summary, shown } = await approvedReviewsFor(product.id)

  const perDrink = pricePerShot(product)
  const others = products.filter(p => p.id !== product.id)

  const productLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: `${siteUrl()}${productImage(product.id).src}`,
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
    // Adds no keys at all when there are no reviews.
    ...productReviewLd(summary, shown),
  }

  return (
    <div className="min-h-screen bg-espresso-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(productLd) }}
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
              src={productImage(product.id)}
              alt={productImageAlt(product)}
              sizes="320px"
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
                <dt className="text-espresso-800 font-semibold">How fresh it is, and keeping it</dt>
                {/* Rendered whole. The no-cold-chain line is only true in
                    transit and the 7 days only true refrigerated — split
                    them and a correct pair becomes a wrong claim. */}
                <dd className="text-espresso-600">{FRESHNESS_SUMMARY}</dd>
              </div>
              <div>
                <dt className="text-espresso-800 font-semibold">How to pay</dt>
                <dd className="text-espresso-600">
                  Cash on delivery, or scan a GCash, Maya or GoTyme QR at checkout.
                </dd>
              </div>
              <div>
                <dt className="text-espresso-800 font-semibold">If something is wrong</dt>
                <dd className="text-espresso-600">{RETURNS}</dd>
              </div>
            </dl>
          </div>
        </div>

        {summary && shown.length > 0 && (
          <section className="mt-16" aria-labelledby="reviews-heading">
            <div className="flex flex-wrap items-baseline justify-between gap-3 mb-6">
              <h2 id="reviews-heading" className="text-espresso-900 text-2xl font-bold" style={serif}>
                What customers say
              </h2>
              <p className="flex items-center gap-2 text-espresso-700 text-sm">
                <StarRating rating={summary.average} />
                <span>
                  <strong className="text-espresso-900">{summary.average.toFixed(1)}</strong> out of 5 ·{' '}
                  {summary.count} {summary.count === 1 ? 'review' : 'reviews'}
                </span>
              </p>
            </div>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {shown.map(review => (
                <li key={review.id} className="bg-white rounded-2xl border border-espresso-100 p-6">
                  <StarRating rating={review.rating} size={14} />
                  {/* Plain text in a pre-line block: React escapes it, and the
                      customer's own line breaks survive. */}
                  <p className="text-espresso-700 text-sm leading-relaxed mt-3 whitespace-pre-line break-words">{review.body}</p>
                  <p className="text-espresso-500 text-xs mt-4">
                    <span className="text-espresso-800 font-semibold">{review.display_name}</span>
                    {' · '}Verified order · {reviewMonth(review.created_at)}
                  </p>
                </li>
              ))}
            </ul>
            {summary.count > shown.length && (
              <p className="text-espresso-500 text-xs mt-4">Showing the {shown.length} most recent.</p>
            )}
          </section>
        )}

        <div className="mt-16 bg-white rounded-2xl border border-espresso-100 px-6 py-8">
          <h2 className="text-espresso-900 text-2xl font-bold mb-6 text-center" style={serif}>How the sizes compare</h2>
          <SizeComparison current={product.id} />
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
                  <Image src={productImage(other.id)} alt="" fill sizes="64px" className="object-contain p-1" />
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
