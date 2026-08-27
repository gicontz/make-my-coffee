import Link from 'next/link'
import SalesChart from '@/components/admin/SalesChart'
import { getDashboardStats } from '@/lib/stats'

// Must be live on every request — never build-time prerendered. Without this,
// Next statically renders the dashboard once at build time (stale numbers
// frozen at build, and a build-time DB dependency that breaks Preview
// deploys without DATABASE_URL set).
export const dynamic = 'force-dynamic'

const STATUS_STYLES: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-800',
  approved:  'bg-blue-100 text-blue-800',
  shipped:   'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
}

const STATUS_ORDER = ['pending', 'approved', 'shipped', 'delivered', 'cancelled']
const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending', approved: 'Approved', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled',
}

export default async function Dashboard() {
  // Direct DB call — no self-fetch over HTTP. (The dashboard previously
  // fetched its own /api/admin/stats route via a hardcoded localhost URL,
  // which never resolved correctly in dev or prod; see lib/stats.ts.)
  const stats = await getDashboardStats().catch(err => {
    console.error('getDashboardStats failed:', err)
    return null
  })

  const statCards = [
    { label: "Today's Orders",   value: stats?.today.orders ?? '—',               sub: 'new today' },
    { label: "Today's Revenue",  value: stats ? `₱${stats.today.revenue.toLocaleString()}` : '—', sub: 'collected today' },
    { label: 'Pending Orders',   value: stats?.pendingCount ?? '—',                sub: 'placed, not yet delivered or cancelled' },
    { label: 'Total Revenue',    value: stats ? `₱${stats.all.revenue.toLocaleString()}` : '—',   sub: 'all time' },
  ]

  const breakdownMap = new Map((stats?.statusBreakdown ?? []).map(s => [s.order_status, s.count]))

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-espresso-900" style={{ fontFamily: 'Georgia, serif' }}>Dashboard</h1>
        <p className="text-espresso-500 text-sm mt-1">Overview of your store</p>
      </div>

      {stats === null && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4 text-sm">
          Couldn't load stats from the database. Check the server logs / DATABASE_URL.
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-6">
        {statCards.map(card => (
          <div key={card.label} className="bg-white rounded-2xl p-5 shadow-sm border border-espresso-100">
            <p className="text-espresso-500 text-xs font-semibold uppercase tracking-wider mb-2">{card.label}</p>
            <p className="text-espresso-900 text-3xl font-bold" style={{ fontFamily: 'Georgia, serif' }}>{card.value}</p>
            <p className="text-espresso-400 text-xs mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Status breakdown — the "Pending" card above is a single open/not-concluded
          count; this row shows exactly which stage each open order is sitting in. */}
      {stats && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-espresso-100 mb-8">
          <p className="text-espresso-500 text-xs font-semibold uppercase tracking-wider mb-3">Orders by Status</p>
          <div className="flex flex-wrap gap-2">
            {STATUS_ORDER.map(status => (
              <span
                key={status}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[status]}`}
              >
                {STATUS_LABEL[status]}
                <span className="font-mono">{breakdownMap.get(status) ?? 0}</span>
              </span>
            ))}
          </div>
        </div>
      )}

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
