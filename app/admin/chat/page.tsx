'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface InboxRow {
  id: string
  needs_human: boolean
  last_message_at: string
  message_count: number
  last_body: string
  verified_order_id: number | null
}

interface Message {
  id: number
  role: 'visitor' | 'bot' | 'staff'
  body: string
  created_at: string
}

// Refreshed while the page is open. Nobody gets a push notification for this —
// see the warning in the empty state.
const POLL_MS = 10_000

function when(value: string): string {
  return new Date(value).toLocaleString('en-PH', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function AdminChat() {
  const [sessions, setSessions] = useState<InboxRow[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/chat')
      if (!res.ok) throw new Error(`Couldn't load conversations (status ${res.status})`)
      const data = await res.json()
      if (!Array.isArray(data)) throw new Error('Unexpected response from server')
      setSessions(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversations')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadMessages = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/admin/chat/${id}`)
      const data = await res.json()
      setMessages(data.messages ?? [])
    } catch {
      setError('Failed to load that conversation')
    }
  }, [])

  useEffect(() => { loadSessions() }, [loadSessions])

  useEffect(() => {
    const timer = setInterval(() => {
      loadSessions()
      if (selected) loadMessages(selected)
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [loadSessions, loadMessages, selected])

  useEffect(() => {
    if (selected) loadMessages(selected)
  }, [selected, loadMessages])

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight })
  }, [messages])

  async function reply(e: React.FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || !selected || sending) return

    setSending(true)
    try {
      const res = await fetch(`/api/admin/chat/${selected}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to send')
      setDraft('')
      await loadMessages(selected)
      await loadSessions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  const waiting = sessions.filter(s => s.needs_human).length

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-espresso-900" style={{ fontFamily: 'Georgia, serif' }}>Chat</h1>
        <p className="text-espresso-500 text-sm mt-1">
          Conversations from the website widget
          {waiting > 0 && <span className="ml-2 text-orange-700 font-semibold">· {waiting} waiting for a person</span>}
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-20 text-espresso-400">Loading conversations…</div>
      ) : sessions.length === 0 ? (
        <div className="max-w-lg mx-auto text-center py-16">
          <p className="text-espresso-400 mb-4">No conversations yet.</p>
          {/* Worth saying plainly rather than discovering it the hard way. */}
          <p className="text-espresso-500 text-sm">
            This page is the only place website chats appear. Nothing pushes to a phone — when a visitor
            asks for a person, an email goes to the admin address, and that email is the notification.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Conversations */}
          <div className="lg:col-span-1 space-y-2 max-h-[70vh] overflow-y-auto pr-1">
            {sessions.map(s => (
              <button
                key={s.id}
                onClick={() => setSelected(s.id)}
                className={`w-full text-left bg-white rounded-xl border p-3 transition-colors ${
                  selected === s.id ? 'border-espresso-400 ring-2 ring-espresso-400/20' : 'border-espresso-100 hover:border-espresso-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {s.needs_human && (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-200">
                      Waiting
                    </span>
                  )}
                  {s.verified_order_id && (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-espresso-50 text-espresso-600 border border-espresso-200">
                      #{s.verified_order_id}
                    </span>
                  )}
                  <span className="ml-auto text-espresso-400 text-[11px]">{when(s.last_message_at)}</span>
                </div>
                <p className="text-espresso-700 text-sm line-clamp-2">{s.last_body || '—'}</p>
                <p className="text-espresso-400 text-[11px] mt-1">{s.message_count} messages</p>
              </button>
            ))}
          </div>

          {/* Transcript */}
          <div className="lg:col-span-2">
            {!selected ? (
              <div className="bg-white rounded-2xl border border-espresso-100 h-[70vh] flex items-center justify-center text-espresso-400 text-sm">
                Pick a conversation to read it.
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-espresso-100 h-[70vh] flex flex-col overflow-hidden">
                <div ref={transcriptRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-espresso-50">
                  {messages.map(m => (
                    <div key={m.id} className={m.role === 'visitor' ? 'flex justify-start' : 'flex justify-end'}>
                      <div
                        className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-line ${
                          m.role === 'visitor'
                            ? 'bg-white border border-espresso-200 text-espresso-800'
                            : m.role === 'staff'
                              ? 'bg-espresso-900 text-espresso-50'
                              : 'bg-espresso-100 text-espresso-700'
                        }`}
                      >
                        <span className="block text-[10px] font-semibold uppercase tracking-wider opacity-60 mb-0.5">
                          {m.role === 'visitor' ? 'Visitor' : m.role === 'staff' ? 'You' : 'Bot'} · {when(m.created_at)}
                        </span>
                        {m.body}
                      </div>
                    </div>
                  ))}
                </div>

                <form onSubmit={reply} className="flex items-center gap-2 p-3 border-t border-espresso-100">
                  <input
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    placeholder="Reply as Make My Coffee…"
                    maxLength={2000}
                    className="flex-1 min-w-0 border border-espresso-200 rounded-full px-4 py-2 text-sm text-espresso-900 placeholder-espresso-300 focus:outline-none focus:border-espresso-400 focus:ring-2 focus:ring-espresso-400/20"
                  />
                  <button
                    type="submit"
                    disabled={sending || !draft.trim()}
                    className="flex-shrink-0 px-5 py-2 rounded-full bg-espresso-900 hover:bg-espresso-700 disabled:opacity-40 text-espresso-50 text-sm font-bold transition-colors"
                  >
                    {sending ? '…' : 'Send'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
