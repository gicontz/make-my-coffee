'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import StarRating from '@/components/StarRating'
import { productById } from '@/lib/products'

interface ReviewRow {
  id: number
  order_id: number
  rating: number
  body: string
  display_name: string
  product_ids: string[]
  approved: boolean
  moderated_at: string | null
  created_at: string
}

const FILTERS = [
  { value: 'pending', label: 'Waiting' },
  { value: 'approved', label: 'Published' },
  { value: 'rejected', label: 'Rejected' },
] as const

type Filter = (typeof FILTERS)[number]['value']

const EMPTY: Record<Filter, string> = {
  pending: 'Nothing waiting. New reviews appear here after a customer submits one from their delivery email.',
  approved: 'No published reviews yet. The product pages show no review section until one is published.',
  rejected: 'No rejected reviews.',
}

function when(value: string): string {
  return new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Moderation is publish or reject — nothing else. There is no edit and no
 * "add review": changing a customer's words, or writing any of our own, is
 * the fabrication this feature exists to avoid (lib/reviews.ts).
 */
export default function AdminReviews() {
  const [filter, setFilter] = useState<Filter>('pending')
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/reviews?status=${filter}`)
      if (!res.ok) throw new Error(`Couldn't load reviews (status ${res.status})`)
      const data = await res.json()
      if (!Array.isArray(data)) throw new Error('Unexpected response from server')
      setReviews(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reviews')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { load() }, [load])

  async function moderate(id: number, approved: boolean) {
    setUpdating(id)
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved }),
      })
      if (!res.ok) throw new Error(`Couldn't update review (status ${res.status})`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update the review')
    } finally {
      setUpdating(null)
    }
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-espresso-900" style={{ fontFamily: 'Georgia, serif' }}>Reviews</h1>
        <p className="text-espresso-500 text-sm mt-1">Customer reviews from delivered orders. Nothing appears on the site until it is published.</p>
      </div>

      {/* The rule, where the decision is made. Holding back honest bad
          reviews is as misleading to buyers as inventing good ones. */}
      <div className="mb-6 rounded-2xl border border-espresso-200 bg-espresso-50 px-5 py-4 text-sm text-espresso-700 leading-relaxed">
        <p className="font-semibold text-espresso-900 mb-1">Moderate for content, not for rating.</p>
        <p>
          Reject a review only if it contains personal details (a phone number, an address, someone&apos;s full
          name), is abusive, is spam, or isn&apos;t about the order. Publish honest low ratings — hiding them
          misleads the next buyer just as a fake review would.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap mb-6">
        {FILTERS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === tab.value
                ? 'bg-espresso-900 text-espresso-50'
                : 'bg-white text-espresso-500 border border-espresso-200 hover:border-espresso-400'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-espresso-400">Loading reviews…</div>
      ) : error ? (
        <div className="text-center py-20">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={load}
            className="px-4 py-1.5 rounded-full text-sm font-medium bg-espresso-900 text-espresso-50 hover:bg-espresso-800 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-20 text-espresso-400 max-w-md mx-auto">{EMPTY[filter]}</div>
      ) : (
        <div className="space-y-4">
          {reviews.map(review => {
            const isUpdating = updating === review.id
            return (
              <div key={review.id} className="bg-white rounded-2xl shadow-sm border border-espresso-100 overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-espresso-50 border-b border-espresso-100">
                  <div className="flex items-center gap-3 flex-wrap">
                    <StarRating rating={review.rating} />
                    <span className="font-semibold text-espresso-900">{review.display_name}</span>
                    <Link href="/admin/orders" className="font-mono text-espresso-400 text-xs hover:text-espresso-700">
                      order #{review.order_id}
                    </Link>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    {review.product_ids.map(id => (
                      <span key={id} className="inline-flex px-2 py-0.5 rounded-full font-medium bg-white border border-espresso-200 text-espresso-700">
                        {productById(id)?.name ?? id}
                      </span>
                    ))}
                    <span className="text-espresso-400">{when(review.created_at)}</span>
                  </div>
                </div>

                <p className="px-6 py-4 text-sm text-espresso-800 leading-relaxed whitespace-pre-line break-words">{review.body}</p>

                <div className="px-6 py-3 border-t border-espresso-100 flex flex-wrap gap-2 items-center">
                  {!review.approved && (
                    <button
                      disabled={isUpdating}
                      onClick={() => moderate(review.id, true)}
                      className="px-4 py-1.5 rounded-full text-xs font-bold transition-colors disabled:opacity-50 bg-green-600 hover:bg-green-700 text-white"
                    >
                      {isUpdating ? '…' : 'Publish'}
                    </button>
                  )}
                  {(review.approved || review.moderated_at === null) && (
                    <button
                      disabled={isUpdating}
                      onClick={() => moderate(review.id, false)}
                      className="px-4 py-1.5 rounded-full text-xs font-bold transition-colors disabled:opacity-50 bg-red-100 hover:bg-red-200 text-red-700"
                    >
                      {isUpdating ? '…' : review.approved ? 'Unpublish' : 'Reject'}
                    </button>
                  )}
                  {review.moderated_at && (
                    <span className="ml-auto text-espresso-400 text-xs">
                      {review.approved ? 'Published' : 'Rejected'} {when(review.moderated_at)}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
