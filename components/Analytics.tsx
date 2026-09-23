'use client'

import { useCallback, useEffect, useState } from 'react'
import Script from 'next/script'
import Link from 'next/link'
import {
  ALL_OFF,
  ALL_ON,
  CATEGORY_LABEL,
  OPEN_COOKIE_SETTINGS_EVENT,
  TRACKERS,
  categoriesInUse,
  hasTrackers,
  readConsent,
  writeConsent,
  type ConsentCategory,
  type ConsentState,
} from '@/lib/analytics'

/**
 * Cookie consent by category, and the trackers it gates.
 *
 * Nothing is fetched, no cookie of theirs is written and no pixel fires until
 * the matching category is allowed — the scripts are rendered conditionally
 * rather than loaded-and-disabled. Someone who refuses, or never answers, is
 * never touched by any of them.
 */
export default function Analytics() {
  const [consent, setConsent] = useState<ConsentState | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  // Consent lives in localStorage, which the server cannot see. The first
  // render must match the server's — no banner, no scripts — with the real
  // state arriving after mount, or hydration mismatches.
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setConsent(readConsent())
    setReady(true)
  }, [])

  useEffect(() => {
    const open = () => setPanelOpen(true)
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, open)
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, open)
  }, [])

  const decide = useCallback((state: ConsentState) => {
    writeConsent(state)
    setConsent(state)
    setPanelOpen(false)
  }, [])

  if (!hasTrackers() || !ready) return null

  const categories = categoriesInUse()
  const undecided = consent === null

  return (
    <>
      {consent?.analytics && TRACKERS.ga4 && <GoogleAnalytics id={TRACKERS.ga4} />}
      {consent?.marketing && TRACKERS.metaPixel && <MetaPixel id={TRACKERS.metaPixel} />}
      {consent?.marketing && TRACKERS.tiktokPixel && <TikTokPixel id={TRACKERS.tiktokPixel} />}

      {panelOpen ? (
        <PreferencesPanel
          categories={categories}
          initial={consent ?? ALL_OFF}
          onSave={decide}
          onClose={() => setPanelOpen(false)}
          dismissible={!undecided}
        />
      ) : (
        undecided && (
          <Banner
            categories={categories}
            onAcceptAll={() => decide(ALL_ON)}
            onRejectAll={() => decide(ALL_OFF)}
            onManage={() => setPanelOpen(true)}
          />
        )
      )}
    </>
  )
}

function Banner({
  categories,
  onAcceptAll,
  onRejectAll,
  onManage,
}: {
  categories: ConsentCategory[]
  onAcceptAll: () => void
  onRejectAll: () => void
  onManage: () => void
}) {
  return (
    <div
      role="dialog"
      aria-label="Cookie choices"
      className="fixed bottom-0 inset-x-0 z-[60] bg-espresso-900 text-espresso-200 border-t border-espresso-800"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex flex-col lg:flex-row lg:items-center gap-4">
        <p className="text-sm leading-relaxed flex-1">
          We use cookies to make the site work, and — only if you agree —{' '}
          {categories.map(c => CATEGORY_LABEL[c].title.toLowerCase()).join(' and ')} cookies. Nothing optional
          loads unless you say so, and ordering works either way.{' '}
          <Link href="/cookies" className="underline underline-offset-2 hover:text-espresso-50">
            Which cookies, and for how long
          </Link>
          .
        </p>
        {/* Reject is as reachable and as prominent as accept. A decline buried
            behind a "manage" screen is not a free choice. */}
        <div className="grid grid-cols-2 sm:flex gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onManage}
            className="col-span-2 sm:col-auto px-4 py-2.5 rounded-full text-sm font-bold text-espresso-300 hover:text-espresso-50 underline underline-offset-4 sm:no-underline transition-colors order-last sm:order-first"
          >
            Manage
          </button>
          <button
            type="button"
            onClick={onRejectAll}
            className="px-5 py-2.5 rounded-full text-sm font-bold border border-espresso-700 text-espresso-200 hover:border-espresso-500 transition-colors"
          >
            Reject all
          </button>
          <button
            type="button"
            onClick={onAcceptAll}
            className="px-5 py-2.5 rounded-full text-sm font-bold bg-espresso-400 text-espresso-900 hover:bg-espresso-300 transition-colors"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  )
}

function PreferencesPanel({
  categories,
  initial,
  onSave,
  onClose,
  dismissible,
}: {
  categories: ConsentCategory[]
  initial: ConsentState
  onSave: (s: ConsentState) => void
  onClose: () => void
  dismissible: boolean
}) {
  const [draft, setDraft] = useState<ConsentState>(initial)

  useEffect(() => {
    if (!dismissible) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [dismissible, onClose])

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div aria-hidden="true" onClick={dismissible ? onClose : undefined} className="absolute inset-0 bg-espresso-900/60" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cookie settings"
        className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-espresso-200 max-h-[85vh] overflow-y-auto"
      >
        <div className="p-6 sm:p-7">
          <h2 className="text-espresso-900 font-bold text-xl mb-1" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
            Cookie settings
          </h2>
          <p className="text-espresso-500 text-sm mb-6">
            Choose what we may use.{' '}
            <Link href="/cookies" className="underline underline-offset-2 hover:text-espresso-800">
              See the full list
            </Link>
            .
          </p>

          {/* Shown and locked. A toggle that cannot be moved is honest only if
              it is labelled as such. */}
          <div className="flex items-start gap-4 py-4 border-t border-espresso-100">
            <div className="flex-1 min-w-0">
              <p className="text-espresso-900 font-semibold text-sm">Strictly necessary</p>
              <p className="text-espresso-500 text-sm mt-0.5">
                Your cart, your chat conversation and this choice itself. The site cannot work without them.
              </p>
            </div>
            <span className="flex-shrink-0 mt-1 text-espresso-400 text-xs font-bold uppercase tracking-wider">
              Always on
            </span>
          </div>

          {categories.map(category => (
            <div key={category} className="flex items-start gap-4 py-4 border-t border-espresso-100">
              <div className="flex-1 min-w-0">
                <span className="text-espresso-900 font-semibold text-sm">{CATEGORY_LABEL[category].title}</span>
                <p className="text-espresso-500 text-sm mt-0.5">{CATEGORY_LABEL[category].blurb}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={draft[category]}
                aria-label={CATEGORY_LABEL[category].title}
                onClick={() => setDraft(d => ({ ...d, [category]: !d[category] }))}
                className={`flex-shrink-0 mt-1 w-11 h-6 rounded-full transition-colors relative ${
                  draft[category] ? 'bg-espresso-400' : 'bg-espresso-200'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                    draft[category] ? 'left-[1.375rem]' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
          ))}

          <div className="flex flex-col sm:flex-row gap-2 mt-6 pt-5 border-t border-espresso-100">
            <button
              type="button"
              onClick={() => onSave(ALL_OFF)}
              className="flex-1 px-5 py-3 rounded-full text-sm font-bold border border-espresso-200 text-espresso-700 hover:border-espresso-400 transition-colors"
            >
              Reject all
            </button>
            <button
              type="button"
              onClick={() => onSave(draft)}
              className="flex-1 px-5 py-3 rounded-full text-sm font-bold bg-espresso-900 hover:bg-espresso-700 text-espresso-50 transition-colors"
            >
              Save choices
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function GoogleAnalytics({ id }: { id: string }) {
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}
gtag('js',new Date());gtag('config','${id}',{anonymize_ip:true});`}
      </Script>
    </>
  )
}

function MetaPixel({ id }: { id: string }) {
  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${id}');fbq('track','PageView');`}
    </Script>
  )
}

function TikTokPixel({ id }: { id: string }) {
  return (
    <Script id="tiktok-pixel" strategy="afterInteractive">
      {`!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];
ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};
ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js";
ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=r;ttq._t=ttq._t||{};ttq._t[e]=+new Date;
ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=d.createElement("script");o.type="text/javascript";
o.async=!0;o.src=r+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];
a.parentNode.insertBefore(o,a)};ttq.load('${id}');ttq.page()}(window,document,'ttq');`}
    </Script>
  )
}
