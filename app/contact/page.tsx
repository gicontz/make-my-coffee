import type { Metadata } from 'next'
import Link from 'next/link'
import { BUSINESS_ADDRESS, CONTACT_EMAIL, CONTACT_PHONE, DELIVERY_HOURS } from '@/lib/business'
import { FREE_SHIPPING_MIN_SUBTOTAL } from '@/lib/shipping'

export const metadata: Metadata = {
  title: 'Contact — Make My Coffee',
  description: 'Get in touch about an order, delivery, or anything else — Make My Coffee, Aconchego espresso shots.',
}

const serif = { fontFamily: 'var(--font-playfair), Georgia, serif' }

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-espresso-50">
      <div className="bg-espresso-900 py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-espresso-50" style={serif}>Get in touch</h1>
          <p className="text-espresso-300 mt-3 max-w-xl">
            Questions about an order, a delivery, or the coffee itself — we read everything that comes in.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
        {/* Chat first: it is the only channel that can answer immediately. */}
        <section className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-espresso-100">
          <h2 className="text-espresso-900 font-bold text-xl mb-2" style={serif}>Chat with us</h2>
          <p className="text-espresso-600 text-sm leading-relaxed">
            The quickest option. Tap the <strong>Chat with us</strong> button in the bottom-right corner of any
            page. It can tell you where your order is, how payment works and what we deliver where — and it will
            pass you to a person for anything it can&apos;t answer.
          </p>
          <p className="text-espresso-500 text-sm mt-3">
            To check an order you&apos;ll need your <strong>order number</strong> and the <strong>email address you
            ordered with</strong>. We ask for both so nobody else can look up your order.
          </p>
        </section>

        <section className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-espresso-100">
          <h2 className="text-espresso-900 font-bold text-xl mb-4" style={serif}>Email</h2>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-espresso-900 font-semibold underline underline-offset-4 decoration-espresso-300 hover:decoration-espresso-700 transition-colors break-all"
          >
            {CONTACT_EMAIL}
          </a>
          <p className="text-espresso-500 text-sm mt-3 leading-relaxed">
            Please include your order number if you have one. Replying to any email we&apos;ve sent you works too —
            it reaches the same place.
          </p>
          {CONTACT_PHONE && (
            <p className="text-espresso-600 text-sm mt-4">
              Phone: <a href={`tel:${CONTACT_PHONE.replace(/\s+/g, '')}`} className="font-semibold underline underline-offset-4">{CONTACT_PHONE}</a>
            </p>
          )}
        </section>

        <section className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-espresso-100">
          <h2 className="text-espresso-900 font-bold text-xl mb-4" style={serif}>Delivery &amp; payment</h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-espresso-700 font-semibold">Delivery hours</dt>
              <dd className="text-espresso-600">{DELIVERY_HOURS} — you choose your time windows at checkout.</dd>
            </div>
            <div>
              <dt className="text-espresso-700 font-semibold">Delivery fee</dt>
              {/* No figure quoted: it is priced per order from the pinned
                  dropoff, and a number here would be read as a promise. */}
              <dd className="text-espresso-600">
                Estimated from the exact location you pin at checkout, and shown before you pay. Free to Pasig City
                on orders of ₱{FREE_SHIPPING_MIN_SUBTOTAL.toLocaleString()} or more.
              </dd>
            </div>
            <div>
              <dt className="text-espresso-700 font-semibold">Payment</dt>
              <dd className="text-espresso-600">
                Cash on Delivery, or pay ahead by QR with GCash, Maya or GoTyme Bank. QR payments are confirmed by
                hand, so please send us a screenshot of your receipt with your order number.
              </dd>
            </div>
            {BUSINESS_ADDRESS && (
              <div>
                <dt className="text-espresso-700 font-semibold">Address</dt>
                <dd className="text-espresso-600">{BUSINESS_ADDRESS}</dd>
              </div>
            )}
          </dl>
        </section>

        <p className="text-espresso-500 text-sm">
          How we handle your details is set out in our{' '}
          <Link href="/privacy" className="font-semibold underline underline-offset-4">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  )
}
