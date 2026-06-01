'use client'

import Link from 'next/link'
import { useCart } from '@/context/CartContext'
import { useState } from 'react'

export default function Navbar() {
  const { itemCount } = useCart()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-espresso-900/95 backdrop-blur-sm border-b border-espresso-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-espresso-400 flex items-center justify-center shadow-md flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1C0A00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 8H19a2 2 0 012 2v2a2 2 0 01-2 2h-2"/>
                <path d="M3 8h14v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
                <path d="M7 8V6a1 1 0 011-1h8a1 1 0 011 1v2"/>
              </svg>
            </div>
            <div className="leading-none">
              <span className="text-espresso-50 font-bold text-base block" style={{ fontFamily: 'Georgia, serif' }}>
                Make My Coffee
              </span>
              <span className="text-espresso-400 text-[10px] tracking-widest uppercase">
                Espresso Shots
              </span>
            </div>
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
