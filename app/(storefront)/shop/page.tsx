'use client'

import { useState } from 'react'
import Image from 'next/image'
import { products } from '@/lib/products'
import type { Product } from '@/lib/products'
import { useCart } from '@/context/CartContext'
import Link from 'next/link'
import bottleImg from '@/app/assets/bottle.png'

export default function ShopPage() {
  const { addToCart } = useCart()
  const [added, setAdded] = useState<Record<string, boolean>>({})

  function handleAdd(product: Product) {
    addToCart(product)
    setAdded(prev => ({ ...prev, [product.id]: true }))
    setTimeout(() => setAdded(prev => ({ ...prev, [product.id]: false })), 1600)
  }

  return (
    <div className="min-h-screen bg-espresso-50">
      {/* Page header */}
      <div className="bg-espresso-900 py-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <span className="text-espresso-400 text-sm font-semibold tracking-widest uppercase mb-4 block">
            Pure Espresso
          </span>
          <h1
            className="text-5xl font-bold text-espresso-50 mb-4"
            style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
          >
            Our Collection
          </h1>
          <p className="text-espresso-300 text-lg max-w-xl mx-auto">
            Three sizes, one exceptional Aconchego bean. Pick the bottle that fits your flow.
          </p>
        </div>
      </div>

      {/* Products grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {products.map(product => (
            <div
              key={product.id}
              className="relative bg-white rounded-3xl overflow-hidden shadow-sm border border-espresso-100 hover:shadow-xl transition-all duration-300 flex flex-col"
            >
              {product.badge && (
                <div className="absolute top-5 right-5 z-10 bg-espresso-400 text-espresso-900 text-xs font-bold px-3 py-1.5 rounded-full shadow">
                  {product.badge}
                </div>
              )}

              {/* Product visual */}
              <div className="h-64 bg-espresso-50 flex items-center justify-center relative overflow-hidden">
                <Image
                  src={bottleImg}
                  alt={product.name}
                  fill
                  className="object-contain p-4 group-hover:scale-105 transition-transform duration-500"
                />
                {/* Shot count pill */}
                <div className="absolute bottom-3 right-3 z-10 bg-espresso-900/80 backdrop-blur-sm text-espresso-50 rounded-full px-3 py-1 flex items-center gap-1.5 pointer-events-none">
                  <span className="font-bold text-base" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>{product.shots}</span>
                  <span className="text-espresso-400 text-[10px] uppercase tracking-widest">shots</span>
                </div>
              </div>

              {/* Content */}
              <div className="p-7 flex flex-col flex-1">
                <h2
                  className="text-espresso-900 font-bold text-2xl mb-1"
                  style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
                >
                  {product.name}
                </h2>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-espresso-400 text-sm font-semibold">{product.shots} shots</span>
                  <span className="text-espresso-300">·</span>
                  <span className="text-espresso-500 text-sm">{product.volume}</span>
                </div>

                <p className="text-espresso-600 leading-relaxed mb-5 flex-1">{product.description}</p>

                {/* Tasting notes */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {['Dark Chocolate', 'Brown Sugar', 'Smooth'].map(note => (
                    <span key={note} className="bg-espresso-50 text-espresso-600 text-xs px-3 py-1 rounded-full border border-espresso-200">
                      {note}
                    </span>
                  ))}
                </div>

                {/* Price + CTA */}
                <div className="flex items-end justify-between pt-4 border-t border-espresso-100">
                  <div>
                    <div className="text-espresso-400 text-xs font-medium mb-0.5">Per bottle</div>
                    <div className="text-espresso-900 text-3xl font-bold">₱{product.price.toLocaleString()}</div>
                    <div className="text-espresso-400 text-xs">₱{Math.round(product.price / product.shots)} per shot</div>
                  </div>

                  <button
                    onClick={() => handleAdd(product)}
                    className={`flex items-center gap-2 font-bold px-6 py-3 rounded-full transition-all duration-300 shadow-md text-sm ${
                      added[product.id]
                        ? 'bg-green-500 text-white scale-95 shadow-green-200'
                        : 'bg-espresso-900 hover:bg-espresso-700 text-espresso-50 hover:scale-105 hover:shadow-lg'
                    }`}
                  >
                    {added[product.id] ? (
                      <>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Added!
                      </>
                    ) : (
                      <>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
                          <line x1="3" y1="6" x2="21" y2="6"/>
                          <path d="M16 10a4 4 0 01-8 0"/>
                        </svg>
                        Add to Cart
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Info banner */}
        <div className="mt-14 bg-espresso-900 rounded-3xl p-8 sm:p-12 text-center">
          <h3
            className="text-espresso-50 text-2xl font-bold mb-3"
            style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
          >
            Free shipping on orders over ₱1,000
          </h3>
          <p className="text-espresso-400 max-w-lg mx-auto">
            All bottles are sealed and shipped fresh. Best consumed within 7 days of opening for peak flavor.
          </p>
          <div className="mt-6">
            <Link href="/cart" className="inline-flex items-center gap-2 text-espresso-400 hover:text-espresso-300 text-sm font-medium transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 01-8 0"/>
              </svg>
              View cart
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
