import Link from 'next/link'
import { faqs } from '@/lib/faq'
import { pageMeta } from '@/lib/seo'

export const metadata = pageMeta({
  title: 'Questions & answers',
  description:
    'Do you need an espresso machine, how long the coffee keeps, where we deliver and how to pay — answered.',
  path: '/faq',
})

const serif = { fontFamily: 'var(--font-playfair), Georgia, serif' }

/**
 * The FAQ, with FAQPage structured data.
 *
 * Every answer comes from lib/faq.ts, which builds it from the module that
 * owns the fact — this page adds layout and nothing else. The JSON-LD is fed
 * the same strings the page renders, because structured data that says more
 * than the visible page is exactly what search engines penalise.
 */
export default function FaqPage() {
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  }

  return (
    <div className="min-h-screen bg-espresso-50">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />

      <div className="bg-espresso-900 py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-espresso-50" style={serif}>Questions &amp; answers</h1>
          <p className="text-espresso-300 mt-3 max-w-xl">
            The things people ask before their first bottle. Anything else, the chat in the corner is the quickest
            way to reach us.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <nav aria-label="Questions" className="mb-10">
          <ul className="flex flex-wrap gap-2">
            {faqs.map(f => (
              <li key={f.id}>
                <a
                  href={`#${f.id}`}
                  className="inline-block bg-white border border-espresso-200 hover:border-espresso-400 text-espresso-700 text-sm px-3 py-1.5 rounded-full transition-colors"
                >
                  {f.question}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-4">
          {faqs.map(f => (
            <section
              key={f.id}
              id={f.id}
              className="scroll-mt-24 bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-espresso-100"
            >
              <h2 className="text-espresso-900 font-bold text-xl mb-3" style={serif}>{f.question}</h2>
              <p className="text-espresso-600 leading-relaxed">{f.answer}</p>
            </section>
          ))}
        </div>

        <p className="text-espresso-600 text-sm mt-10">
          Still wondering about something?{' '}
          <Link href="/contact" className="font-semibold text-espresso-900 underline underline-offset-4 decoration-espresso-300 hover:decoration-espresso-700">
            Get in touch
          </Link>{' '}
          or{' '}
          <Link href="/shop" className="font-semibold text-espresso-900 underline underline-offset-4 decoration-espresso-300 hover:decoration-espresso-700">
            see the bottles
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
