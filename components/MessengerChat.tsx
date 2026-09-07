'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import Script from 'next/script'

const SDK_VERSION = 'v21.0'

// Where the bubble must not appear.
//
// /order because a floating bubble sits exactly where the Place Order button
// is on a phone, and a checkout is not the place to lose a tap. /admin because
// the backoffice is not a storefront.
function isHiddenPath(pathname: string | null): boolean {
  if (!pathname) return false
  return pathname.startsWith('/order') || pathname.startsWith('/admin')
}

/**
 * Meta's Chat Plugin. Renders nothing unless NEXT_PUBLIC_FB_PAGE_ID is set, so
 * the whole feature is dark until the Page is configured — and the SDK is
 * never fetched on a deployment that has no page to attach it to.
 *
 * Note the plugin also needs the domain allowlisted in Meta Business Suite;
 * without that it silently renders nothing and logs nothing useful, which is a
 * confusing hour if you don't know to look for it.
 */
export default function MessengerChat() {
  const pageId = process.env.NEXT_PUBLIC_FB_PAGE_ID
  const pathname = usePathname()
  const chatRef = useRef<HTMLDivElement>(null)
  const hidden = isHiddenPath(pathname)

  // page_id and attribution are set here rather than as JSX props: they are
  // not valid DOM attributes, and React would either strip them or warn. The
  // SDK reads them off the element when it parses XFBML.
  useEffect(() => {
    if (!chatRef.current || !pageId) return
    chatRef.current.setAttribute('page_id', pageId)
    chatRef.current.setAttribute('attribution', 'biz_inbox')
  }, [pageId])

  if (!pageId || hidden) return null

  return (
    <>
      <div id="fb-root" />
      <div ref={chatRef} className="fb-customerchat" />
      <Script
        id="fb-customerchat-sdk"
        // lazyOnload, not afterInteractive: the Facebook SDK is a large
        // third-party script and the pages it loads on already carry Leaflet
        // and the font payload. A chat bubble is never worth delaying content.
        strategy="lazyOnload"
        dangerouslySetInnerHTML={{
          __html: `
            window.fbAsyncInit = function() {
              FB.init({ xfbml: true, version: '${SDK_VERSION}' });
            };
            (function(d, s, id) {
              var js, fjs = d.getElementsByTagName(s)[0];
              if (d.getElementById(id)) return;
              js = d.createElement(s); js.id = id;
              js.src = 'https://connect.facebook.net/en_US/sdk/xfbml.customerchat.js';
              fjs.parentNode.insertBefore(js, fjs);
            }(document, 'script', 'facebook-jssdk'));
          `,
        }}
      />
    </>
  )
}
