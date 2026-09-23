'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useCart } from '@/context/CartContext'
import type { Product } from '@/lib/products'

/**
 * The only interactive part of a product page, so the page itself stays a
 * server component and keeps its metadata and JSON-LD.
 */
export default function AddToCart({ product }: { product: Product }) {
  const { addToCart } = useCart()
  const [added, setAdded] = useState(false)

  function handleAdd() {
    addToCart(product)
    setAdded(true)
    setTimeout(() => setAdded(false), 1800)
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <button
        type="button"
        onClick={handleAdd}
        className="flex-1 bg-espresso-900 hover:bg-espresso-700 text-espresso-50 font-bold py-4 px-8 rounded-full transition-colors shadow-lg"
      >
        {added ? 'Added to cart ✓' : `Add to cart — ₱${product.price.toLocaleString()}`}
      </button>
      <Link
        href="/cart"
        className="flex-shrink-0 inline-flex items-center justify-center border border-espresso-300 hover:border-espresso-700 text-espresso-800 font-bold py-4 px-8 rounded-full transition-colors"
      >
        View cart
      </Link>
    </div>
  )
}
