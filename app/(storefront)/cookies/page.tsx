import Link from 'next/link'
import { CONTACT_EMAIL, PRIVACY_UPDATED } from '@/lib/business'
import { CATEGORY_LABEL, TRACKERS, activeTrackerNames, categoriesInUse, hasTrackers } from '@/lib/analytics'
import CookieSettingsLink from '@/components/CookieSettingsLink'
import { OWN_STORAGE, THIRD_PARTY_STORAGE } from '@/lib/cookies'
import { pageMeta } from '@/lib/seo'

export const metadata = pageMeta({
  title: 'Cookie Policy',
  description:
    'Every cookie Make My Coffee sets, what it does and how long it lasts. Nothing is stored until you use the site, and no analytics cookie is set unless you accept.',
  path: '/cookies',
})

const serif = { fontFamily: 'var(--font-playfair), Georgia, serif' }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-espresso-100">
      <h2 className="text-espresso-900 font-bold text-xl mb-4" style={serif}>{title}</h2>
      <div className="space-y-3 text-sm text-espresso-600 leading-relaxed">{children}</div>
    </section>
  )
}

/**
 * Built from lib/cookies.ts, which is also what the code setting these reads.
 * The page cannot document a cookie the app no longer sets, or stay silent
 * about a new one — a cookie policy that has drifted reads as a statement of
 * fact and isn't one.
 *
 * The third-party section renders only for trackers this deployment actually
 * has ids for, the same way /privacy does.
 */
export default function CookiesPage() {
  const active = THIRD_PARTY_STORAGE.filter(g => TRACKERS[g.tracker])
  const categories = categoriesInUse()

  return (
    <div className="min-h-screen bg-espresso-50">
      <div className="bg-espresso-900 py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-espresso-50" style={serif}>Cookie Policy</h1>
          <p className="text-espresso-300 mt-3">Last updated {PRIVACY_UPDATED}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
        <Section title="The short version">
          <p>
            <strong className="text-espresso-800">We set nothing when you simply arrive.</strong> Open the site,
            read it, leave again, and not a single cookie is stored. Things only get saved once you do something
            that needs remembering — adding to your cart, starting a chat
            {hasTrackers() ? ', or answering the cookie banner' : ''}.
          </p>
          {hasTrackers() && (
            <p>
              {activeTrackerNames().join(' and ')} set cookies of their own, and they only run{' '}
              <strong className="text-espresso-800">after you allow the category they belong to</strong>. Reject
              them, or ignore the banner, and none of them are loaded. Everything on the site works the same
              either way.
            </p>
          )}
        </Section>

        <Section title="What we set ourselves">
          <p>All of these are functional — they make something work. None of them track you across other sites.</p>
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full text-sm border-collapse min-w-[34rem]">
              <thead>
                <tr className="text-left">
                  {['Name', 'What it does', 'Set when', 'Lasts'].map(h => (
                    <th key={h} className="text-espresso-500 text-[11px] uppercase tracking-wider font-bold pb-2 pr-4 border-b border-espresso-200">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {OWN_STORAGE.map(item => (
                  <tr key={item.name} className="align-top">
                    <td className="py-3 pr-4 border-b border-espresso-100">
                      <code className="text-espresso-900 text-xs">{item.name}</code>
                      <span className="block text-espresso-400 text-[11px] mt-0.5">
                        {item.kind === 'cookie' ? 'cookie' : 'browser storage'}
                      </span>
                    </td>
                    <td className="py-3 pr-4 border-b border-espresso-100 text-espresso-600">{item.purpose}</td>
                    <td className="py-3 pr-4 border-b border-espresso-100 text-espresso-600">{item.setWhen}</td>
                    <td className="py-3 border-b border-espresso-100 text-espresso-600 whitespace-nowrap">{item.life}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-espresso-500">
            Two of these are kept in your browser&apos;s own storage rather than as cookies. They are not sent with
            every request the way a cookie is, but they are still something stored on your device, so they are
            listed here.
          </p>
        </Section>

        {active.length > 0 && (
          <Section title="Set by others, only if you accept">
            <p>
              These are set by the companies named, not by us, and only once you have allowed the category they
              sit in. We never send them your name, email, phone number or delivery address.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              {categories.map(c => (
                <li key={c}>
                  <strong className="text-espresso-800">{CATEGORY_LABEL[c].title}</strong> — {CATEGORY_LABEL[c].blurb}
                </li>
              ))}
            </ul>
            {active.map(group => (
              <div key={group.tracker} className="pt-2">
                <p className="text-espresso-800 font-semibold">{group.provider}</p>
                <ul className="list-disc pl-5 space-y-1 mt-1">
                  {group.cookies.map(c => (
                    <li key={c.name}>
                      <code className="text-espresso-900 text-xs">{c.name}</code> — {c.purpose}. Lasts {c.life}.
                    </li>
                  ))}
                </ul>
                <p className="text-espresso-500 text-xs mt-1">
                  {group.provider} may set further cookies of their own without telling us —{' '}
                  <a href={group.policyUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                    their cookie policy
                  </a>{' '}
                  is the authority on those.
                </p>
              </div>
            ))}
          </Section>
        )}

        <Section title="Saying no, or changing your mind">
          {hasTrackers() && (
            <>
              <p>
                The banner appears on your first visit and offers{' '}
                <strong className="text-espresso-800">Reject all</strong> as plainly as it offers Accept — one button,
                same place, no extra screen to go through. Rejecting means none of the cookies in the previous table
                are ever set: nothing is loaded, so there is nothing to opt out of afterwards. Ignoring the banner
                counts as rejecting it.
              </p>
              <p>
                <strong className="text-espresso-800">Manage</strong> lets you answer each category on its own, so
                you can allow us to count visits without agreeing to advertising.
              </p>
              <p>
                Changing your answer later takes one click:{' '}
                <CookieSettingsLink className="text-espresso-900 font-semibold underline underline-offset-4" /> sits
                in the footer of every page and reopens the same panel. Turning something off stops it from loading
                on your next page view; cookies already set are deleted by clearing this site&apos;s data in your
                browser.
              </p>
            </>
          )}
          <p>
            You can also block or delete cookies in your browser settings. The functional ones in the first table are
            the only ones the site needs; blocking them means your cart and chat will not be remembered, but you can
            still browse and order.
          </p>
        </Section>

        <Section title="Questions">
          <p>
            Email{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-espresso-900 font-semibold underline underline-offset-4 break-all">
              {CONTACT_EMAIL}
            </a>
            . How we handle everything else is in our{' '}
            <Link href="/privacy" className="font-semibold underline underline-offset-4">Privacy Policy</Link>.
          </p>
        </Section>
      </div>
    </div>
  )
}
