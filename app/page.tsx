import Link from 'next/link'
import Image from 'next/image'
import { products } from '@/lib/products'
import HeroSection from '@/components/HeroSection'
import bottleImg from '@/app/assets/bottle.png'
import classicLatte from '@/app/assets/flavors/classic_latte.png'
import honeyOat from '@/app/assets/flavors/honey_oat.png'
import caramel from '@/app/assets/flavors/caramel.png'
import tonic from '@/app/assets/flavors/tonic.png'

const mixtures = [
  {
    name: 'Classic Latte',
    recipe: '1 shot · 150ml steamed milk',
    note: 'Smooth, simple, perfect.',
    image: classicLatte,
  },
  {
    name: 'Honey Oat Latte',
    recipe: '1 shot · oat milk · 1 tsp honey',
    note: 'Naturally sweet with a nutty finish.',
    image: honeyOat,
  },
  {
    name: 'Iced Caramel Delight',
    recipe: '2 shots · ice · milk · caramel',
    note: 'Cool, rich, and indulgent.',
    image: caramel,
  },
  {
    name: 'Espresso Tonic',
    recipe: '1 shot · tonic water · ice · citrus',
    note: 'Bold meets bright — surprisingly refreshing.',
    image: tonic,
  },
]

export default function HomePage() {
  return (
    <>
      <HeroSection />

      {/* ── PRODUCTS PREVIEW ── */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2
              className="text-4xl font-bold text-espresso-900 mb-4"
              style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
            >
              Choose Your Bottle
            </h2>
            <p className="text-espresso-600 text-lg max-w-lg mx-auto">
              Start small or go all in. Every bottle holds the same pure Aconchego blend.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {products.map(product => (
              <div
                key={product.id}
                className="relative bg-espresso-50 rounded-2xl overflow-hidden border border-espresso-100 hover:border-espresso-300 hover:shadow-lg transition-all duration-300"
              >
                {product.badge && (
                  <div className="absolute top-4 right-4 z-10 bg-espresso-400 text-espresso-900 text-xs font-bold px-3 py-1 rounded-full">
                    {product.badge}
                  </div>
                )}
                {/* Visual */}
                <div className="h-48 bg-espresso-100 flex items-center justify-center relative overflow-hidden">
                  <Image
                    src={bottleImg}
                    alt={product.name}
                    fill
                    className="object-contain p-3"
                  />
                  <div className="absolute bottom-2 right-2 z-10 bg-espresso-900/80 backdrop-blur-sm text-espresso-50 rounded-full px-2.5 py-0.5 flex items-center gap-1 pointer-events-none">
                    <span className="font-bold text-sm" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>{product.shots}</span>
                    <span className="text-espresso-400 text-[9px] uppercase tracking-widest">shots</span>
                  </div>
                </div>
                <div className="p-6">
                  <h3
                    className="text-espresso-900 font-bold text-xl mb-1"
                    style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
                  >
                    {product.name}
                  </h3>
                  <p className="text-espresso-600 text-sm leading-relaxed mb-4 line-clamp-2">{product.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-espresso-900 text-2xl font-bold">₱{product.price.toLocaleString()}</span>
                    <Link
                      href="/shop"
                      className="bg-espresso-900 hover:bg-espresso-700 text-espresso-50 text-sm font-semibold px-4 py-2 rounded-full transition-colors"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link href="/shop" className="inline-flex items-center gap-2 text-espresso-400 hover:text-espresso-600 font-semibold transition-colors">
              See full collection
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ── BEAN STORY ── */}
      <section className="py-24 bg-espresso-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Visual card */}
            <div className="relative">
              <div className="w-full h-80 lg:h-96 bg-gradient-to-br from-espresso-700 via-espresso-800 to-espresso-900 rounded-3xl overflow-hidden shadow-2xl flex items-center justify-center relative">
                <div className="absolute top-8 right-8 w-32 h-32 rounded-full bg-espresso-600/20" />
                <div className="absolute bottom-6 left-6 w-20 h-20 rounded-full bg-espresso-600/15" />
                <div className="text-center z-10">
                  <div className="text-7xl mb-4 select-none">🫘</div>
                  <p className="text-espresso-500 text-xs tracking-widest uppercase mb-1">Signature Blend</p>
                  <p
                    className="text-espresso-300 text-3xl font-bold"
                    style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
                  >
                    Aconchego
                  </p>
                  <p className="text-espresso-500 text-sm mt-1">Cambodia × Indonesia</p>
                </div>
              </div>
              {/* Floating tag */}
              <div className="absolute -bottom-5 -right-4 bg-white rounded-2xl shadow-lg border border-espresso-100 px-5 py-3">
                <p className="text-espresso-400 font-bold text-sm">Signature Blend</p>
                <p className="text-espresso-500 text-xs">Cambodia × Indonesia</p>
              </div>
            </div>

            {/* Text */}
            <div>
              <span className="text-espresso-400 text-sm font-semibold tracking-widest uppercase mb-4 block">
                The Blend Story
              </span>
              <h2
                className="text-4xl font-bold text-espresso-900 mb-6 leading-snug"
                style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
              >
                Meet Aconchego,<br />
                <span className="text-espresso-400">Our Signature Soul</span>
              </h2>
              <p className="text-espresso-700 text-lg leading-relaxed mb-5">
                "Aconchego" is a Portuguese word meaning warmth, comfort, and the feeling of being welcomed. It's everything we wanted our espresso to be.
              </p>
              <p className="text-espresso-600 leading-relaxed mb-8">
                A carefully crafted blend of beans from Cambodia and Indonesia, roasted to reveal their natural richness — notes of dark chocolate, brown sugar, and a soft, lingering finish that makes every sip feel like home.
              </p>
              <div className="flex flex-wrap gap-3">
                {['Dark Chocolate', 'Brown Sugar', 'Smooth Finish', 'Crafted Blend'].map(note => (
                  <span
                    key={note}
                    className="bg-espresso-100 text-espresso-700 px-4 py-1.5 rounded-full text-sm font-medium border border-espresso-200"
                  >
                    {note}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="py-24 bg-espresso-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-espresso-400 text-sm font-semibold tracking-widest uppercase mb-4 block">Simple Process</span>
            <h2
              className="text-4xl font-bold text-espresso-50"
              style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
            >
              Three Steps to Your Perfect Cup
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              {
                step: '01',
                title: 'Choose Your Bottle',
                desc: 'Pick the size that matches your coffee lifestyle — 4, 7, or 10 shots. No commitments, no complexity.',
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                  </svg>
                ),
              },
              {
                step: '02',
                title: 'Receive Your Shots',
                desc: 'Your Aconchego bottles arrive fresh and sealed. Pure shots — no dilution, no compromise.',
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="3" width="15" height="13" rx="1"/>
                    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
                    <circle cx="5.5" cy="18.5" r="2.5"/>
                    <circle cx="18.5" cy="18.5" r="2.5"/>
                  </svg>
                ),
              },
              {
                step: '03',
                title: 'Craft Your Drink',
                desc: 'Pour, mix, and create. Add milk, ice, syrups — whatever your heart desires. Your espresso, your rules.',
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 8H19a2 2 0 012 2v2a2 2 0 01-2 2h-2"/>
                    <path d="M3 8h14v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
                    <path d="M7 8V6a1 1 0 011-1h8a1 1 0 011 1v2"/>
                  </svg>
                ),
              },
            ].map((item, i) => (
              <div key={i} className="text-center group">
                <div className="inline-flex w-16 h-16 rounded-2xl bg-espresso-800 border border-espresso-700 items-center justify-center text-espresso-400 mb-6 group-hover:bg-espresso-700 transition-colors">
                  {item.icon}
                </div>
                <div className="text-espresso-600 text-xs font-bold tracking-widest mb-2">{item.step}</div>
                <h3
                  className="text-espresso-50 font-bold text-xl mb-3"
                  style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
                >
                  {item.title}
                </h3>
                <p className="text-espresso-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MIXTURES ── */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-espresso-400 text-sm font-semibold tracking-widest uppercase mb-4 block">Get Creative</span>
            <h2
              className="text-4xl font-bold text-espresso-900 mb-4"
              style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
            >
              Mixtures to Try
            </h2>
            <p className="text-espresso-600 text-lg max-w-lg mx-auto">
              Our shots are your canvas. Here are a few ideas to spark your creativity.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {mixtures.map((m, i) => (
              <div key={i} className="bg-espresso-50 rounded-2xl overflow-hidden border border-espresso-100 hover:shadow-lg transition-all duration-300 group">
                <div className="h-44 bg-espresso-100 flex items-center justify-center overflow-hidden relative">
                  <Image
                    src={m.image}
                    alt={m.name}
                    fill
                    className="object-contain p-3 group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-5">
                  <h3
                    className="text-espresso-900 font-bold text-lg mb-1"
                    style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
                  >
                    {m.name}
                  </h3>
                  <p className="text-espresso-400 text-xs font-mono mb-2">{m.recipe}</p>
                  <p className="text-espresso-600 text-sm italic">{m.note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 bg-espresso-400">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2
            className="text-4xl sm:text-5xl font-bold text-espresso-900 mb-6 leading-tight"
            style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
          >
            Ready to Craft Your<br />Espresso Story?
          </h2>
          <p className="text-espresso-800 text-lg mb-10 max-w-lg mx-auto">
            Join the movement of coffee lovers who make every cup their own masterpiece.
          </p>
          <Link
            href="/shop"
            className="inline-flex items-center gap-3 bg-espresso-900 hover:bg-espresso-800 text-espresso-50 font-bold px-10 py-5 rounded-full transition-colors text-lg shadow-xl"
          >
            Start with Your First Bottle
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </section>
    </>
  )
}
