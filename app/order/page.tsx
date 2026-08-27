'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useCart } from '@/context/CartContext'
import Link from 'next/link'
import bottleImg from '@/app/assets/bottle.png'
import { calcShipping } from '@/lib/shipping'
import { PERIOD_LABEL, DELIVERY_SLOT_IDS, slotsInPeriod, slotLabel, validateDeliverySlots, type SlotPeriod } from '@/lib/deliverySlots'

type Form = {
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  city: string
  province: string
  postalCode: string
  notes: string
}

const INITIAL_FORM: Form = {
  firstName: '', lastName: '', email: '', phone: '',
  address: '', city: '', province: '', postalCode: '', notes: '',
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

  const shipping = calcShipping(form.city, total)
  const orderTotal = total + shipping

  // guard: don't run on server
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
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
          customer: form,
          items: items.map(i => ({
            id: i.product.id,
            name: i.product.name,
            shots: i.product.shots,
            price: i.product.price,
            quantity: i.quantity,
          })),
          subtotal: total,
          deliverySlots,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to place order')
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
            Payment is <strong>Cash on Delivery</strong>. Please have ₱{orderTotal.toLocaleString()} ready when your order arrives.
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
                  <div>
                    <label className="block text-espresso-700 text-xs font-semibold uppercase tracking-wider mb-1.5">Street Address *</label>
                    <input type="text" name="address" value={form.address} onChange={handleChange} required className={inputCls} placeholder="123 Rizal Street, Brgy. San Antonio" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-espresso-700 text-xs font-semibold uppercase tracking-wider mb-1.5">City *</label>
                      <input type="text" name="city" value={form.city} onChange={handleChange} required className={inputCls} placeholder="Pasig" />
                    </div>
                    <div>
                      <label className="block text-espresso-700 text-xs font-semibold uppercase tracking-wider mb-1.5">Province *</label>
                      <input type="text" name="province" value={form.province} onChange={handleChange} required className={inputCls} placeholder="Metro Manila" />
                    </div>
                    <div>
                      <label className="block text-espresso-700 text-xs font-semibold uppercase tracking-wider mb-1.5">Postal Code *</label>
                      <input type="text" name="postalCode" value={form.postalCode} onChange={handleChange} required className={inputCls} placeholder="1600" />
                    </div>
                  </div>
                  {/* Free shipping nudge */}
                  {form.city && calcShipping(form.city, total) === 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-green-700 text-sm flex items-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                      Free delivery to Pasig City on orders ₱1,000+!
                    </div>
                  )}
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

                <div className="border-t border-espresso-100 pt-4 mb-4 space-y-2.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-espresso-500">Subtotal</span>
                    <span className="text-espresso-900 font-medium">₱{total.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-espresso-500">Shipping</span>
                    <span className={shipping === 0 ? 'text-green-600 font-semibold' : 'text-espresso-900 font-medium'}>
                      {shipping === 0 ? 'Free' : `₱${shipping}`}
                    </span>
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
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-espresso-900 hover:bg-espresso-700 disabled:opacity-60 text-espresso-50 font-bold py-4 rounded-full transition-colors shadow-lg text-base"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12a9 9 0 11-6.219-8.56"/>
                      </svg>
                      Placing Order…
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
