'use client'

import Image from 'next/image'
import { useCart } from '@/context/CartContext'
import Link from 'next/link'
import bottleImg from '@/app/assets/bottle.png'

export default function CartPage() {
  const { items, removeFromCart, updateQuantity, total, itemCount } = useCart()
  const shipping = total >= 1000 ? 0 : 99

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-espresso-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-24 h-24 bg-espresso-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#5C3317" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 01-8 0"/>
            </svg>
          </div>
          <h2 className="text-espresso-900 text-3xl font-bold mb-3" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
            Your cart is empty
          </h2>
          <p className="text-espresso-500 mb-8">You haven't added any espresso shots yet.</p>
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 bg-espresso-900 hover:bg-espresso-700 text-espresso-50 font-bold px-8 py-4 rounded-full transition-colors"
          >
            Browse Our Collection
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
          <h1
            className="text-4xl font-bold text-espresso-50 mb-1"
            style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
          >
            Your Cart
          </h1>
          <p className="text-espresso-400">
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Items */}
          <div className="lg:col-span-2 space-y-4">
            {items.map(item => (
              <div
                key={item.product.id}
                className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-espresso-100 flex flex-col sm:flex-row gap-4"
              >
                {/* Thumbnail */}
                <div className="w-full sm:w-24 h-24 bg-espresso-100 rounded-xl flex-shrink-0 relative overflow-hidden">
                  <Image src={bottleImg} alt={item.product.name} fill className="object-contain p-1.5" />
                  <div className="absolute bottom-1.5 right-1.5 bg-espresso-900/80 backdrop-blur-sm text-espresso-50 rounded-full px-2 py-0.5 flex items-center gap-1 pointer-events-none">
                    <span className="font-bold text-xs" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>{item.product.shots}</span>
                    <span className="text-espresso-400 text-[8px] uppercase tracking-wider">shots</span>
                  </div>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-1">
                    <div>
                      <h3
                        className="text-espresso-900 font-bold text-lg leading-snug"
                        style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
                      >
                        {item.product.name}
                      </h3>
                      <p className="text-espresso-500 text-sm">{item.product.volume} · Aconchego Blend</p>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-espresso-300 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5"
                      aria-label="Remove"
                    >
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                      </svg>
                    </button>
                  </div>

                  <div className="flex items-center justify-between mt-4">
                    {/* Qty control */}
                    <div className="inline-flex items-center gap-1 bg-espresso-50 border border-espresso-200 rounded-full p-1">
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        className="w-8 h-8 flex items-center justify-center text-espresso-600 hover:text-espresso-900 hover:bg-espresso-100 rounded-full transition-colors font-bold text-lg"
                      >
                        −
                      </button>
                      <span className="w-9 text-center text-espresso-900 font-semibold text-sm">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        className="w-8 h-8 flex items-center justify-center text-espresso-600 hover:text-espresso-900 hover:bg-espresso-100 rounded-full transition-colors font-bold text-lg"
                      >
                        +
                      </button>
                    </div>

                    <div className="text-right">
                      <div className="text-espresso-900 font-bold text-xl">
                        ₱{(item.product.price * item.quantity).toLocaleString()}
                      </div>
                      {item.quantity > 1 && (
                        <div className="text-espresso-400 text-xs">₱{item.product.price.toLocaleString()} each</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <Link
              href="/shop"
              className="inline-flex items-center gap-2 text-espresso-500 hover:text-espresso-700 text-sm font-medium transition-colors mt-2"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              Continue Shopping
            </Link>
          </div>

          {/* Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-espresso-100 p-6 sticky top-24">
              <h2
                className="text-espresso-900 font-bold text-xl mb-6"
                style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
              >
                Order Summary
              </h2>

              <div className="space-y-2.5 mb-5">
                {items.map(item => (
                  <div key={item.product.id} className="flex justify-between text-sm">
                    <span className="text-espresso-600 truncate pr-2">
                      {item.product.name} × {item.quantity}
                    </span>
                    <span className="text-espresso-900 font-medium flex-shrink-0">
                      ₱{(item.product.price * item.quantity).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-espresso-100 pt-4 mb-5 space-y-2.5">
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
                {total < 30 && (
                  <div className="bg-espresso-50 rounded-lg p-2.5 text-xs text-espresso-500">
                    Add <span className="font-semibold text-espresso-700">₱{(1000 - total).toLocaleString()}</span> more for free shipping!
                  </div>
                )}
              </div>

              <div className="border-t border-espresso-200 pt-4 mb-6">
                <div className="flex justify-between">
                  <span className="text-espresso-900 font-bold text-lg">Total</span>
                  <span className="text-espresso-900 font-bold text-xl">
                    ₱{(total + shipping).toLocaleString()}
                  </span>
                </div>
              </div>

              <Link
                href="/order"
                className="w-full flex items-center justify-center gap-2 bg-espresso-400 hover:bg-espresso-500 text-espresso-900 font-bold py-4 rounded-full transition-colors shadow-lg shadow-espresso-400/20 text-base"
              >
                Proceed to Checkout
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </Link>

              <p className="text-espresso-400 text-xs text-center mt-4">Secure checkout · Your order is protected</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
