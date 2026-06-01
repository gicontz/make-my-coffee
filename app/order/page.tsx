'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useCart } from '@/context/CartContext'
import Link from 'next/link'
import bottleImg from '@/app/assets/bottle.png'

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
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  province: '',
  postalCode: '',
  notes: '',
}

const inputCls =
  'w-full border border-espresso-200 rounded-xl px-4 py-3 text-espresso-900 placeholder-espresso-300 focus:outline-none focus:border-espresso-400 focus:ring-2 focus:ring-espresso-400/20 transition-all bg-white text-sm'

export default function OrderPage() {
  const { items, total, clearCart } = useCart()
  const [form, setForm] = useState<Form>(INITIAL_FORM)
  const [orderPlaced, setOrderPlaced] = useState(false)

  const shipping = total >= 1000 ? 0 : 99
  const orderTotal = total + shipping

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setOrderPlaced(true)
    clearCart()
  }

  /* ── Success screen ── */
  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-espresso-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <h2
            className="text-espresso-900 text-3xl font-bold mb-3"
            style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
          >
            Order Received!
          </h2>
          <p className="text-espresso-600 mb-2">
            Thank you! We'll reach out to <span className="font-semibold text-espresso-800">{form.email}</span> once your Aconchego shots are on their way.
          </p>
          <p className="text-espresso-400 text-sm mb-8">
            Payment processing is coming soon — we'll confirm your details via email.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-espresso-900 hover:bg-espresso-700 text-espresso-50 font-bold px-8 py-4 rounded-full transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    )
  }

  /* ── Empty cart guard ── */
  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-espresso-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <h2
            className="text-espresso-900 text-2xl font-bold mb-3"
            style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
          >
            Nothing to order
          </h2>
          <p className="text-espresso-500 mb-8">Your cart is empty. Add some espresso shots first!</p>
          <Link href="/shop" className="inline-flex items-center gap-2 bg-espresso-900 hover:bg-espresso-700 text-espresso-50 font-bold px-8 py-4 rounded-full transition-colors">
            Go to Shop
          </Link>
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
          <h1
            className="text-4xl font-bold text-espresso-50"
            style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
          >
            Place Your Order
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

            {/* ── Left: form ── */}
            <div className="lg:col-span-3 space-y-6">

              {/* Contact */}
              <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-espresso-100">
                <h2
                  className="text-espresso-900 font-bold text-xl mb-6 flex items-center gap-3"
                  style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
                >
                  <span className="w-8 h-8 rounded-full bg-espresso-400 text-espresso-900 text-sm font-bold flex items-center justify-center flex-shrink-0">1</span>
                  Contact Information
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-espresso-700 text-xs font-semibold uppercase tracking-wider mb-1.5">First Name *</label>
                    <input type="text" name="firstName" value={form.firstName} onChange={handleChange} required className={inputCls} placeholder="Juan" />
                  </div>
                  <div>
                    <label className="block text-espresso-700 text-xs font-semibold uppercase tracking-wider mb-1.5">Last Name *</label>
                    <input type="text" name="lastName" value={form.lastName} onChange={handleChange} required className={inputCls} placeholder="dela Cruz" />
                  </div>
                  <div>
                    <label className="block text-espresso-700 text-xs font-semibold uppercase tracking-wider mb-1.5">Email *</label>
                    <input type="email" name="email" value={form.email} onChange={handleChange} required className={inputCls} placeholder="juan@example.com" />
                  </div>
                  <div>
                    <label className="block text-espresso-700 text-xs font-semibold uppercase tracking-wider mb-1.5">Phone *</label>
                    <input type="tel" name="phone" value={form.phone} onChange={handleChange} required className={inputCls} placeholder="+63 912 345 6789" />
                  </div>
                </div>
              </div>

              {/* Delivery */}
              <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-espresso-100">
                <h2
                  className="text-espresso-900 font-bold text-xl mb-6 flex items-center gap-3"
                  style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
                >
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
                      <input type="text" name="city" value={form.city} onChange={handleChange} required className={inputCls} placeholder="Manila" />
                    </div>
                    <div>
                      <label className="block text-espresso-700 text-xs font-semibold uppercase tracking-wider mb-1.5">Province *</label>
                      <input type="text" name="province" value={form.province} onChange={handleChange} required className={inputCls} placeholder="Metro Manila" />
                    </div>
                    <div>
                      <label className="block text-espresso-700 text-xs font-semibold uppercase tracking-wider mb-1.5">Postal Code *</label>
                      <input type="text" name="postalCode" value={form.postalCode} onChange={handleChange} required className={inputCls} placeholder="1000" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-espresso-700 text-xs font-semibold uppercase tracking-wider mb-1.5">Order Notes (optional)</label>
                    <textarea
                      name="notes"
                      value={form.notes}
                      onChange={handleChange}
                      rows={3}
                      className={`${inputCls} resize-none`}
                      placeholder="Any special instructions for your order..."
                    />
                  </div>
                </div>
              </div>

              {/* Payment placeholder */}
              <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-espresso-100">
                <h2
                  className="text-espresso-900 font-bold text-xl mb-6 flex items-center gap-3"
                  style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
                >
                  <span className="w-8 h-8 rounded-full bg-espresso-400 text-espresso-900 text-sm font-bold flex items-center justify-center flex-shrink-0">3</span>
                  Payment
                </h2>

                <div className="border-2 border-dashed border-espresso-200 rounded-2xl p-8 text-center">
                  {/* PayPal logo-ish */}
                  <div className="w-14 h-14 bg-[#003087]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="#003087">
                      <path d="M7.076 21.337H2.47a.641.641 0 01-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 00-.607-.541c-.013.076-.026.175-.041.254-.59 3.025-2.566 6.082-8.558 6.082h-2.19a.973.973 0 00-.96.82L7.686 21.337h3.653l.93-5.89a.973.973 0 01.96-.82h.619c3.925 0 6.993-1.595 7.892-6.203.35-1.793.108-3.265-.518-4.307z"/>
                    </svg>
                  </div>
                  <h3
                    className="text-espresso-900 font-bold text-lg mb-2"
                    style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
                  >
                    PayPal
                  </h3>
                  <p className="text-espresso-400 text-sm mb-4">Secure payment via PayPal — coming soon.</p>
                  <div className="inline-flex items-center gap-1.5 bg-espresso-50 border border-espresso-200 text-espresso-400 text-xs px-4 py-2 rounded-full">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="8" x2="12" y2="12"/>
                      <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    Payment integration in progress
                  </div>
                </div>
              </div>
            </div>

            {/* ── Right: summary ── */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-sm border border-espresso-100 p-6 sticky top-24">
                <h2
                  className="text-espresso-900 font-bold text-xl mb-6"
                  style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
                >
                  Order Summary
                </h2>

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
                  <div className="flex justify-between text-sm">
                    <span className="text-espresso-500">Tax</span>
                    <span className="text-espresso-400 text-xs">Calculated at payment</span>
                  </div>
                </div>

                <div className="border-t border-espresso-200 pt-4 mb-6">
                  <div className="flex justify-between">
                    <span className="text-espresso-900 font-bold text-lg">Total</span>
                    <span className="text-espresso-900 font-bold text-xl">₱{orderTotal.toLocaleString()}</span>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 bg-espresso-900 hover:bg-espresso-700 text-espresso-50 font-bold py-4 rounded-full transition-colors shadow-lg text-base"
                >
                  Place Order
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
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
                    Guaranteed
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
