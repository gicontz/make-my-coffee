'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { products } from '@/lib/products'
import type { Product } from '@/lib/products'
import { useCart } from '@/context/CartContext'
import heroSplash from '@/app/assets/hero_splash.png'
import bottleImg from '@/app/assets/bottle.png'

/* Label anchor points as % of the image container — one per bottle (left → center → right) */
const LABEL_ANCHORS = [
  { left: '14%', top: '52%' },   // left bottle
  { left: '47%', top: '44%' },   // center bottle (taller)
  { left: '78%', top: '52%' },   // right bottle
]

export default function HeroSection() {
  const { addToCart } = useCart()
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [modalProduct, setModalProduct] = useState<Product | null>(null)
  const [addedInModal, setAddedInModal] = useState(false)

  function handleAddToCart() {
    if (!modalProduct) return
    addToCart(modalProduct)
    setAddedInModal(true)
    setTimeout(() => {
      setAddedInModal(false)
      setModalProduct(null)
    }, 1300)
  }

  return (
    <>
      {/* ── HERO ── */}
      <section className="relative min-h-screen flex items-center overflow-hidden bg-espresso-900">
        {/* Subtle radial glow behind image */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[55%] h-[80%] rounded-full bg-espresso-800/40 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 w-full">
          <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-0">

            {/* ── Left: copy ── */}
            <div className="flex-1 max-w-xl lg:pr-8">
              <div className="inline-flex items-center gap-2 bg-espresso-800/80 border border-espresso-700 backdrop-blur-sm rounded-full px-4 py-1.5 mb-8">
                <span className="w-2 h-2 rounded-full bg-espresso-400 animate-pulse" />
                <span className="text-espresso-300 text-xs tracking-widest uppercase font-medium">
                  Signature Blend · Aconchego
                </span>
              </div>

              <h1
                className="text-5xl sm:text-6xl lg:text-7xl font-bold text-espresso-50 leading-[1.08] mb-6"
                style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
              >
                Espresso,<br />
                <span className="text-espresso-400">Your Way.</span>
              </h1>

              <p className="text-espresso-300 text-lg sm:text-xl leading-relaxed mb-10 max-w-lg">
                Pure 30ml espresso shots from our signature Aconchego blend. No machine needed — just your creativity.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/shop"
                  className="inline-flex items-center justify-center gap-2 bg-espresso-400 hover:bg-espresso-500 text-espresso-900 font-bold px-8 py-4 rounded-full transition-colors text-base shadow-lg shadow-espresso-400/20"
                >
                  Shop Now
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center justify-center gap-2 border-2 border-espresso-600 hover:border-espresso-400 text-espresso-200 hover:text-espresso-100 font-semibold px-8 py-4 rounded-full transition-colors text-base"
                >
                  How It Works
                </a>
              </div>
            </div>

            {/* ── Right: image + overlaid bottle labels ── */}
            <div className="flex-1 relative flex items-center justify-center min-h-[380px] lg:min-h-[480px] w-full">
              {/* The image — transparent PNG, blends into dark bg */}
              <div className="relative w-full max-w-[540px]">
                <Image
                  src={heroSplash}
                  alt="Aconchego espresso bottles"
                  priority
                  quality={90}
                  className="w-full h-auto object-contain drop-shadow-2xl"
                />

                {/* Labels pinned to each bottle */}
                {products.map((p, i) => {
                  const isHovered = hoveredId === p.id
                  const anchor = LABEL_ANCHORS[i]

                  return (
                    <div
                      key={p.id}
                      className="absolute z-10 -translate-x-1/2 cursor-pointer"
                      style={{
                        left: anchor.left,
                        top: anchor.top,
                        transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
                        transform: `translateX(-50%) ${isHovered ? 'scale(1.08) translateY(-6px)' : 'scale(1)'}`,
                      }}
                      onMouseEnter={() => setHoveredId(p.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      onClick={() => { setModalProduct(p); setAddedInModal(false) }}
                    >
                      {/* Connector dot */}
                      <div className="flex flex-col items-center mb-1.5">
                        <div
                          className="w-2.5 h-2.5 rounded-full border-2 border-espresso-400 transition-all duration-300"
                          style={{
                            background: isHovered ? '#C8860A' : 'transparent',
                            boxShadow: isHovered ? '0 0 8px #C8860A80' : 'none',
                          }}
                        />
                        <div
                          className="w-px bg-espresso-600 transition-all duration-300"
                          style={{ height: isHovered ? '12px' : '8px' }}
                        />
                      </div>

                      {/* Label card */}
                      <div
                        className="overflow-hidden rounded-2xl border transition-all duration-300"
                        style={{
                          background: isHovered
                            ? 'rgba(28,10,0,0.92)'
                            : 'rgba(28,10,0,0.72)',
                          borderColor: isHovered ? '#C8860A80' : '#5C331760',
                          backdropFilter: 'blur(12px)',
                          boxShadow: isHovered
                            ? '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px #C8860A30'
                            : '0 4px 16px rgba(0,0,0,0.4)',
                          width: isHovered ? '130px' : '72px',
                          padding: isHovered ? '12px 14px' : '8px 10px',
                        }}
                      >
                        {/* Shot count — always visible */}
                        <div className="flex items-baseline gap-1 justify-center">
                          <span
                            className="font-bold leading-none transition-all duration-250"
                            style={{
                              fontFamily: 'var(--font-playfair), Georgia, serif',
                              color: isHovered ? '#F5E6D3' : '#C8860A',
                              fontSize: isHovered ? '1.6rem' : '1.3rem',
                            }}
                          >
                            {p.shots}
                          </span>
                          <span
                            className="uppercase tracking-wider font-semibold transition-all duration-250"
                            style={{
                              color: isHovered ? '#E8C9A0' : '#8B5E0A',
                              fontSize: isHovered ? '9px' : '8px',
                            }}
                          >
                            shots
                          </span>
                        </div>

                        {/* Expanded info on hover */}
                        <div
                          className="overflow-hidden transition-all duration-300"
                          style={{ maxHeight: isHovered ? '80px' : '0px', opacity: isHovered ? 1 : 0 }}
                        >
                          <div className="mt-2 pt-2 border-t border-espresso-700/60">
                            <p
                              className="text-espresso-200 font-semibold text-center leading-tight mb-1"
                              style={{ fontSize: '11px', fontFamily: 'var(--font-playfair), Georgia, serif' }}
                            >
                              {p.name}
                            </p>
                            <p className="text-espresso-400 font-bold text-center" style={{ fontSize: '12px' }}>
                              ₱{p.price.toLocaleString()}
                            </p>
                            <p className="text-espresso-600 text-center mt-1.5 flex items-center justify-center gap-1" style={{ fontSize: '9px' }}>
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="12" y1="8" x2="12" y2="16"/>
                                <line x1="8" y1="12" x2="16" y2="12"/>
                              </svg>
                              tap to add
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Badge above */}
                      {p.badge && (
                        <div
                          className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap transition-opacity duration-200"
                          style={{ opacity: isHovered ? 1 : 0 }}
                        >
                          <span className="bg-espresso-400 text-espresso-900 text-[9px] font-bold px-2 py-0.5 rounded-full">
                            {p.badge}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

          </div>
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-espresso-600 z-10">
          <span className="text-[10px] tracking-widest uppercase">Scroll</span>
          <div className="w-px h-8 bg-espresso-700 overflow-hidden relative">
            <div className="absolute inset-x-0 top-0 h-1/2 bg-espresso-500 animate-bounce" />
          </div>
        </div>
      </section>

      {/* ── ADD TO CART MODAL ── */}
      {modalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
            onClick={() => setModalProduct(null)}
          />

          {/* Panel */}
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
            {/* Top visual */}
            <div className="h-52 bg-espresso-100 flex items-center justify-center relative overflow-hidden">
              <Image
                src={bottleImg}
                alt={modalProduct.name}
                fill
                className="object-contain p-4"
              />
              {/* Shot count pill — bottom-right */}
              <div className="absolute bottom-3 right-3 z-10 bg-espresso-900/80 backdrop-blur-sm text-espresso-50 rounded-full px-3 py-1 flex items-center gap-1.5">
                <span className="font-bold text-sm" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>{modalProduct.shots}</span>
                <span className="text-espresso-400 text-[10px] uppercase tracking-widest">shots</span>
              </div>

              {/* Close */}
              <button
                onClick={() => setModalProduct(null)}
                className="absolute top-4 right-4 w-8 h-8 bg-espresso-800/80 hover:bg-espresso-700 text-espresso-300 hover:text-espresso-50 rounded-full flex items-center justify-center transition-colors z-20"
                aria-label="Close"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>

              {modalProduct.badge && (
                <div className="absolute top-4 left-4 bg-espresso-400 text-espresso-900 text-xs font-bold px-3 py-1 rounded-full z-20">
                  {modalProduct.badge}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-6">
              <h2
                className="text-espresso-900 text-2xl font-bold mb-1"
                style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
              >
                {modalProduct.name}
              </h2>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-espresso-400 text-sm font-semibold">{modalProduct.shots} shots</span>
                <span className="text-espresso-300">·</span>
                <span className="text-espresso-500 text-sm">{modalProduct.volume}</span>
              </div>
              <p className="text-espresso-600 text-sm leading-relaxed mb-4">{modalProduct.description}</p>

              <div className="flex flex-wrap gap-1.5 mb-5">
                {['Dark Chocolate', 'Brown Sugar', 'Smooth'].map(n => (
                  <span key={n} className="bg-espresso-50 text-espresso-600 text-xs px-2.5 py-1 rounded-full border border-espresso-200">
                    {n}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-espresso-400 text-xs mb-0.5">Per bottle</div>
                  <div className="text-espresso-900 text-3xl font-bold">₱{modalProduct.price.toLocaleString()}</div>
                  <div className="text-espresso-400 text-xs">₱{Math.round(modalProduct.price / modalProduct.shots)} / shot</div>
                </div>

                <button
                  onClick={handleAddToCart}
                  className={`flex items-center gap-2 font-bold px-6 py-3 rounded-full transition-all duration-300 text-sm shadow-lg ${
                    addedInModal
                      ? 'bg-green-500 text-white scale-95'
                      : 'bg-espresso-400 hover:bg-espresso-500 text-espresso-900 hover:scale-105'
                  }`}
                >
                  {addedInModal ? (
                    <>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
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
        </div>
      )}
    </>
  )
}
