'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useCart } from '@/context/CartContext'
import { useState } from 'react'
import wordmark from '@/app/assets/logo-wordmark.png'

export default function Navbar() {
  const { itemCount } = useCart()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-espresso-900/95 backdrop-blur-sm border-b border-espresso-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo — the wordmark reversed to cream for the dark espresso bar */}
          <Link href="/" className="flex items-center" aria-label="Make My Coffee — home">
            <Image
              src={wordmark}
              alt="Make My Coffee"
              priority
              className="h-7 w-auto brightness-0 invert"
            />
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/" className="text-espresso-200 hover:text-espresso-300 text-sm font-medium tracking-wide transition-colors">
              Home
            </Link>
            <Link href="/shop" className="text-espresso-200 hover:text-espresso-300 text-sm font-medium tracking-wide transition-colors">
              Shop
            </Link>
          </div>

          <div className="flex items-center gap-4">
            {/* Cart */}
            <Link href="/cart" className="relative flex items-center gap-2 text-espresso-200 hover:text-espresso-300 transition-colors">
              <div className="relative">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <path d="M16 10a4 4 0 01-8 0"/>
                </svg>
                {itemCount > 0 && (
                  <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] bg-espresso-400 text-espresso-900 text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                    {itemCount}
                  </span>
                )}
              </div>
              <span className="hidden sm:block text-sm font-medium">Cart</span>
            </Link>

            {/* Mobile toggle */}
            <button
              className="md:hidden text-espresso-200 hover:text-espresso-300"
              onClick={() => setMobileOpen(o => !o)}
              aria-label="Toggle menu"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {mobileOpen ? (
                  <>
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </>
                ) : (
                  <>
                    <line x1="3" y1="6" x2="21" y2="6"/>
                    <line x1="3" y1="12" x2="21" y2="12"/>
                    <line x1="3" y1="18" x2="21" y2="18"/>
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-espresso-800 py-4 flex flex-col gap-3">
            <Link href="/" className="text-espresso-200 hover:text-espresso-300 text-sm font-medium px-2 transition-colors" onClick={() => setMobileOpen(false)}>Home</Link>
            <Link href="/shop" className="text-espresso-200 hover:text-espresso-300 text-sm font-medium px-2 transition-colors" onClick={() => setMobileOpen(false)}>Shop</Link>
          </div>
        )}
      </div>
    </nav>
  )
}
