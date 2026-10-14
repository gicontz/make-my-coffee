'use client'

import { useState } from 'react'
import Link from 'next/link'
import { SIGNUP_CONSENT, WELCOME_DISCOUNT, type SignupSource } from '@/lib/subscribe'

const serif = { fontFamily: 'var(--font-playfair), Georgia, serif' }

/**
 * The email signup (#39): ₱50 off for an address, and a reminder when a
 * delivered order is probably running low.
 *
 * Asks for itself. Nothing about the cookie banner feeds this — someone who
 * allowed analytics has not agreed to be emailed — and the wording beside the
 * button is SIGNUP_CONSENT, the same string the server stores as the record of
 * what was agreed to.
 */
export default function EmailSignup({ source }: { source: SignupSource }) {
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('') // honeypot
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle')
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setStatus('sending')
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source, consent: true, website }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Couldn’t sign you up just now. Please try again.')
      setStatus('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t sign you up just now. Please try again.')
      setStatus('idle')
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-espresso-100 shadow-sm p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
      <div>
        <h2 className="text-3xl sm:text-4xl font-bold text-espresso-900 mb-3 leading-tight" style={serif}>
          Take ₱{WELCOME_DISCOUNT} off a bottle
        </h2>
        <p className="text-espresso-600 leading-relaxed">
          Leave your email and we’ll send you a code. After your coffee arrives, we’ll give you a nudge around the
          time it’s probably running low, so you’re not left without.
        </p>
      </div>

      {status === 'done' ? (
        <div role="status" className="bg-espresso-50 border border-espresso-100 rounded-xl p-5">
          <p className="text-espresso-900 font-bold mb-1" style={serif}>Thanks for signing up</p>
          <p className="text-espresso-700 text-sm leading-relaxed">
            If this is the first time <span className="font-semibold break-all">{email.trim()}</span> has signed up,
            your ₱{WELCOME_DISCOUNT} code is on its way. It can take a minute — check your spam folder if it
            doesn’t show.
          </p>
        </div>
      ) : (
        <form onSubmit={submit}>
          <label htmlFor={`signup-email-${source}`} className="block text-espresso-700 text-xs font-semibold uppercase tracking-wider mb-1.5">
            Email address
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id={`signup-email-${source}`}
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError('') }}
              placeholder="you@example.com"
              aria-invalid={!!error}
              aria-describedby={`signup-consent-${source}${error ? ` signup-error-${source}` : ''}`}
              className="flex-1 min-w-0 border border-espresso-200 rounded-xl px-4 py-3 text-espresso-900 placeholder-espresso-500 focus:outline-none focus:border-espresso-400 focus:ring-2 focus:ring-espresso-400/20 transition-all bg-white text-sm"
            />
            {/* Honeypot: off-screen and out of the tab order. A person never fills it. */}
            <div aria-hidden="true" className="absolute -left-[9999px] w-px h-px overflow-hidden">
              <label>
                Website
                <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} />
              </label>
            </div>
            <button
              type="submit"
              disabled={status === 'sending'}
              className="flex-shrink-0 min-h-[44px] bg-espresso-900 hover:bg-espresso-700 disabled:opacity-60 text-espresso-50 font-bold px-6 py-3 rounded-full transition-colors text-sm"
            >
              {status === 'sending' ? 'Sending…' : 'Send my code'}
            </button>
          </div>
          {error && (
            <p id={`signup-error-${source}`} role="alert" className="text-red-700 text-xs mt-2">{error}</p>
          )}
          <p id={`signup-consent-${source}`} className="text-espresso-600 text-xs leading-relaxed mt-3">
            {SIGNUP_CONSENT} One code per address, good for one order.{' '}
            <Link href="/privacy" className="font-semibold text-espresso-800 underline underline-offset-2">
              Privacy policy
            </Link>
          </p>
        </form>
      )}
    </div>
  )
}
