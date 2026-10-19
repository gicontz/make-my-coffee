'use client'

import { useState } from 'react'
import Link from 'next/link'

const serif = { fontFamily: 'var(--font-playfair), Georgia, serif' }

// One button, not an unsubscribe-on-load: mail scanners open every link in a
// message, and acting on that visit would remove people who never asked to
// leave. The provider's own one-click button (List-Unsubscribe) skips this
// page entirely.
export default function UnsubscribeForm({ token }: { token: string }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle')
  const [error, setError] = useState('')

  async function submit() {
    setError('')
    setStatus('sending')
    try {
      const res = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Couldn’t unsubscribe you just now. Please try again.')
      setStatus('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t unsubscribe you just now. Please try again.')
      setStatus('idle')
    }
  }

  if (status === 'done') {
    return (
      <div role="status">
        <h1 className="text-espresso-900 text-2xl font-bold mb-3" style={serif}>You’re unsubscribed</h1>
        <p className="text-espresso-700 text-sm leading-relaxed mb-6">
          No more offers or reminders. Emails about orders you place still arrive as normal — those aren’t marketing.
        </p>
        <Link href="/" className="text-espresso-900 font-semibold text-sm underline underline-offset-4">Back to the shop</Link>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-espresso-900 text-2xl font-bold mb-3" style={serif}>Unsubscribe from our emails?</h1>
      <p className="text-espresso-700 text-sm leading-relaxed mb-6">
        You’ll stop getting offers and running-low reminders. Emails about orders you place aren’t affected, and an
        unused welcome code keeps working.
      </p>
      {token ? (
        <button
          type="button"
          onClick={submit}
          disabled={status === 'sending'}
          className="w-full min-h-[44px] bg-espresso-900 hover:bg-espresso-700 disabled:opacity-60 text-espresso-50 font-bold px-6 py-3 rounded-full transition-colors text-sm"
        >
          {status === 'sending' ? 'Unsubscribing…' : 'Unsubscribe'}
        </button>
      ) : (
        <p className="text-red-700 text-sm">
          This link is missing its code. Use the Unsubscribe link in any of our emails, or{' '}
          <Link href="/contact" className="font-semibold underline underline-offset-2">contact us</Link> and we’ll do it for you.
        </p>
      )}
      {error && <p role="alert" className="text-red-700 text-sm mt-3">{error}</p>}
    </div>
  )
}
