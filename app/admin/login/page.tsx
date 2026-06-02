'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLogin() {
  const router = useRouter()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        router.push('/admin/dashboard')
      } else {
        setError('Invalid username or password.')
      }
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-espresso-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-espresso-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1C0A00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 8H19a2 2 0 012 2v2a2 2 0 01-2 2h-2"/>
              <path d="M3 8h14v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
              <path d="M7 8V6a1 1 0 011-1h8a1 1 0 011 1v2"/>
            </svg>
          </div>
          <h1 className="text-espresso-50 text-xl font-bold" style={{ fontFamily: 'Georgia, serif' }}>Make My Coffee</h1>
          <p className="text-espresso-500 text-sm mt-1">Admin Panel</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-7">
          <h2 className="text-espresso-900 font-bold text-lg mb-6" style={{ fontFamily: 'Georgia, serif' }}>Sign in</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-espresso-700 text-xs font-semibold uppercase tracking-wider mb-1.5">Username</label>
              <input
                type="text"
                value={form.username}
                onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                required
                autoComplete="username"
                className="w-full border border-espresso-200 rounded-xl px-4 py-3 text-sm text-espresso-900 focus:outline-none focus:border-espresso-400 focus:ring-2 focus:ring-espresso-400/20 transition-all"
                placeholder="admin"
              />
            </div>
            <div>
              <label className="block text-espresso-700 text-xs font-semibold uppercase tracking-wider mb-1.5">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                required
                autoComplete="current-password"
                className="w-full border border-espresso-200 rounded-xl px-4 py-3 text-sm text-espresso-900 focus:outline-none focus:border-espresso-400 focus:ring-2 focus:ring-espresso-400/20 transition-all"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-espresso-900 hover:bg-espresso-700 disabled:opacity-50 text-espresso-50 font-bold py-3 rounded-xl transition-colors text-sm mt-2"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
