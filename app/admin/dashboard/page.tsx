import Link from 'next/link'
import SalesChart from '@/components/admin/SalesChart'

async function getStats() {
  const base = process.env.NEXT_PUBLIC_URL || 'http://localhost:3007'
  try {
    const res = await fetch(`${base}/api/admin/stats`, { cache: 'no-store' })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

const STATUS_STYLES: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-800',
  approved:  'bg-blue-100 text-blue-800',
  shipped:   'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
}

export default async function Dashboard() {
  const stats = await getStats()

  const statCards = [
    { label: "Today's Orders",   value: stats?.today.orders ?? '—',               sub: 'new today' },
    { label: "Today's Revenue",  value: stats ? `₱${stats.today.revenue.toLocaleString()}` : '—', sub: 'collected today' },
    { label: 'Pending Orders',   value: stats?.pendingCount ?? '—',                sub: 'awaiting action' },
    { label: 'Total Revenue',    value: stats ? `₱${stats.all.revenue.toLocaleString()}` : '—',   sub: 'all time' },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-espresso-900" style={{ fontFamily: 'Georgia, serif' }}>Dashboard</h1>
        <p className="text-espresso-500 text-sm mt-1">Overview of your store</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        {statCards.map(card => (
          <div key={card.label} className="bg-white rounded-2xl p-5 shadow-sm border border-espresso-100">
            <p className="text-espresso-500 text-xs font-semibold uppercase tracking-wider mb-2">{card.label}</p>
            <p className="text-espresso-900 text-3xl font-bold" style={{ fontFamily: 'Georgia, serif' }}>{card.value}</p>
            <p className="text-espresso-400 text-xs mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-espresso-100 mb-8">
        <h2 className="text-espresso-900 font-bold mb-6" style={{ fontFamily: 'Georgia, serif' }}>Last 7 Days — Orders &amp; Revenue</h2>
        {stats?.daily ? <SalesChart data={stats.daily} /> : (
          <p className="text-espresso-400 text-sm text-center py-16">No data yet — connect the database to see charts.</p>
        )}
      </div>

      {/* Recent orders */}
      <div className="bg-white rounded-2xl shadow-sm border border-espresso-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-espresso-100 flex items-center justify-between">
          <h2 className="text-espresso-900 font-bold" style={{ fontFamily: 'Georgia, serif' }}>Recent Orders</h2>
          <Link href="/admin/orders" className="text-espresso-400 hover:text-espresso-600 text-sm font-medium transition-colors">
            View all →
          </Link>
        </div>
        {stats?.recentOrders?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-espresso-50">
                <tr>
                  {['#', 'Customer', 'City', 'Total', 'Status', 'Date'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-espresso-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-espresso-50">
                {stats.recentOrders.map((o: {
                  id: number; first_name: string; last_name: string; city: string;
                  total: number; order_status: string; created_at: string
                }) => (
                  <tr key={o.id} className="hover:bg-espresso-50/50 transition-colors">
                    <td className="px-5 py-3 font-mono text-espresso-400 text-xs">#{o.id}</td>
                    <td className="px-5 py-3 font-medium text-espresso-900">{o.first_name} {o.last_name}</td>
                    <td className="px-5 py-3 text-espresso-600">{o.city}</td>
                    <td className="px-5 py-3 font-semibold text-espresso-900">₱{o.total.toLocaleString()}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[o.order_status] ?? 'bg-gray-100 text-gray-700'}`}>
                        {o.order_status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-espresso-400 text-xs">
                      {new Date(o.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-espresso-400 text-sm text-center py-10">No orders yet.</p>
        )}
      </div>
    </div>
  )
}
