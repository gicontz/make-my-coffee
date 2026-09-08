'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

interface Message {
  id: number
  role: 'visitor' | 'bot' | 'staff'
  body: string
}

interface QuickReply {
  title: string
  payload: string
}

// Where the widget must not appear.
//
// /order because a floating launcher sits exactly where the Place Order button
// is on a phone, and checkout is not the place to lose a tap. /admin because
// the backoffice is not a storefront.
function isHiddenPath(pathname: string | null): boolean {
  if (!pathname) return false
  return pathname.startsWith('/order') || pathname.startsWith('/admin')
}

// Only polled while the panel is open — a closed widget costs nothing.
const POLL_MS = 5000

/**
 * On-site chat, on our own backend.
 *
 * Not Messenger: Meta discontinued the embeddable Chat Plugin in 2024, and the
 * m.me link that replaced it lands on a dead page since messenger.com stopped
 * carrying messages. More fundamentally, the Send API addresses people by PSID
 * and an anonymous visitor has none — so an embedded Messenger thread is not
 * something we could build even if we wanted to. See issue #17.
 */
export default function ChatWidget() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([])
  const [opening, setOpening] = useState('')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const lastId = messages.length ? messages[messages.length - 1].id : 0

  // The transcript survives a reload — the httpOnly cookie finds the session
  // server-side, so there is nothing to restore from localStorage.
  useEffect(() => {
    if (!open || loaded) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/chat')
        const data = await res.json()
        if (cancelled) return
        setMessages(data.messages ?? [])
        if (data.opening) setOpening(data.opening)
        if (data.quickReplies) setQuickReplies(data.quickReplies)
      } catch {
        if (!cancelled) setError('Could not load the conversation.')
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => { cancelled = true }
  }, [open, loaded])

  // Polling, not websockets: a staff reply arriving a few seconds late is fine,
  // and a persistent connection is a much bigger commitment on serverless than
  // this earns.
  useEffect(() => {
    if (!open || !loaded) return
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/chat?after=${lastId}`)
        const data = await res.json()
        if (data.messages?.length) {
          setMessages(prev => [...prev, ...data.messages])
        }
      } catch {
        // A dropped poll is not worth telling anyone about; the next one runs.
      }
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [open, loaded, lastId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, opening])

  const send = useCallback(async (payload: { text?: string; payload?: string }) => {
    setSending(true)
    setError('')
    // Clearing them on send stops a stale set being tapped against a question
    // that has already moved on.
    setQuickReplies([])
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Message failed to send')
      setMessages(prev => [...prev, ...(data.messages ?? [])])
      setQuickReplies(data.quickReplies ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Message failed to send')
    } finally {
      setSending(false)
    }
  }, [])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || sending) return
    setDraft('')
    send({ text })
  }

  if (isHiddenPath(pathname)) return null

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="Chat with Make My Coffee"
          className="fixed bottom-24 right-4 sm:right-5 z-50 flex flex-col w-[min(22rem,calc(100vw-2rem))] h-[min(30rem,calc(100vh-9rem))] bg-white rounded-2xl shadow-2xl border border-espresso-200 overflow-hidden"
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-espresso-900 text-espresso-50 flex-shrink-0">
            <div className="min-w-0">
              <p className="font-bold text-sm truncate" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
                Make My Coffee
              </p>
              <p className="text-espresso-300 text-[11px]">Usually replies in a few minutes</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="flex-shrink-0 text-espresso-300 hover:text-espresso-50 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-espresso-50">
            {opening && <Bubble role="bot" body={opening} />}
            {messages.map(m => (
              <Bubble key={m.id} role={m.role} body={m.body} />
            ))}
            {sending && (
              <p className="text-espresso-400 text-xs px-1" role="status">Typing…</p>
            )}
            {error && (
              <p role="alert" className="text-red-600 text-xs px-1">{error}</p>
            )}
          </div>

          {quickReplies.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-4 pb-2 bg-espresso-50 flex-shrink-0">
              {quickReplies.map(qr => (
                <button
                  key={qr.payload}
                  type="button"
                  disabled={sending}
                  onClick={() => send({ payload: qr.payload })}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white border border-espresso-200 text-espresso-700 hover:border-espresso-400 disabled:opacity-50 transition-colors"
                >
                  {qr.title}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={submit} className="flex items-center gap-2 p-3 border-t border-espresso-100 bg-white flex-shrink-0">
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="Ask us anything…"
              aria-label="Your message"
              maxLength={1000}
              className="flex-1 min-w-0 border border-espresso-200 rounded-full px-4 py-2 text-sm text-espresso-900 placeholder-espresso-300 focus:outline-none focus:border-espresso-400 focus:ring-2 focus:ring-espresso-400/20 transition-all"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              aria-label="Send"
              className="flex-shrink-0 w-9 h-9 rounded-full bg-espresso-900 hover:bg-espresso-700 disabled:opacity-40 text-espresso-50 flex items-center justify-center transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label={open ? 'Close chat' : 'Chat with us'}
        className="fixed bottom-5 right-4 sm:right-5 z-50 inline-flex items-center gap-2 rounded-full bg-espresso-900 hover:bg-espresso-700 text-espresso-50 shadow-lg transition-colors px-4 py-3 sm:px-5"
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        ) : (
          <>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
            <span className="hidden sm:inline text-sm font-bold">Chat with us</span>
          </>
        )}
      </button>
    </>
  )
}

// Bot copy carries links — the shop, for one — and a bare URL rendered as text
// is a URL nobody can follow on a phone. Split rather than inject: this is
// still model-adjacent output, and dangerouslySetInnerHTML on it would be an
// injection hole for the price of an anchor tag.
const URL_RE = /(https?:\/\/[^\s<>()]+[^\s<>().,!?])/g

function linkify(body: string) {
  // The split keeps the captured URLs as their own entries, so a plain prefix
  // check identifies them. Deliberately not URL_RE.test() — a /g regex carries
  // lastIndex between calls and would match every other time.
  return body.split(URL_RE).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 font-semibold break-all"
      >
        {part}
      </a>
    ) : (
      part
    )
  )
}

function Bubble({ role, body }: { role: Message['role']; body: string }) {
  const mine = role === 'visitor'
  return (
    <div className={mine ? 'flex justify-end' : 'flex justify-start'}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-line ${
          mine
            ? 'bg-espresso-900 text-espresso-50 rounded-br-sm'
            : 'bg-white border border-espresso-200 text-espresso-800 rounded-bl-sm'
        }`}
      >
        {/* A staff reply is labelled, so nobody mistakes a person for the bot
            — or, worse, keeps waiting for a human who has already answered. */}
        {role === 'staff' && (
          <span className="block text-espresso-400 text-[10px] font-semibold uppercase tracking-wider mb-0.5">
            Make My Coffee
          </span>
        )}
        {linkify(body)}
      </div>
    </div>
  )
}
