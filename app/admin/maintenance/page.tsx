'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ACTIVITY_MAX_LENGTH,
  MAINTENANCE_STATUS_LABEL,
  MAX_BEANS_GRAMS,
  gramsUsed,
  type ClosedStatus,
  type MaintenanceBrew,
  type MaintenanceStatus,
  type Operator,
} from '@/lib/maintenanceBrews'

// Pinned to Asia/Manila: the shop runs on Manila time and the Vercel runtime
// (and an admin's laptop abroad) may not.
// Date over time, two lines: on one line each stamp is ~22 characters and two
// of them pushed the Mark as done button off a 1280px screen.
function ManilaTime({ iso }: { iso: string }) {
  const d = new Date(iso)
  return (
    <time dateTime={iso} className="block leading-snug">
      {d.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })}
      <span className="block text-espresso-400">
        {d.toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' })}
      </span>
    </time>
  )
}

const STATUS_STYLE: Record<MaintenanceStatus, string> = {
  in_progress: 'bg-amber-100 text-amber-800 border-amber-200',
  done: 'bg-green-100 text-green-800 border-green-200',
  failed: 'bg-red-100 text-red-800 border-red-200',
}

interface FormState {
  activity: string
  beansGrams: string
  operatorId: string
}

const EMPTY_FORM: FormState = { activity: '', beansGrams: '', operatorId: '' }

const inputCls =
  'w-full border border-espresso-200 rounded-xl px-3.5 py-2.5 text-espresso-900 placeholder-espresso-300 focus:outline-none focus:border-espresso-400 focus:ring-2 focus:ring-espresso-400/20 transition-all bg-white text-sm'
const labelCls = 'block text-espresso-700 text-xs font-semibold uppercase tracking-wider mb-1.5'

export default function AdminMaintenanceBrews() {
  const [brews, setBrews] = useState<MaintenanceBrew[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const [operators, setOperators] = useState<Operator[]>([])
  const [operatorsError, setOperatorsError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const [showExport, setShowExport] = useState(false)
  const [exportRange, setExportRange] = useState({ from: '', to: '' })
  const [exportError, setExportError] = useState('')
  const [exporting, setExporting] = useState(false)

  function openExport() {
    setExportError('')
    setShowExport(true)
  }

  // Fetched rather than linked, so a rejected range shows as a message here
  // instead of the browser saving the error JSON as the "CSV".
  async function handleExport(e: React.FormEvent) {
    e.preventDefault()
    setExportError('')
    setExporting(true)
    try {
      const params = new URLSearchParams()
      if (exportRange.from) params.set('from', exportRange.from)
      if (exportRange.to) params.set('to', exportRange.to)
      const res = await fetch(`/api/admin/maintenance-brews/export?${params}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to export')
      }
      const filename =
        /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'maintenance-brews.csv'
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      setShowExport(false)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Failed to export')
    } finally {
      setExporting(false)
    }
  }

  const fetchBrews = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/maintenance-brews')
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || `Couldn't load maintenance brews (status ${res.status})`)
      if (!Array.isArray(data)) throw new Error('Unexpected response from server')
      setBrews(data)
    } catch (err) {
      console.error('Failed to load maintenance brews:', err)
      setBrews([])
      setError(err instanceof Error ? err.message : 'Failed to load maintenance brews')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchBrews() }, [fetchBrews])

  useEffect(() => {
    fetch('/api/admin/operators')
      .then(async res => {
        const data = await res.json().catch(() => null)
        if (!res.ok || !Array.isArray(data)) throw new Error(data?.error || 'Couldn’t load operators')
        setOperators(data)
      })
      .catch(err => setOperatorsError(err instanceof Error ? err.message : 'Couldn’t load operators'))
  }, [])

  function openForm() {
    setForm(EMPTY_FORM)
    setFormError('')
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    setSaving(true)
    try {
      const res = await fetch('/api/admin/maintenance-brews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity: form.activity,
          beansGrams: Number(form.beansGrams),
          operatorId: Number(form.operatorId),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to log brew')
      setShowForm(false)
      await fetchBrews()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to log brew')
    } finally {
      setSaving(false)
    }
  }

  async function closeBrew(b: MaintenanceBrew, status: ClosedStatus) {
    // Failed takes the brew's grams out of the total and can't be undone, and
    // it sits right next to Mark as done — worth one confirmation.
    if (status === 'failed' && !confirm(`Mark "${b.activity}" as failed? Its ${b.beans_grams} g won't count as beans used. This can't be undone.`)) {
      return
    }
    setBusyId(b.id)
    try {
      const res = await fetch(`/api/admin/maintenance-brews/${b.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      // 409 means someone (or an earlier click) already closed it — the
      // refresh below shows how, so it isn't worth an alert.
      if (!res.ok && res.status !== 409) {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'Failed to update brew')
      }
      await fetchBrews()
    } finally {
      setBusyId(null)
    }
  }

  const inProgress = brews.filter(b => b.status === 'in_progress').length
  const failed = brews.filter(b => b.status === 'failed').length

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="min-w-0 flex-1 basis-64">
          <h1 className="text-2xl font-bold text-espresso-900" style={{ fontFamily: 'Georgia, serif' }}>Maintenance Brews</h1>
          <p className="text-espresso-500 text-sm mt-1">Beans brewed for dialing in, cleaning, calibration and testing — never sold</p>
        </div>
        <div className="flex flex-shrink-0 gap-2">
          <button
            onClick={openExport}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-espresso-200 bg-white hover:border-espresso-400 text-espresso-800 text-sm font-bold transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
            Export CSV
          </button>
          <button
            onClick={openForm}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-espresso-900 hover:bg-espresso-700 text-espresso-50 text-sm font-bold transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Log Brew
          </button>
        </div>
      </div>

      {!loading && !error && brews.length > 0 && (
        <p className="text-espresso-500 text-xs mb-6 bg-white border border-espresso-100 rounded-xl px-4 py-3">
          <span className="font-semibold text-espresso-700">{brews.length} logged</span>
          {' · '}{gramsUsed(brews).toLocaleString('en-PH')} g of beans used · {inProgress} in progress
          {failed > 0 && <> · {failed} failed (not counted)</>}
        </p>
      )}

      {loading ? (
        <div className="text-center py-20 text-espresso-400">Loading maintenance brews…</div>
      ) : error ? (
        <div className="text-center py-20">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchBrews}
            className="px-4 py-1.5 rounded-full text-sm font-medium bg-espresso-900 text-espresso-50 hover:bg-espresso-800 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : brews.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-espresso-400 mb-4">No maintenance brews logged yet.</p>
          <button onClick={openForm} className="text-espresso-700 font-semibold text-sm underline underline-offset-4">
            Log the first one
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-espresso-100 overflow-hidden">
          {/* `relative` keeps the absolutely-positioned sr-only header inside
              the scroll box; without it, it escaped and widened the whole page
              to ~950px on a phone. */}
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-espresso-50">
                <tr>
                  {['Activity', 'Beans (g)', 'Assignee', 'Logged at', 'Status', 'Closed at', ''].map((h, i) => (
                    <th
                      key={h || i}
                      className={`px-5 py-3 text-xs font-semibold text-espresso-500 uppercase tracking-wider whitespace-nowrap ${
                        h === 'Beans (g)' ? 'text-right' : 'text-left'
                      }`}
                    >
                      {h || <span className="sr-only">Actions</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-espresso-50">
                {brews.map(b => {
                  const isBusy = busyId === b.id
                  const closedAt = b.done_at ?? b.failed_at
                  return (
                    <tr key={b.id} className="hover:bg-espresso-50/50 transition-colors align-top">
                      {/* overflow-wrap: anywhere, not break-words: only `anywhere`
                          lowers the column's min-content width, so a pasted URL
                          wraps instead of pushing the action buttons off-screen. */}
                      <td className="px-5 py-3 text-espresso-900 min-w-[14rem] [overflow-wrap:anywhere]">{b.activity}</td>
                      <td
                        className={`px-5 py-3 text-right font-semibold tabular-nums ${
                          b.status === 'failed' ? 'text-espresso-300 line-through' : 'text-espresso-900'
                        }`}
                        title={b.status === 'failed' ? 'Never brewed — not counted as beans used' : undefined}
                      >
                        {b.beans_grams.toLocaleString('en-PH')}
                      </td>
                      <td className="px-5 py-3 text-espresso-700 whitespace-nowrap">{b.operator_name}</td>
                      <td className="px-5 py-3 text-espresso-500 text-xs whitespace-nowrap"><ManilaTime iso={b.created_at} /></td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_STYLE[b.status]}`}>
                          {MAINTENANCE_STATUS_LABEL[b.status]}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-espresso-500 text-xs whitespace-nowrap">
                        {closedAt && <ManilaTime iso={closedAt} />}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        {/* Stacked, not side by side: two pills in a row
                            pushed the table past a 1280px screen. */}
                        {b.status === 'in_progress' && (
                          <div className="flex flex-col items-stretch gap-1.5">
                            <button
                              disabled={isBusy}
                              onClick={() => closeBrew(b, 'done')}
                              className="px-4 py-1.5 rounded-full text-xs font-bold bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50"
                            >
                              {isBusy ? '…' : 'Mark as done'}
                            </button>
                            <button
                              disabled={isBusy}
                              onClick={() => closeBrew(b, 'failed')}
                              className="px-4 py-1.5 rounded-full text-xs font-bold bg-red-100 hover:bg-red-200 text-red-700 transition-colors disabled:opacity-50"
                            >
                              Mark as failed
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-espresso-900/50 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
          <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-auto">
            <div className="px-6 py-5 border-b border-espresso-100 flex items-center justify-between">
              <h2 className="text-espresso-900 font-bold text-lg" style={{ fontFamily: 'Georgia, serif' }}>Log Brew</h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                aria-label="Close"
                className="text-espresso-400 hover:text-espresso-700 transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{formError}</div>
              )}

              <div>
                <label htmlFor="mb-activity" className={labelCls}>Activity *</label>
                <input
                  id="mb-activity"
                  value={form.activity}
                  onChange={e => setForm(f => ({ ...f, activity: e.target.value }))}
                  required
                  maxLength={ACTIVITY_MAX_LENGTH}
                  placeholder="Dialing in grinder after burr change"
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="mb-grams" className={labelCls}>Beans (grams) *</label>
                  <input
                    id="mb-grams"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={MAX_BEANS_GRAMS}
                    step={1}
                    value={form.beansGrams}
                    onChange={e => setForm(f => ({ ...f, beansGrams: e.target.value }))}
                    required
                    placeholder="18"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="mb-operator" className={labelCls}>Assignee *</label>
                  <select
                    id="mb-operator"
                    value={form.operatorId}
                    onChange={e => setForm(f => ({ ...f, operatorId: e.target.value }))}
                    required
                    disabled={operators.length === 0}
                    className={inputCls}
                  >
                    <option value="" disabled>{operators.length ? 'Choose…' : 'Loading…'}</option>
                    {operators.map(o => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              {operatorsError && <p className="text-red-600 text-xs -mt-2">{operatorsError}</p>}

              <p className="text-espresso-400 text-[11px]">
                Logged as In Progress. From the list, mark it done once the work is finished, or failed if it never happened.
              </p>
            </div>

            <div className="px-6 py-4 border-t border-espresso-100 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2.5 rounded-full text-sm font-bold text-espresso-600 hover:bg-espresso-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-full bg-espresso-900 hover:bg-espresso-700 disabled:opacity-60 text-espresso-50 text-sm font-bold transition-colors"
              >
                {saving ? 'Saving…' : 'Log Brew'}
              </button>
            </div>
          </form>
        </div>
      )}

      {showExport && (
        <div className="fixed inset-0 z-50 bg-espresso-900/50 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
          <form onSubmit={handleExport} className="bg-white rounded-2xl shadow-xl w-full max-w-md my-auto">
            <div className="px-6 py-5 border-b border-espresso-100 flex items-center justify-between">
              <h2 className="text-espresso-900 font-bold text-lg" style={{ fontFamily: 'Georgia, serif' }}>Export CSV</h2>
              <button
                type="button"
                onClick={() => setShowExport(false)}
                aria-label="Close"
                className="text-espresso-400 hover:text-espresso-700 transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {exportError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{exportError}</div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="mb-from" className={labelCls}>From</label>
                  <input
                    id="mb-from"
                    type="date"
                    value={exportRange.from}
                    max={exportRange.to || undefined}
                    onChange={e => setExportRange(r => ({ ...r, from: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="mb-to" className={labelCls}>To</label>
                  <input
                    id="mb-to"
                    type="date"
                    value={exportRange.to}
                    min={exportRange.from || undefined}
                    onChange={e => setExportRange(r => ({ ...r, to: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              </div>
              <p className="text-espresso-400 text-[11px]">
                By date logged, Philippine time, both days included. Leave both blank to export everything.
                Failed brews are included and marked &ldquo;Counted as used: No&rdquo;.
              </p>
            </div>

            <div className="px-6 py-4 border-t border-espresso-100 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowExport(false)}
                className="px-5 py-2.5 rounded-full text-sm font-bold text-espresso-600 hover:bg-espresso-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={exporting}
                className="px-6 py-2.5 rounded-full bg-espresso-900 hover:bg-espresso-700 disabled:opacity-60 text-espresso-50 text-sm font-bold transition-colors"
              >
                {exporting ? 'Preparing…' : 'Download CSV'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
