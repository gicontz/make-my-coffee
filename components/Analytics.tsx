'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'
import Link from 'next/link'
import {
  TRACKERS,
  activeTrackerNames,
  hasAdvertisingTrackers,
  hasTrackers,
  readConsent,
  writeConsent,
  type ConsentChoice,
} from '@/lib/analytics'

/**
 * Loads analytics and advertising trackers — but only after the visitor says
 * yes, and only for the ones this deployment has ids for.
 *
 * The scripts are rendered conditionally rather than loaded-and-disabled:
 * nothing is fetched, no cookie is written and no pixel fires until consent
 * is `granted`. A visitor who declines, closes the banner, or never answers is
 * never touched by any of them.
 */
export default function Analytics() {
  const [consent, setConsent] = useState<ConsentChoice | null>(null)
  // Consent lives in localStorage, which the server cannot see — so the first
  // render must match the server's (no banner, no scripts) and the real state
  // arrives after mount. Rendering either one during SSR is a hydration
  // mismatch.
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setConsent(readConsent())
    setReady(true)
  }, [])

  function choose(choice: ConsentChoice) {
    writeConsent(choice)
    setConsent(choice)
  }

  // Nothing configured → no banner, nothing to consent to. The site behaves
  // exactly as it did before any of this existed.
  if (!hasTrackers() || !ready) return null

  return (
    <>
      {consent === 'granted' && <TrackerScripts />}
      {consent === null && (
        <ConsentBanner onChoose={choose} names={activeTrackerNames()} ads={hasAdvertisingTrackers()} />
      )}
    </>
  )
}

function TrackerScripts() {
  const { ga4, metaPixel, tiktokPixel } = TRACKERS
  return (
    <>
      {ga4 && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga4}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}
gtag('js',new Date());gtag('config','${ga4}',{anonymize_ip:true});`}
          </Script>
        </>
      )}

      {metaPixel && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${metaPixel}');fbq('track','PageView');`}
        </Script>
      )}

      {tiktokPixel && (
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
a.parentNode.insertBefore(o,a)};ttq.load('${tiktokPixel}');ttq.page()}(window,document,'ttq');`}
        </Script>
      )}
    </>
  )
}

function ConsentBanner({
  onChoose,
  names,
  ads,
}: {
  onChoose: (c: ConsentChoice) => void
  names: string[]
  ads: boolean
}) {
  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie choices"
      className="fixed bottom-0 inset-x-0 z-[60] bg-espresso-900 text-espresso-200 border-t border-espresso-800"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <p className="text-sm leading-relaxed flex-1">
          {/* Named, not "we value your privacy" — a person can only decide if
              they are told who is actually being let in. */}
          We&apos;d like to use {names.join(', ')} to see which pages people find useful
          {ads ? ' and to measure our ads' : ''}. Nothing loads unless you say yes, and ordering works either
          way.{' '}
          <Link href="/cookies" className="underline underline-offset-2 hover:text-espresso-50">
            Which cookies, and for how long
          </Link>
          .
        </p>
        <div className="flex gap-2 flex-shrink-0">
          {/* Equal weight on purpose: a decline styled as an afterthought is
              not a free choice. */}
          <button
            type="button"
            onClick={() => onChoose('denied')}
            className="flex-1 sm:flex-none px-5 py-2.5 rounded-full text-sm font-bold border border-espresso-700 text-espresso-200 hover:border-espresso-500 transition-colors"
          >
            No thanks
          </button>
          <button
            type="button"
            onClick={() => onChoose('granted')}
            className="flex-1 sm:flex-none px-5 py-2.5 rounded-full text-sm font-bold bg-espresso-400 text-espresso-900 hover:bg-espresso-300 transition-colors"
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  )
}
