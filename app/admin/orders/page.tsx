'use client'

import { useEffect, useState, useCallback } from 'react'
import { slotLabel } from '@/lib/deliverySlots'

interface Order {
  id: number
  first_name: string
  last_name: string
  email: string
  phone: string
  city: string
  province: string
  address: string
  items: { name: string; shots: number; price: number; quantity: number }[]
  subtotal: number
  shipping: number
  total: number
  order_status: string
  payment_status: string
  notes: string
  delivery_slots: string[]
  created_at: string
}

const ORDER_STATUS: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Pending',   color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  approved:  { label: 'Approved',  color: 'bg-blue-100 text-blue-800 border-blue-200' },
  shipped:   { label: 'Shipped',   color: 'bg-purple-100 text-purple-800 border-purple-200' },
  delivered: { label: 'Delivered', color: 'bg-green-100 text-green-800 border-green-200' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800 border-red-200' },
}

const PAYMENT_STATUS: Record<string, { label: string; color: string }> = {
  unpaid: { label: 'Unpaid', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  paid:   { label: 'Paid',   color: 'bg-green-100 text-green-800 border-green-200' },
}

function nextOrderActions(status: string): { label: string; value: string; style: string }[] {
  const map: Record<string, { label: string; value: string; style: string }[]> = {
    pending:   [
      { label: 'Approve', value: 'approved', style: 'bg-blue-600 hover:bg-blue-700 text-white' },
      { label: 'Cancel',  value: 'cancelled', style: 'bg-red-100 hover:bg-red-200 text-red-700' },
    ],
    approved:  [
      { label: 'Mark Shipped', value: 'shipped', style: 'bg-purple-600 hover:bg-purple-700 text-white' },
      { label: 'Cancel', value: 'cancelled', style: 'bg-red-100 hover:bg-red-200 text-red-700' },
    ],
    shipped:   [{ label: 'Mark Delivered', value: 'delivered', style: 'bg-green-600 hover:bg-green-700 text-white' }],
    delivered: [],
    cancelled: [],
  }
  return map[status] ?? []
}

const FILTER_TABS = ['all', 'pending', 'approved', 'shipped', 'delivered', 'cancelled']

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState<number | null>(null)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/orders?status=${filter}`)
      if (!res.ok) throw new Error(`Couldn't load orders (status ${res.status})`)
      const data = await res.json()
      if (!Array.isArray(data)) throw new Error('Unexpected response from server')
      setOrders(data)
    } catch (err) {
      console.error('Failed to load orders:', err)
      setOrders([])
      setError(err instanceof Error ? err.message : 'Failed to load orders')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  async function updateStatus(id: number, patch: { order_status?: string; payment_status?: string }) {
    setUpdating(id)
    await fetch(`/api/admin/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    await fetchOrders()
    setUpdating(null)
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-espresso-900" style={{ fontFamily: 'Georgia, serif' }}>Orders</h1>
        <p className="text-espresso-500 text-sm mt-1">Manage and track all customer orders</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap mb-6">
        {FILTER_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors capitalize ${
              filter === tab
                ? 'bg-espresso-900 text-espresso-50'
                : 'bg-white text-espresso-500 border border-espresso-200 hover:border-espresso-400'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-espresso-400">Loading orders…</div>
      ) : error ? (
        <div className="text-center py-20">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchOrders}
            className="px-4 py-1.5 rounded-full text-sm font-medium bg-espresso-900 text-espresso-50 hover:bg-espresso-800 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20 text-espresso-400">No orders found.</div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => {
            const oStatus = ORDER_STATUS[order.order_status]
            const pStatus = PAYMENT_STATUS[order.payment_status]
            const actions = nextOrderActions(order.order_status)
            const isUpdating = updating === order.id

            return (
              <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-espresso-100 overflow-hidden">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 bg-espresso-50 border-b border-espresso-100">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-mono text-espresso-400 text-xs">#{order.id}</span>
                    <span className="font-semibold text-espresso-900">{order.first_name} {order.last_name}</span>
                    <span className="text-espresso-500 text-sm">{order.city}, {order.province}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${oStatus?.color}`}>
                      {oStatus?.label}
                    </span>
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${pStatus?.color}`}>
                      {pStatus?.label}
                    </span>
                    <span className="text-espresso-400 text-xs">
                      {new Date(order.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {/* Body */}
                <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Items */}
                  <div>
                    <p className="text-xs font-semibold text-espresso-500 uppercase tracking-wider mb-2">Items</p>
                    <div className="space-y-1">
                      {order.items.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-espresso-700">{item.name} ×{item.quantity}</span>
                          <span className="text-espresso-900 font-medium">₱{(item.price * item.quantity).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-espresso-100 space-y-1">
                      <div className="flex justify-between text-sm text-espresso-500">
                        <span>Subtotal</span><span>₱{order.subtotal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm text-espresso-500">
                        <span>Shipping</span>
                        <span>{order.shipping === 0 ? 'Free' : `₱${order.shipping}`}</span>
                      </div>
                      <div className="flex justify-between font-bold text-espresso-900">
                        <span>Total</span><span>₱{order.total.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Customer info */}
                  <div>
                    <p className="text-xs font-semibold text-espresso-500 uppercase tracking-wider mb-2">Customer</p>
                    <div className="space-y-1 text-sm text-espresso-700">
                      <p>{order.email}</p>
                      <p>{order.phone}</p>
                      <p className="text-espresso-500">{order.address}</p>
                      {order.notes && <p className="text-espresso-400 italic">"{order.notes}"</p>}
                    </div>

                    {order.delivery_slots?.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-espresso-100">
                        <p className="text-xs font-semibold text-espresso-500 uppercase tracking-wider mb-2">Delivery Time</p>
                        <div className="flex flex-wrap gap-1.5">
                          {[...order.delivery_slots].sort().map(id => (
                            <span key={id} className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-espresso-50 border border-espresso-200 text-espresso-700">
                              {slotLabel(id)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="px-6 py-3 border-t border-espresso-100 flex flex-wrap gap-2 items-center">
                  {actions.map(action => (
                    <button
                      key={action.value}
                      disabled={isUpdating}
                      onClick={() => updateStatus(order.id, { order_status: action.value })}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors disabled:opacity-50 ${action.style}`}
                    >
                      {isUpdating ? '…' : action.label}
                    </button>
                  ))}
                  <button
                    disabled={isUpdating}
                    onClick={() => updateStatus(order.id, {
                      payment_status: order.payment_status === 'unpaid' ? 'paid' : 'unpaid',
                    })}
                    className="px-4 py-1.5 rounded-full text-xs font-bold bg-espresso-100 hover:bg-espresso-200 text-espresso-700 transition-colors disabled:opacity-50 ml-auto"
                  >
                    {isUpdating ? '…' : order.payment_status === 'unpaid' ? 'Mark Paid' : 'Mark Unpaid'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
