'use client'

import { useCallback, useEffect, useState } from 'react'
import { voucherLabel, type DiscountType, type Voucher } from '@/lib/vouchers'

/* ── Manila time ─────────────────────────────────────────────────────────
   <input type="datetime-local"> has no timezone — the browser reads and
   writes wall-clock time in whatever zone the machine is set to. The shop
   runs on Manila time, so both directions are pinned to Asia/Manila
   explicitly rather than inherited from the admin's clock. PH has had no DST
   since 1978, so a fixed +08:00 is exact, not an approximation. */
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000

function isoToManilaInput(iso: string | null): string {
  if (!iso) return ''
  return new Date(new Date(iso).getTime() + MANILA_OFFSET_MS).toISOString().slice(0, 16)
}

function manilaInputToIso(local: string): string | null {
  if (!local) return null
  // Read the wall-clock string as if it were UTC, then shift back by the
  // Manila offset to get the real instant.
  return new Date(new Date(`${local}:00Z`).getTime() - MANILA_OFFSET_MS).toISOString()
}

function formatManila(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

/* ── State badge ─────────────────────────────────────────────────────── */

type VoucherState = 'active' | 'inactive' | 'scheduled' | 'expired' | 'used-up'

const STATE_STYLE: Record<VoucherState, { label: string; color: string }> = {
  active:     { label: 'Active',    color: 'bg-green-100 text-green-800 border-green-200' },
  scheduled:  { label: 'Scheduled', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  expired:    { label: 'Expired',   color: 'bg-gray-100 text-gray-600 border-gray-200' },
  'used-up':  { label: 'Used up',   color: 'bg-orange-100 text-orange-800 border-orange-200' },
  inactive:   { label: 'Inactive',  color: 'bg-gray-100 text-gray-600 border-gray-200' },
}

// Mirrors checkVoucherRules() in lib/vouchers.ts — the reason a voucher would
// be rejected at checkout, surfaced as a badge so admin can see at a glance
// why a code isn't working without having to try it.
function voucherState(v: Voucher, now: Date): VoucherState {
  if (!v.is_active) return 'inactive'
  if (v.starts_at && now < new Date(v.starts_at)) return 'scheduled'
  if (v.expires_at && now >= new Date(v.expires_at)) return 'expired'
  if (v.max_redemptions != null && v.redemption_count >= v.max_redemptions) return 'used-up'
  return 'active'
}

/* ── Form ────────────────────────────────────────────────────────────── */

interface FormState {
  code: string
  description: string
  discount_type: DiscountType
  discount_value: string
  max_discount: string
  min_subtotal: string
  max_redemptions: string
  once_per_email: boolean
  starts_at: string
  expires_at: string
  is_active: boolean
}

const EMPTY_FORM: FormState = {
  code: '', description: '', discount_type: 'percent', discount_value: '',
  max_discount: '', min_subtotal: '', max_redemptions: '',
  once_per_email: false, starts_at: '', expires_at: '', is_active: true,
}

function formFrom(v: Voucher): FormState {
  return {
    code: v.code,
    description: v.description,
    discount_type: v.discount_type,
    discount_value: v.discount_type === 'free_shipping' ? '' : String(v.discount_value),
    max_discount: v.max_discount == null ? '' : String(v.max_discount),
    min_subtotal: v.min_subtotal ? String(v.min_subtotal) : '',
    max_redemptions: v.max_redemptions == null ? '' : String(v.max_redemptions),
    once_per_email: v.once_per_email,
    starts_at: isoToManilaInput(v.starts_at),
    expires_at: isoToManilaInput(v.expires_at),
    is_active: v.is_active,
  }
}

const TYPE_OPTIONS: { value: DiscountType; label: string; hint: string }[] = [
  { value: 'percent', label: '% off', hint: 'Percentage off the items subtotal' },
  { value: 'fixed', label: '₱ off', hint: 'Fixed peso amount off the items subtotal' },
  { value: 'free_shipping', label: 'Free delivery', hint: 'Waives the delivery fee' },
]

const inputCls =
  'w-full border border-espresso-200 rounded-xl px-3.5 py-2.5 text-espresso-900 placeholder-espresso-300 focus:outline-none focus:border-espresso-400 focus:ring-2 focus:ring-espresso-400/20 transition-all bg-white text-sm'
const labelCls = 'block text-espresso-700 text-xs font-semibold uppercase tracking-wider mb-1.5'

export default function AdminVouchers() {
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const [editing, setEditing] = useState<Voucher | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchVouchers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/vouchers')
      if (!res.ok) throw new Error(`Couldn't load vouchers (status ${res.status})`)
      const data = await res.json()
      if (!Array.isArray(data)) throw new Error('Unexpected response from server')
      setVouchers(data)
    } catch (err) {
      console.error('Failed to load vouchers:', err)
      setVouchers([])
      setError(err instanceof Error ? err.message : 'Failed to load vouchers')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchVouchers() }, [fetchVouchers])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setShowForm(true)
  }

  function openEdit(v: Voucher) {
    setEditing(v)
    setForm(formFrom(v))
    setFormError('')
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    setSaving(true)
    try {
      const payload = {
        code: form.code,
        description: form.description,
        discount_type: form.discount_type,
        discount_value: form.discount_type === 'free_shipping' ? 0 : Number(form.discount_value),
        max_discount: form.max_discount === '' ? null : Number(form.max_discount),
        min_subtotal: form.min_subtotal === '' ? 0 : Number(form.min_subtotal),
        max_redemptions: form.max_redemptions === '' ? null : Number(form.max_redemptions),
        once_per_email: form.once_per_email,
        starts_at: manilaInputToIso(form.starts_at),
        expires_at: manilaInputToIso(form.expires_at),
        is_active: form.is_active,
      }
      const res = await fetch(
        editing ? `/api/admin/vouchers/${editing.id}` : '/api/admin/vouchers',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save voucher')
      setShowForm(false)
      await fetchVouchers()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save voucher')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(v: Voucher) {
    setBusyId(v.id)
    try {
      await fetch(`/api/admin/vouchers/${v.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !v.is_active }),
      })
      await fetchVouchers()
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(v: Voucher) {
    if (!confirm(`Delete voucher ${v.code}? This can't be undone.`)) return
    setBusyId(v.id)
    try {
      const res = await fetch(`/api/admin/vouchers/${v.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'Failed to delete voucher')
        return
      }
      await fetchVouchers()
    } finally {
      setBusyId(null)
    }
  }

  const now = new Date()

  return (
    <div className="p-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-espresso-900" style={{ fontFamily: 'Georgia, serif' }}>Vouchers</h1>
          <p className="text-espresso-500 text-sm mt-1">Create and manage discount codes customers redeem at checkout</p>
        </div>
        <button
          onClick={openCreate}
          className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-espresso-900 hover:bg-espresso-700 text-espresso-50 text-sm font-bold transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          New Voucher
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-espresso-400">Loading vouchers…</div>
      ) : error ? (
        <div className="text-center py-20">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchVouchers}
            className="px-4 py-1.5 rounded-full text-sm font-medium bg-espresso-900 text-espresso-50 hover:bg-espresso-800 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : vouchers.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-espresso-400 mb-4">No vouchers yet.</p>
          <button onClick={openCreate} className="text-espresso-700 font-semibold text-sm underline underline-offset-4">
            Create your first one
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {vouchers.map(v => {
            const state = voucherState(v, now)
            const style = STATE_STYLE[state]
            const isBusy = busyId === v.id
            const rules = [
              v.min_subtotal > 0 ? `Min. spend ₱${v.min_subtotal.toLocaleString()}` : null,
              v.once_per_email ? 'One per customer' : null,
              v.starts_at ? `From ${formatManila(v.starts_at)}` : null,
              v.expires_at ? `Until ${formatManila(v.expires_at)}` : null,
            ].filter(Boolean) as string[]

            return (
              <div key={v.id} className="bg-white rounded-2xl shadow-sm border border-espresso-100 overflow-hidden">
                <div className="px-6 py-4 flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap mb-1">
                      <span className="font-mono font-bold text-espresso-900 tracking-wide">{v.code}</span>
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${style.color}`}>
                        {style.label}
                      </span>
                      <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-espresso-50 border border-espresso-200 text-espresso-700">
                        {voucherLabel(v)}
                      </span>
                    </div>
                    {v.description && <p className="text-espresso-600 text-sm mb-1.5">{v.description}</p>}
                    {rules.length > 0 && (
                      <p className="text-espresso-400 text-xs">{rules.join(' · ')}</p>
                    )}
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="text-espresso-900 font-bold text-lg leading-none">
                      {v.redemption_count}
                      <span className="text-espresso-400 font-medium text-sm">
                        {v.max_redemptions != null ? ` / ${v.max_redemptions}` : ''}
                      </span>
                    </p>
                    <p className="text-espresso-400 text-xs mt-1">
                      redeemed{v.max_redemptions == null ? ' · unlimited' : ''}
                    </p>
                  </div>
                </div>

                <div className="px-6 py-3 border-t border-espresso-100 flex flex-wrap gap-2 items-center">
                  <button
                    disabled={isBusy}
                    onClick={() => openEdit(v)}
                    className="px-4 py-1.5 rounded-full text-xs font-bold bg-espresso-100 hover:bg-espresso-200 text-espresso-700 transition-colors disabled:opacity-50"
                  >
                    Edit
                  </button>
                  <button
                    disabled={isBusy}
                    onClick={() => toggleActive(v)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors disabled:opacity-50 ${
                      v.is_active
                        ? 'bg-orange-100 hover:bg-orange-200 text-orange-800'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    {isBusy ? '…' : v.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  {/* Redeemed vouchers are order history — the API refuses to
                      delete them, so don't offer a button that only errors. */}
                  {v.redemption_count === 0 && (
                    <button
                      disabled={isBusy}
                      onClick={() => handleDelete(v)}
                      className="px-4 py-1.5 rounded-full text-xs font-bold bg-red-100 hover:bg-red-200 text-red-700 transition-colors disabled:opacity-50 ml-auto"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-espresso-900/50 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
          <form
            onSubmit={handleSave}
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-auto"
          >
            <div className="px-6 py-5 border-b border-espresso-100 flex items-center justify-between">
              <h2 className="text-espresso-900 font-bold text-lg" style={{ fontFamily: 'Georgia, serif' }}>
                {editing ? `Edit ${editing.code}` : 'New Voucher'}
              </h2>
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
                <label htmlFor="v-code" className={labelCls}>Code *</label>
                <input
                  id="v-code"
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  required
                  autoCapitalize="characters"
                  spellCheck={false}
                  placeholder="WELCOME10"
                  className={`${inputCls} font-mono tracking-wide uppercase`}
                />
                <p className="text-espresso-400 text-[11px] mt-1">
                  3–32 characters: letters, numbers, dash or underscore. Longer codes are harder to guess.
                </p>
              </div>

              <div>
                <label htmlFor="v-desc" className={labelCls}>Description</label>
                <input
                  id="v-desc"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Welcome offer for first-time buyers"
                  className={inputCls}
                />
                <p className="text-espresso-400 text-[11px] mt-1">Shown to the customer on the checkout summary.</p>
              </div>

              <div>
                <span className={labelCls}>Discount type *</span>
                <div className="grid grid-cols-3 gap-2">
                  {TYPE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      title={opt.hint}
                      onClick={() => setForm(f => ({ ...f, discount_type: opt.value }))}
                      aria-pressed={form.discount_type === opt.value}
                      className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-colors ${
                        form.discount_type === opt.value
                          ? 'bg-espresso-900 border-espresso-900 text-espresso-50'
                          : 'bg-white border-espresso-200 text-espresso-700 hover:border-espresso-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {form.discount_type !== 'free_shipping' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="v-value" className={labelCls}>
                      {form.discount_type === 'percent' ? 'Percentage *' : 'Amount off (₱) *'}
                    </label>
                    <input
                      id="v-value"
                      type="number"
                      min={1}
                      max={form.discount_type === 'percent' ? 100 : undefined}
                      step={1}
                      value={form.discount_value}
                      onChange={e => setForm(f => ({ ...f, discount_value: e.target.value }))}
                      required
                      placeholder={form.discount_type === 'percent' ? '10' : '100'}
                      className={inputCls}
                    />
                  </div>
                  {form.discount_type === 'percent' && (
                    <div>
                      <label htmlFor="v-cap" className={labelCls}>Max discount (₱)</label>
                      <input
                        id="v-cap"
                        type="number"
                        min={1}
                        step={1}
                        value={form.max_discount}
                        onChange={e => setForm(f => ({ ...f, max_discount: e.target.value }))}
                        placeholder="No cap"
                        className={inputCls}
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="v-min" className={labelCls}>Min. spend (₱)</label>
                  <input
                    id="v-min"
                    type="number"
                    min={0}
                    step={1}
                    value={form.min_subtotal}
                    onChange={e => setForm(f => ({ ...f, min_subtotal: e.target.value }))}
                    placeholder="No minimum"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="v-max" className={labelCls}>Redemption limit</label>
                  <input
                    id="v-max"
                    type="number"
                    min={1}
                    step={1}
                    value={form.max_redemptions}
                    onChange={e => setForm(f => ({ ...f, max_redemptions: e.target.value }))}
                    placeholder="Unlimited"
                    className={inputCls}
                  />
                  {editing && editing.redemption_count > 0 && (
                    <p className="text-espresso-400 text-[11px] mt-1">Already redeemed {editing.redemption_count}×.</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="v-start" className={labelCls}>Starts</label>
                  <input
                    id="v-start"
                    type="datetime-local"
                    value={form.starts_at}
                    onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="v-end" className={labelCls}>Expires</label>
                  <input
                    id="v-end"
                    type="datetime-local"
                    value={form.expires_at}
                    onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <p className="col-span-2 text-espresso-400 text-[11px] -mt-2">
                  Philippine time (UTC+8). Leave blank for no start / no expiry.
                </p>
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.once_per_email}
                  onChange={e => setForm(f => ({ ...f, once_per_email: e.target.checked }))}
                  className="mt-0.5 w-4 h-4 accent-espresso-900"
                />
                <span>
                  <span className="text-espresso-900 text-sm font-semibold">One use per customer</span>
                  <span className="block text-espresso-400 text-[11px]">
                    Matched on the email address given at checkout — there are no accounts.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                  className="mt-0.5 w-4 h-4 accent-espresso-900"
                />
                <span>
                  <span className="text-espresso-900 text-sm font-semibold">Active</span>
                  <span className="block text-espresso-400 text-[11px]">Customers can only redeem an active voucher.</span>
                </span>
              </label>
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
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Voucher'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
