'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DISPLAY_NAME_MAX, REVIEW_BODY_MAX } from '@/lib/reviews'

type RequestView = {
  state: 'open' | 'reviewed' | 'not-delivered'
  orderId: number
  suggestedName: string
  itemNames: string[]
}

type Phase =
  | { kind: 'loading' }
  | { kind: 'invalid' }
  | { kind: 'error' }
  | { kind: 'ready'; view: RequestView }
  | { kind: 'done' }

const inputCls =
  'w-full border border-espresso-200 rounded-xl px-4 py-3 text-espresso-900 placeholder-espresso-300 focus:outline-none focus:border-espresso-400 focus:ring-2 focus:ring-espresso-400/20 transition-all bg-white text-sm'
const labelCls = 'block text-espresso-700 text-xs font-semibold uppercase tracking-wider mb-1.5'
const serif = { fontFamily: 'var(--font-playfair), Georgia, serif' }

const RATING_WORDS = ['', 'Poor', 'Not great', 'Okay', 'Good', 'Excellent']

/**
 * The token arrives in the URL fragment (/review#<token>) — see lib/reviews.ts.
 * It is read once, then removed from the address bar before any analytics tag
 * can load and report the page's URL, and kept only in memory. A reload
 * therefore loses it, which is why the invalid-link message says to reopen the
 * email rather than that the link is wrong.
 */
export default function ReviewForm() {
  const [token, setToken] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })

  const [rating, setRating] = useState(0)
  const [body, setBody] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    const fromHash = window.location.hash.slice(1)
    if (fromHash) window.history.replaceState(null, '', window.location.pathname)
    if (!fromHash) {
      setPhase({ kind: 'invalid' })
      return
    }
    setToken(fromHash)

    fetch('/api/reviews/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: fromHash }),
    })
      .then(async res => {
        if (res.status === 404) return setPhase({ kind: 'invalid' })
        if (!res.ok) return setPhase({ kind: 'error' })
        const view = (await res.json()) as RequestView
        setDisplayName(view.suggestedName)
        setPhase({ kind: 'ready', view })
      })
      .catch(() => setPhase({ kind: 'error' }))
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    if (rating === 0) {
      setFormError('Please choose a rating from 1 to 5 stars.')
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, rating, body, displayName }),
      })
      if (res.ok) {
        setPhase({ kind: 'done' })
        return
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      setFormError(data.error ?? 'Something went wrong. Please try again.')
    } catch {
      setFormError('Could not reach us. Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (phase.kind === 'loading') {
    return <Card><p className="text-espresso-500 text-sm">Opening your order…</p></Card>
  }

  if (phase.kind === 'invalid') {
    return (
      <Card title="We couldn't open this review link">
        <p>
          Please open the <strong className="text-espresso-800">Review your order</strong> button in your delivery
          email again — the link only works from there, and reloading this page loses it.
        </p>
        <p>Still stuck? <Link href="/contact" className="font-semibold underline underline-offset-4">Contact us</Link>.</p>
      </Card>
    )
  }

  if (phase.kind === 'error') {
    return (
      <Card title="Something went wrong">
        <p>We couldn&apos;t load your order just now. Please try the link in your email again in a few minutes.</p>
      </Card>
    )
  }

  if (phase.kind === 'done') {
    return (
      <Card title="Thank you">
        <p>
          We&apos;ve got your review. We read every one before it goes on the site, so it may take a day or two to
          appear.
        </p>
        <p><Link href="/shop" className="font-semibold underline underline-offset-4">Back to the shop</Link></p>
      </Card>
    )
  }

  const { view } = phase

  if (view.state === 'reviewed') {
    return (
      <Card title="Already reviewed">
        <p>Order #{view.orderId} already has a review — thank you for writing it.</p>
      </Card>
    )
  }

  if (view.state === 'not-delivered') {
    return (
      <Card title="Not delivered yet">
        <p>
          Order #{view.orderId} isn&apos;t marked as delivered, so it can&apos;t be reviewed yet. If it has arrived,{' '}
          <Link href="/contact" className="font-semibold underline underline-offset-4">let us know</Link>.
        </p>
      </Card>
    )
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-espresso-100 space-y-6">
      <div>
        <p className="text-espresso-500 text-sm">Order #{view.orderId}</p>
        {view.itemNames.length > 0 && (
          <p className="text-espresso-900 font-semibold mt-1">{view.itemNames.join(', ')}</p>
        )}
      </div>

      <fieldset>
        <legend className={labelCls}>Your rating *</legend>
        <div className="flex items-center gap-3">
          <div className="flex gap-1" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} star${n === 1 ? '' : 's'} — ${RATING_WORDS[n]}`}
                onClick={() => { setRating(n); setFormError(null) }}
                className="p-1 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-espresso-400"
              >
                <svg width="32" height="32" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"
                  className={n <= rating ? 'text-espresso-400' : 'text-espresso-200 hover:text-espresso-300'}>
                  <path d="M12 2.5l2.94 5.96 6.56.95-4.75 4.63 1.12 6.54L12 17.5l-5.87 3.08 1.12-6.54L2.5 9.41l6.56-.95L12 2.5z" />
                </svg>
              </button>
            ))}
          </div>
          {rating > 0 && <span className="text-espresso-700 text-sm font-semibold">{RATING_WORDS[rating]}</span>}
        </div>
      </fieldset>

      <div>
        <label htmlFor="review-body" className={labelCls}>Your review *</label>
        <textarea
          id="review-body"
          value={body}
          onChange={e => setBody(e.target.value)}
          required
          maxLength={REVIEW_BODY_MAX}
          rows={5}
          className={inputCls}
          placeholder="How did you drink it? How did it taste? Anything we should do better?"
        />
        <p className="text-espresso-400 text-xs mt-1 text-right">{body.length} / {REVIEW_BODY_MAX}</p>
      </div>

      <div>
        <label htmlFor="review-name" className={labelCls}>Name to show *</label>
        <input
          id="review-name"
          type="text"
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          required
          maxLength={DISPLAY_NAME_MAX}
          className={inputCls}
        />
        <p className="text-espresso-500 text-xs mt-1.5">Shown with your review. Use a first name or initials if you prefer.</p>
      </div>

      <div className="text-espresso-600 text-sm leading-relaxed bg-espresso-50 rounded-xl p-4 space-y-2">
        <p>
          Your review, rating and the name above appear on our product pages once we&apos;ve read it. We never
          change what you wrote, and low ratings are published the same as high ones.
        </p>
        <p>
          We only leave a review off if it includes personal details — a phone number, an address, someone
          else&apos;s name — is abusive, or isn&apos;t about your order.
        </p>
      </div>

      {formError && <p role="alert" className="text-red-700 text-sm">{formError}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full flex items-center justify-center bg-espresso-900 hover:bg-espresso-700 disabled:opacity-60 text-espresso-50 font-bold py-4 rounded-full transition-colors shadow-lg text-base"
      >
        {submitting ? 'Sending…' : 'Send review'}
      </button>
    </form>
  )
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-espresso-100">
      {title && <h2 className="text-espresso-900 font-bold text-xl mb-4" style={serif}>{title}</h2>}
      <div className="space-y-3 text-sm text-espresso-600 leading-relaxed">{children}</div>
    </div>
  )
}
