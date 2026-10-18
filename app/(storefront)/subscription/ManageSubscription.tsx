'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatDeliveryDate } from '@/lib/deliveryDate'
import { SUBSCRIPTION_DISCOUNT_PERCENT, type SubscriptionAction, type SubscriptionView } from '@/lib/subscriptions'

type Phase =
  | { kind: 'loading' }
  | { kind: 'invalid' }
  | { kind: 'error' }
  | { kind: 'ready'; view: SubscriptionView }

const serif = { fontFamily: 'var(--font-playfair), Georgia, serif' }
const peso = (n: number) => `₱${n.toLocaleString()}`

const DONE: Record<SubscriptionAction, string> = {
  pause: 'Paused. Nothing more will be delivered until you resume.',
  resume: 'Resumed. Your next delivery is below.',
  skip: 'Skipped. Your next delivery is below.',
  cancel: 'Cancelled. Nothing more will be delivered or charged.',
}

/**
 * The token arrives in the URL fragment (/subscription#<token>) — see
 * lib/linkToken.ts. It is read once, removed from the address bar before any
 * analytics tag can report the page's URL, and kept only in memory. A reload
 * loses it, which is why the invalid-link message says to reopen the email.
 */
export default function ManageSubscription() {
  const [token, setToken] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [busy, setBusy] = useState<SubscriptionAction | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  useEffect(() => {
    const fromHash = window.location.hash.slice(1)
    if (fromHash) window.history.replaceState(null, '', window.location.pathname)
    if (!fromHash) {
      setPhase({ kind: 'invalid' })
      return
    }
    setToken(fromHash)
    load(fromHash)
  }, [])

  async function post(body: Record<string, unknown>): Promise<Response> {
    return fetch('/api/subscriptions/manage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  async function load(t: string) {
    try {
      const res = await post({ token: t })
      if (res.status === 404) return setPhase({ kind: 'invalid' })
      if (!res.ok) return setPhase({ kind: 'error' })
      setPhase({ kind: 'ready', view: (await res.json()) as SubscriptionView })
    } catch {
      setPhase({ kind: 'error' })
    }
  }

  async function act(action: SubscriptionAction) {
    if (!token) return
    setBusy(action)
    setNotice(null)
    setError(null)
    try {
      const res = await post({ token, action })
      const data = (await res.json().catch(() => ({}))) as SubscriptionView & { error?: string }
      if (res.ok) {
        setPhase({ kind: 'ready', view: data })
        setNotice(DONE[action])
        setConfirmingCancel(false)
      } else if (res.status === 409) {
        // Someone (or the weekly order run) got there first: show the truth.
        setError(data.error ?? 'Your subscription changed. Here is how it stands now.')
        await load(token)
      } else if (res.status === 404) {
        setPhase({ kind: 'invalid' })
      } else {
        setError(data.error ?? 'Something went wrong. Please try again.')
      }
    } catch {
      setError('Could not reach us. Check your connection and try again.')
    } finally {
      setBusy(null)
    }
  }

  if (phase.kind === 'loading') {
    return <Card><p className="text-espresso-500 text-sm">Opening your subscription…</p></Card>
  }

  if (phase.kind === 'invalid') {
    return (
      <Card title="We couldn't open this link">
        <p>
          Please use the <strong className="text-espresso-800">Manage subscription</strong> link in any of your
          subscription emails again — it only works from there, and reloading this page loses it.
        </p>
        <p>Still stuck? <Link href="/contact" className="font-semibold underline underline-offset-4">Contact us</Link>.</p>
      </Card>
    )
  }

  if (phase.kind === 'error') {
    return (
      <Card title="Something went wrong">
        <p>We couldn't load your subscription just now. Please try the link again in a few minutes.</p>
      </Card>
    )
  }

  const { view } = phase
  const btn = 'px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50'
  const primary = `${btn} bg-espresso-400 text-espresso-900 hover:bg-espresso-300`
  const secondary = `${btn} border border-espresso-300 text-espresso-800 hover:bg-espresso-100`

  return (
    <div className="space-y-6">
      {notice && (
        <p role="status" className="bg-green-50 border border-green-200 text-green-800 rounded-xl px-4 py-3 text-sm">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </p>
      )}

      <Card title={`Hi ${view.firstName}`}>
        <p>
          {view.status === 'active' && view.nextDeliveryDate && (
            <>Your next delivery is <strong className="text-espresso-900">{formatDeliveryDate(view.nextDeliveryDate)}</strong>, then every week on the same day.</>
          )}
          {view.status === 'paused' && <>Your subscription is <strong className="text-espresso-900">paused</strong>. Nothing will be delivered until you resume it.</>}
          {view.status === 'cancelled' && <>Your subscription is <strong className="text-espresso-900">cancelled</strong>. Nothing more will be delivered.</>}
        </p>
        {view.status !== 'cancelled' && view.slotLabels.length > 0 && (
          <p className="text-espresso-500">Delivery windows: {view.slotLabels.join(', ')}</p>
        )}
      </Card>

      {view.status !== 'cancelled' && view.items.length > 0 && (
        <Card title="Each week">
          <ul className="space-y-1">
            {view.items.map(i => (
              <li key={i.name} className="flex justify-between"><span>{i.name}</span><span>× {i.quantity}</span></li>
            ))}
          </ul>
          <dl className="border-t border-espresso-100 pt-3 space-y-1">
            <div className="flex justify-between"><dt>Bottles</dt><dd>{peso(view.subtotal)}</dd></div>
            <div className="flex justify-between text-green-700">
              <dt>Subscriber discount ({SUBSCRIPTION_DISCOUNT_PERCENT}%)</dt><dd>−{peso(view.discount)}</dd>
            </div>
          </dl>
          <p className="text-espresso-500 text-xs">Delivery is quoted for each order from your pinned address.</p>
        </Card>
      )}

      {view.status !== 'cancelled' && (
        <div className="flex flex-wrap gap-3">
          {view.status === 'active' && (
            <>
              <button type="button" className={primary} disabled={!!busy} onClick={() => act('skip')}>
                {busy === 'skip' ? 'Skipping…' : 'Skip next delivery'}
              </button>
              <button type="button" className={secondary} disabled={!!busy} onClick={() => act('pause')}>
                {busy === 'pause' ? 'Pausing…' : 'Pause'}
              </button>
            </>
          )}
          {view.status === 'paused' && (
            <button type="button" className={primary} disabled={!!busy} onClick={() => act('resume')}>
              {busy === 'resume' ? 'Resuming…' : 'Resume'}
            </button>
          )}
          {confirmingCancel ? (
            <span className="flex flex-wrap items-center gap-3">
              <button type="button" className={`${btn} bg-red-600 text-white hover:bg-red-700`} disabled={!!busy} onClick={() => act('cancel')}>
                {busy === 'cancel' ? 'Cancelling…' : 'Yes, cancel it'}
              </button>
              <button type="button" className={secondary} disabled={!!busy} onClick={() => setConfirmingCancel(false)}>
                Keep it
              </button>
            </span>
          ) : (
            <button type="button" className={secondary} disabled={!!busy} onClick={() => setConfirmingCancel(true)}>
              Cancel subscription
            </button>
          )}
        </div>
      )}

      {view.status === 'cancelled' && (
        <p className="text-sm text-espresso-600">
          Changed your mind? <Link href="/shop" className="font-semibold underline underline-offset-4">Order from the shop</Link>.
        </p>
      )}
    </div>
  )
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-espresso-100 space-y-3 text-sm text-espresso-700">
      {title && <h2 className="text-xl font-bold text-espresso-900" style={serif}>{title}</h2>}
      {children}
    </div>
  )
}
