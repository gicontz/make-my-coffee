'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useCart } from '@/context/CartContext'
import Link from 'next/link'
import bottleImg from '@/app/assets/bottle.png'
import { FLAT_SHIPPING_FEE, isFreeShippingEligible, type ShippingQuote } from '@/lib/shipping'
import { PROVINCES, citiesFor, zipFor, zipMayVaryByArea } from '@/lib/phLocations'
import { PERIOD_LABEL, DELIVERY_SLOT_IDS, slotsInPeriod, slotLabel, validateDeliverySlots, type SlotPeriod } from '@/lib/deliverySlots'
import { isValidCode, normalizeCode, type AppliedVoucher } from '@/lib/vouchers'
import type { LatLng, SuggestionPrecision } from '@/components/DeliveryMapPicker'

// Leaflet needs `window` — load client-only, no SSR.
const DeliveryMapPicker = dynamic(() => import('@/components/DeliveryMapPicker'), {
  ssr: false,
  loading: () => <div className="h-64 rounded-xl border border-espresso-200 bg-espresso-50 animate-pulse" />,
})

type Form = {
  firstName: string
  lastName: string
  email: string
  phone: string
  province: string
  city: string
  barangay: string
  address: string
  postalCode: string
  notes: string
}

const INITIAL_FORM: Form = {
  firstName: '', lastName: '', email: '', phone: '',
  province: '', city: '', barangay: '', address: '', postalCode: '', notes: '',
}

const inputCls =
  'w-full border border-espresso-200 rounded-xl px-4 py-3 text-espresso-900 placeholder-espresso-300 focus:outline-none focus:border-espresso-400 focus:ring-2 focus:ring-espresso-400/20 transition-all bg-white text-sm'

export default function OrderPage() {
  const { items, total, clearCart } = useCart()
  const [form, setForm] = useState<Form>(INITIAL_FORM)
  const [deliverySlots, setDeliverySlots] = useState<string[]>([])
  const [orderId, setOrderId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Map pin — the reliable source for the dropoff point (see
  // components/DeliveryMapPicker.tsx). geocodeSuggestion pre-fills it as the
  // customer fills in the structured address fields below.
  const [pin, setPin] = useState<LatLng | null>(null)
  const [geocodeSuggestion, setGeocodeSuggestion] = useState<LatLng | null>(null)
  const [geocodePrecision, setGeocodePrecision] = useState<SuggestionPrecision | null>(null)

  // Live delivery-fee quote. Starts at the flat rate; once province+city are
  // set, a debounced call to /api/shipping/quote asks Lalamove to price the
  // actual distance (using the pin once one exists). Never authoritative —
  // POST /api/orders recomputes the real fee server-side regardless of this.
  const [shippingQuote, setShippingQuote] = useState<ShippingQuote | null>(null)
  const [quoting, setQuoting] = useState(false)

  // Voucher. Like the shipping quote above, this is a *preview* — POST
  // /api/orders re-looks-up the code, re-prices it and takes the redemption
  // slot itself, so nothing here decides what the customer is charged.
  const [voucherInput, setVoucherInput] = useState('')
  const [voucher, setVoucher] = useState<AppliedVoucher | null>(null)
  const [voucherError, setVoucherError] = useState('')
  const [checkingVoucher, setCheckingVoucher] = useState(false)

  const quotedShipping = shippingQuote?.fee ?? FLAT_SHIPPING_FEE
  const shipping = voucher?.freeShipping ? 0 : quotedShipping
  const discount = voucher?.discount ?? 0
  const orderTotal = total - discount + shipping

  // The success screen renders after clearCart(), so `total` is already 0 by
  // then — snapshot what the customer owes at submit time instead of
  // recomputing it from an emptied cart.
  const [placedTotal, setPlacedTotal] = useState(0)

  // guard: don't run on server
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])

  // Pre-fills the map pin from the structured address as the customer types
  // — a starting guess only; DeliveryMapPicker stops applying these once the
  // customer drags/taps the map themselves.
  useEffect(() => {
    if (!form.city || !form.province) {
      setGeocodeSuggestion(null)
      setGeocodePrecision(null)
      return
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/geocode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address: form.address, barangay: form.barangay, city: form.city, province: form.province, postalCode: form.postalCode,
          }),
        })
        const data = await res.json()
        setGeocodeSuggestion(res.ok ? data.coords : null)
        setGeocodePrecision(res.ok ? data.precision : null)
      } catch {
        setGeocodeSuggestion(null)
        setGeocodePrecision(null)
      }
    }, 700)
    return () => clearTimeout(timer)
  }, [form.address, form.barangay, form.city, form.province, form.postalCode])

  useEffect(() => {
    if (!form.city || !form.province) {
      setShippingQuote(null)
      return
    }
    setQuoting(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/shipping/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address: form.address, barangay: form.barangay, city: form.city, province: form.province, postalCode: form.postalCode,
            lat: pin?.lat, lng: pin?.lng,
            subtotal: total,
          }),
        })
        setShippingQuote(res.ok ? await res.json() : null)
      } catch {
        setShippingQuote(null)
      } finally {
        setQuoting(false)
      }
    }, 600)
    return () => clearTimeout(timer)
  }, [form.address, form.barangay, form.city, form.province, form.postalCode, pin?.lat, pin?.lng, total])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  // Tracks the last postal code we auto-filled, so a later city change can
  // tell "customer typed their own zip" apart from "still showing our guess"
  // and only overwrite the latter.
  const lastAutoZip = useRef('')

  function handleProvinceChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const province = e.target.value
    lastAutoZip.current = ''
    // A different province means any existing pin no longer applies — clear
    // it so the map re-suggests fresh instead of silently keeping a pin from
    // the old location (see the `key` on DeliveryMapPicker below, which also
    // resets its "customer moved this manually" lock for the same reason).
    setPin(null)
    setForm(prev => ({ ...prev, province, city: '', postalCode: '' }))
  }

  function handleCityChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const city = e.target.value
    setPin(null)
    setForm(prev => {
      const zip = zipFor(prev.province, city)
      // Only auto-fill/replace the postal code if the customer hasn't typed
      // their own — never clobber a manual edit.
      const shouldAutoFill = !!zip && (prev.postalCode === '' || prev.postalCode === lastAutoZip.current)
      if (shouldAutoFill) lastAutoZip.current = zip!
      return { ...prev, city, postalCode: shouldAutoFill ? zip! : prev.postalCode }
    })
  }

  function toggleSlot(id: string) {
    setDeliverySlots(prev => (prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]))
  }

  const allSlotsSelected = deliverySlots.length === DELIVERY_SLOT_IDS.length
  function toggleAllDay() {
    setDeliverySlots(allSlotsSelected ? [] : [...DELIVERY_SLOT_IDS])
  }

  const hasMorningSlot = deliverySlots.some(id => slotsInPeriod('morning').some(s => s.id === id))
  const hasAfternoonSlot = deliverySlots.some(id => slotsInPeriod('afternoon').some(s => s.id === id))

  async function applyVoucherCode() {
    const code = normalizeCode(voucherInput)
    setVoucherError('')

    if (!isValidCode(code)) {
      setVoucherError('Enter a valid voucher code.')
      return
    }

    setCheckingVoucher(true)
    try {
      const res = await fetch('/api/vouchers/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Email is sent so a once-per-customer voucher can be rejected here
        // rather than at the very end of checkout. It may still be blank at
        // this point — the server treats it as optional.
        body: JSON.stringify({ code, subtotal: total, email: form.email }),
      })
      const data = await res.json()
      if (!res.ok) {
        setVoucher(null)
        setVoucherError(data.error || 'That voucher code isn’t valid.')
        return
      }
      setVoucher(data)
      setVoucherInput(code)
    } catch {
      setVoucherError('Couldn’t check that voucher. Please try again.')
    } finally {
      setCheckingVoucher(false)
    }
  }

  function removeVoucher() {
    setVoucher(null)
    setVoucherInput('')
    setVoucherError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const slotError = validateDeliverySlots(deliverySlots)
    if (slotError) {
      setError(slotError)
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: { ...form, lat: pin?.lat, lng: pin?.lng },
          items: items.map(i => ({
            id: i.product.id,
            name: i.product.name,
            shots: i.product.shots,
            price: i.product.price,
            quantity: i.quantity,
          })),
          subtotal: total,
          deliverySlots,
          voucherCode: voucher?.code ?? null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to place order')
      setPlacedTotal(orderTotal)
      clearCart()
      setOrderId(data.orderId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  /* ── Success ── */
  if (orderId) {
    return (
      <div className="min-h-screen bg-espresso-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <h2 className="text-espresso-900 text-3xl font-bold mb-2" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
            Order Placed!
          </h2>
          <p className="text-espresso-500 text-sm mb-1">Order <span className="font-semibold text-espresso-700">#{orderId}</span></p>
          <p className="text-espresso-600 mb-2">
            A confirmation has been sent to <span className="font-semibold">{form.email}</span>.
          </p>
          {deliverySlots.length > 0 && (
            <p className="text-espresso-500 text-sm mb-2">
              Delivery window: <span className="font-semibold text-espresso-700">
                {[...deliverySlots].sort().map(slotLabel).join(', ')}
              </span>
            </p>
          )}
          <p className="text-espresso-400 text-sm mb-8">
            Payment is <strong>Cash on Delivery</strong>. Please have ₱{placedTotal.toLocaleString()} ready when your order arrives.
          </p>
          <Link href="/" className="inline-flex items-center gap-2 bg-espresso-900 hover:bg-espresso-700 text-espresso-50 font-bold px-8 py-4 rounded-full transition-colors">
            Back to Home
          </Link>
        </div>
      </div>
    )
  }

  /* ── Empty cart ── */
  if (hydrated && items.length === 0) {
    return (
      <div className="min-h-screen bg-espresso-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <h2 className="text-espresso-900 text-2xl font-bold mb-3" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>Nothing to order</h2>
          <p className="text-espresso-500 mb-8">Your cart is empty.</p>
          <Link href="/shop" className="inline-flex items-center gap-2 bg-espresso-900 hover:bg-espresso-700 text-espresso-50 font-bold px-8 py-4 rounded-full transition-colors">Go to Shop</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-espresso-50">
      {/* Header */}
      <div className="bg-espresso-900 py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2 text-espresso-500 text-sm mb-4">
            <Link href="/cart" className="hover:text-espresso-300 transition-colors">Cart</Link>
            <span>›</span>
            <span className="text-espresso-300">Checkout</span>
          </div>
          <h1 className="text-4xl font-bold text-espresso-50" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
            Place Your Order
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* ── Left: form ── */}
            <div className="lg:col-span-3 space-y-6">

              {/* Contact */}
              <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-espresso-100">
                <h2 className="text-espresso-900 font-bold text-xl mb-6 flex items-center gap-3" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
                  <span className="w-8 h-8 rounded-full bg-espresso-400 text-espresso-900 text-sm font-bold flex items-center justify-center flex-shrink-0">1</span>
                  Contact Information
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {([['firstName','First Name','Juan'], ['lastName','Last Name','dela Cruz'], ['email','Email','juan@example.com'], ['phone','Phone','+63 912 345 6789']] as [keyof Form, string, string][]).map(([name, label, ph]) => (
                    <div key={name}>
                      <label className="block text-espresso-700 text-xs font-semibold uppercase tracking-wider mb-1.5">{label} *</label>
                      <input type={name === 'email' ? 'email' : name === 'phone' ? 'tel' : 'text'} name={name} value={form[name]} onChange={handleChange} required className={inputCls} placeholder={ph} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Delivery */}
              <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-espresso-100">
                <h2 className="text-espresso-900 font-bold text-xl mb-6 flex items-center gap-3" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
                  <span className="w-8 h-8 rounded-full bg-espresso-400 text-espresso-900 text-sm font-bold flex items-center justify-center flex-shrink-0">2</span>
                  Delivery Address
                </h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-espresso-700 text-xs font-semibold uppercase tracking-wider mb-1.5">Province *</label>
                      <select name="province" value={form.province} onChange={handleProvinceChange} required className={inputCls}>
                        <option value="">Select province</option>
                        {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-espresso-700 text-xs font-semibold uppercase tracking-wider mb-1.5">City / Municipality *</label>
                      <select
                        name="city"
                        value={form.city}
                        onChange={handleCityChange}
                        required
                        disabled={!form.province}
                        className={`${inputCls} disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <option value="">{form.province ? 'Select city / municipality' : 'Select province first'}</option>
                        {citiesFor(form.province).map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-espresso-700 text-xs font-semibold uppercase tracking-wider mb-1.5">Barangay *</label>
                      <input type="text" name="barangay" value={form.barangay} onChange={handleChange} required className={inputCls} placeholder="San Antonio" />
                    </div>
                    <div>
                      <label className="block text-espresso-700 text-xs font-semibold uppercase tracking-wider mb-1.5">Postal Code *</label>
                      <input type="text" name="postalCode" value={form.postalCode} onChange={handleChange} required className={inputCls} placeholder="1600" />
                      {zipMayVaryByArea(form.province) && form.city && (
                        <p className="text-espresso-400 text-[11px] mt-1">Default for {form.city} — adjust if your barangay uses a different code.</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-espresso-700 text-xs font-semibold uppercase tracking-wider mb-1.5">House No. / Street / Subdivision *</label>
                    <input type="text" name="address" value={form.address} onChange={handleChange} required className={inputCls} placeholder="Blk 17 Lt 7 Zone 1, Rizal Street" />
                  </div>
                  {/* Free shipping nudge */}
                  {form.city && isFreeShippingEligible(form.city, total) && (
                    <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-green-700 text-sm flex items-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                      Free delivery to Pasig City on orders ₱1,000+!
                    </div>
                  )}
                  <div>
                    <label className="block text-espresso-700 text-xs font-semibold uppercase tracking-wider mb-1.5">Pin Your Exact Location</label>
                    <DeliveryMapPicker
                      key={`${form.province}|${form.city}`}
                      value={pin}
                      onChange={setPin}
                      suggestedCenter={geocodeSuggestion}
                      suggestedPrecision={geocodePrecision}
                    />
                  </div>
                  <div>
                    <label className="block text-espresso-700 text-xs font-semibold uppercase tracking-wider mb-1.5">Notes (optional)</label>
                    <textarea name="notes" value={form.notes} onChange={handleChange} rows={3} className={`${inputCls} resize-none`} placeholder="Any special instructions…" />
                  </div>
                </div>
              </div>

              {/* Delivery Time */}
              <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-espresso-100">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <h2 className="text-espresso-900 font-bold text-xl flex items-center gap-3" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
                    <span className="w-8 h-8 rounded-full bg-espresso-400 text-espresso-900 text-sm font-bold flex items-center justify-center flex-shrink-0">3</span>
                    Delivery Time
                  </h2>
                  <button
                    type="button"
                    onClick={toggleAllDay}
                    className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
                      allSlotsSelected
                        ? 'bg-espresso-900 text-espresso-50 hover:bg-espresso-700'
                        : 'bg-espresso-100 text-espresso-700 hover:bg-espresso-200'
                    }`}
                  >
                    {allSlotsSelected ? 'Clear All' : 'All Day'}
                  </button>
                </div>
                <p className="text-espresso-500 text-sm mb-5">
                  We deliver between 9:00 AM and 7:00 PM. Choose at least one morning and one afternoon–evening time — pick more if you're flexible.
                </p>

                {(['morning', 'afternoon'] as SlotPeriod[]).map(period => (
                  <div key={period} className="mb-5 last:mb-0">
                    <div className="flex items-center gap-2 mb-2.5">
                      <p className="text-espresso-700 text-xs font-semibold uppercase tracking-wider">{PERIOD_LABEL[period]}</p>
                      {(period === 'morning' ? hasMorningSlot : hasAfternoonSlot) && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {slotsInPeriod(period).map(slot => {
                        const selected = deliverySlots.includes(slot.id)
                        return (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => toggleSlot(slot.id)}
                            aria-pressed={selected}
                            className={`px-3.5 py-2 rounded-full text-xs font-semibold border transition-colors ${
                              selected
                                ? 'bg-espresso-900 border-espresso-900 text-espresso-50'
                                : 'bg-white border-espresso-200 text-espresso-700 hover:border-espresso-400'
                            }`}
                          >
                            {slot.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* COD */}
              <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-espresso-100">
                <h2 className="text-espresso-900 font-bold text-xl mb-5 flex items-center gap-3" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
                  <span className="w-8 h-8 rounded-full bg-espresso-400 text-espresso-900 text-sm font-bold flex items-center justify-center flex-shrink-0">4</span>
                  Payment
                </h2>
                <div className="flex items-start gap-4 bg-espresso-50 border border-espresso-200 rounded-2xl p-5">
                  <div className="w-12 h-12 bg-espresso-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5C3317" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="6" width="20" height="12" rx="2"/>
                      <circle cx="12" cy="12" r="2"/>
                      <path d="M6 12h.01M18 12h.01"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-espresso-900 font-bold mb-1">Cash on Delivery</p>
                    <p className="text-espresso-600 text-sm">Pay in cash when your order arrives. No upfront payment required.</p>
                  </div>
                  <div className="ml-auto flex-shrink-0">
                    <div className="w-5 h-5 rounded-full border-2 border-espresso-400 bg-espresso-400 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Right: summary ── */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-sm border border-espresso-100 p-6 sticky top-24">
                <h2 className="text-espresso-900 font-bold text-xl mb-6" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>Order Summary</h2>

                <div className="space-y-4 mb-5">
                  {items.map(item => (
                    <div key={item.product.id} className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-espresso-100 rounded-xl flex-shrink-0 relative overflow-hidden">
                        <Image src={bottleImg} alt={item.product.name} fill className="object-contain p-1" />
                        <div className="absolute bottom-0.5 right-0.5 bg-espresso-900/80 text-espresso-50 rounded-full px-1.5 py-px pointer-events-none">
                          <span className="font-bold text-[9px]" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>{item.product.shots}s</span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-espresso-900 font-semibold text-sm truncate">{item.product.name}</p>
                        <p className="text-espresso-400 text-xs">× {item.quantity}</p>
                      </div>
                      <span className="text-espresso-900 font-semibold text-sm flex-shrink-0">
                        ₱{(item.product.price * item.quantity).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Voucher */}
                <div className="border-t border-espresso-100 pt-4 mb-4">
                  {voucher ? (
                    <div className="bg-green-50 border border-green-200 rounded-xl px-3.5 py-3">
                      <div className="flex items-start gap-2.5">
                        <svg className="flex-shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        <div className="flex-1 min-w-0">
                          <p className="text-green-800 font-bold text-sm font-mono truncate">{voucher.code}</p>
                          <p className="text-green-700 text-xs">{voucher.description || voucher.label}</p>
                        </div>
                        <button
                          type="button"
                          onClick={removeVoucher}
                          className="flex-shrink-0 text-green-700 hover:text-green-900 text-xs font-semibold underline underline-offset-2"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <label htmlFor="voucher" className="block text-espresso-700 text-xs font-semibold uppercase tracking-wider mb-1.5">
                        Voucher Code
                      </label>
                      <div className="flex gap-2">
                        <input
                          id="voucher"
                          type="text"
                          value={voucherInput}
                          onChange={e => { setVoucherInput(e.target.value); setVoucherError('') }}
                          // The voucher field lives inside the checkout <form>, so a
                          // bare Enter here would place the order instead of applying
                          // the code. Intercept it.
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              applyVoucherCode()
                            }
                          }}
                          autoComplete="off"
                          autoCapitalize="characters"
                          spellCheck={false}
                          placeholder="Enter code"
                          aria-invalid={!!voucherError}
                          aria-describedby={voucherError ? 'voucher-error' : undefined}
                          className={`${inputCls} flex-1 min-w-0 uppercase font-mono tracking-wide`}
                        />
                        <button
                          type="button"
                          onClick={applyVoucherCode}
                          disabled={checkingVoucher || !voucherInput.trim()}
                          className="flex-shrink-0 px-5 rounded-xl bg-espresso-100 hover:bg-espresso-200 disabled:opacity-50 disabled:cursor-not-allowed text-espresso-700 text-sm font-bold transition-colors"
                        >
                          {checkingVoucher ? '…' : 'Apply'}
                        </button>
                      </div>
                      {voucherError && (
                        <p id="voucher-error" role="alert" className="text-red-600 text-xs mt-1.5">{voucherError}</p>
                      )}
                    </>
                  )}
                </div>

                <div className="border-t border-espresso-100 pt-4 mb-4 space-y-2.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-espresso-500">Subtotal</span>
                    <span className="text-espresso-900 font-medium">₱{total.toLocaleString()}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-green-600">Voucher discount</span>
                      <span className="text-green-600 font-semibold">− ₱{discount.toLocaleString()}</span>
                    </div>
                  )}
                  <div>
                    <div className="flex justify-between text-sm">
                      <span className="text-espresso-500">Shipping</span>
                      <span className={shipping === 0 ? 'text-green-600 font-semibold' : 'text-espresso-900 font-medium'}>
                        {quoting ? 'Calculating…' : shipping === 0 ? (
                          <>
                            {voucher?.freeShipping && quotedShipping > 0 && (
                              <span className="text-espresso-300 line-through font-normal mr-1.5">₱{quotedShipping}</span>
                            )}
                            Free
                          </>
                        ) : `₱${shipping}`}
                      </span>
                    </div>
                    {!quoting && shippingQuote?.source === 'lalamove' && (
                      <p className="text-espresso-400 text-xs text-right mt-0.5">
                        Live rider pricing{shippingQuote.distanceKm != null ? ` · ${shippingQuote.distanceKm.toFixed(1)} km` : ''}
                      </p>
                    )}
                  </div>
                </div>

                <div className="border-t border-espresso-200 pt-4 mb-6">
                  <div className="flex justify-between">
                    <span className="text-espresso-900 font-bold text-lg">Total (COD)</span>
                    <span className="text-espresso-900 font-bold text-xl">₱{orderTotal.toLocaleString()}</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || quoting}
                  className="w-full flex items-center justify-center gap-2 bg-espresso-900 hover:bg-espresso-700 disabled:opacity-60 text-espresso-50 font-bold py-4 rounded-full transition-colors shadow-lg text-base"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12a9 9 0 11-6.219-8.56"/>
                      </svg>
                      Placing Order…
                    </>
                  ) : quoting ? (
                    <>
                      <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12a9 9 0 11-6.219-8.56"/>
                      </svg>
                      Calculating Delivery Fee…
                    </>
                  ) : (
                    <>
                      Place Order
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                      </svg>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-center gap-5 mt-4 text-espresso-400 text-[11px]">
                  <span className="flex items-center gap-1">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                    Secure
                  </span>
                  <span className="flex items-center gap-1">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    Protected
                  </span>
                  <span className="flex items-center gap-1">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                    COD
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
