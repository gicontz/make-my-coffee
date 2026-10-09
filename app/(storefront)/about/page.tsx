import Link from 'next/link'
import { pageMeta, BLEND_ORIGIN } from '@/lib/seo'
import { FOUNDER_SIGNOFF, FOUNDER_STORY } from '@/lib/about'
import { MADE_TO_ORDER, REFRIGERATE, RETURNS, SHELF_LIFE, TRANSIT_STORAGE } from '@/lib/freshness'
import { deliveryHours, earliestDay, joinList } from '@/lib/faq'
import { MAX_DAYS_AHEAD } from '@/lib/deliveryDate'
import { SHOT_ML, pricePerShot, products } from '@/lib/products'
import { SOCIAL_PROFILES } from '@/lib/social'
import SocialLinks from '@/components/SocialLinks'

export const metadata = pageMeta({
  title: 'About us',
  description: `Aconchego is our ${BLEND_ORIGIN} espresso blend, brewed to order and bottled on the day it reaches you.`,
  path: '/about',
})

const serif = { fontFamily: 'var(--font-playfair), Georgia, serif' }

const link =
  'font-semibold text-espresso-900 underline underline-offset-4 decoration-espresso-300 hover:decoration-espresso-700'

/**
 * Who we are, what the blend is, and how made-to-order works.
 *
 * Every fact on this page is read from the module that owns it — the origin
 * from BLEND_ORIGIN, the delivery window from the checkout's own rules, the
 * freshness and returns copy verbatim from lib/freshness.ts — so it cannot
 * drift from what checkout and the product pages say. The freshness steps
 * keep TRANSIT_STORAGE, REFRIGERATE and SHELF_LIFE in one step on purpose:
 * each is only true alongside the others.
 *
 * The founder story renders only once lib/about.ts has one; see the warning
 * there.
 */
export default function AboutPage() {
  const sizes = joinList(products.map(p => String(p.shots)), 'or')
  const cheapestShot = Math.min(...products.map(pricePerShot))

  const steps = [
    {
      title: 'You pick the day',
      body:
        `At checkout you choose a delivery date — any day from ${earliestDay()} up to ${MAX_DAYS_AHEAD} days ahead — ` +
        `and the time windows that suit you, between ${deliveryHours()}.`,
    },
    { title: 'We brew it that day', body: MADE_TO_ORDER },
    { title: 'Straight to your fridge', body: `${TRANSIT_STORAGE} ${REFRIGERATE} ${SHELF_LIFE}` },
    { title: 'If anything is wrong', body: RETURNS },
  ]

  return (
    <div className="min-h-screen bg-espresso-50">
      <div className="bg-espresso-900 py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-espresso-50" style={serif}>About Make My Coffee</h1>
          <p className="text-espresso-300 mt-3 max-w-xl">
            Espresso shots in a bottle, brewed on the day they reach you — for making your own lattes and iced
            coffee at home, without a machine.
          </p>
          <SocialLinks variant="dark" className="mt-6" />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
        {FOUNDER_STORY && (
          <section className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-espresso-100">
            <h2 className="text-espresso-900 font-bold text-xl mb-3" style={serif}>Who makes it</h2>
            <div className="space-y-4 text-espresso-600 leading-relaxed">
              {FOUNDER_STORY.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
            {FOUNDER_SIGNOFF && <p className="text-espresso-800 font-semibold mt-4">— {FOUNDER_SIGNOFF}</p>}
          </section>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <section className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-espresso-100">
            <h2 className="text-espresso-900 font-bold text-xl mb-3" style={serif}>The name</h2>
            <p className="text-espresso-600 leading-relaxed">
              <em>Aconchego</em> is Portuguese for comfort — the warmth of being somewhere you are welcome. It is
              the name of our one and only blend.
            </p>
          </section>

          <section className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-espresso-100">
            <h2 className="text-espresso-900 font-bold text-xl mb-3" style={serif}>The blend</h2>
            {/* Proportions are deliberately undisclosed — never state or imply them. */}
            <p className="text-espresso-600 leading-relaxed">
              Aconchego is a blend of beans from {BLEND_ORIGIN}, not a single origin. The proportions are our own,
              and we keep them to ourselves.
            </p>
          </section>
        </div>

        <section className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-espresso-100">
          <h2 className="text-espresso-900 font-bold text-xl mb-3" style={serif}>Why a bottle of shots</h2>
          <p className="text-espresso-600 leading-relaxed">
            Every bottle holds ready-made {SHOT_ML}ml espresso shots — {sizes} to a bottle — and one shot makes
            one drink. Pour it over ice, stir it into warm milk, or drink it straight, from about ₱{cheapestShot} a
            shot. No machine, no pods, no barista: the café part is yours.
          </p>
        </section>

        <section className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-espresso-100">
          <h2 className="text-espresso-900 font-bold text-xl mb-6" style={serif}>How made to order works</h2>
          <ol className="space-y-6">
            {steps.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="flex-none w-8 h-8 rounded-full bg-espresso-900 text-espresso-100 text-sm font-bold flex items-center justify-center"
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-espresso-900 font-semibold mb-1">{step.title}</h3>
                  <p className="text-espresso-600 leading-relaxed">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {SOCIAL_PROFILES.length > 0 && (
          <section className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-espresso-100">
            <h2 className="text-espresso-900 font-bold text-xl mb-3" style={serif}>Follow along</h2>
            <p className="text-espresso-600 leading-relaxed mb-5">
              Find us on {joinList(SOCIAL_PROFILES.map(p => p.label), 'and')}.
            </p>
            <SocialLinks variant="light" />
          </section>
        )}

        <p className="text-espresso-600 text-sm pt-4">
          Ready for a bottle?{' '}
          <Link href="/shop" className={link}>See the bottles</Link>, or read the{' '}
          <Link href="/faq" className={link}>questions people ask first</Link>.
        </p>
      </div>
    </div>
  )
}
