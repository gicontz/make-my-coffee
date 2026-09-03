'use client'

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

interface DayData {
  date: string
  orders: number
  /** Collected: paid, non-cancelled orders — same definition as the stat cards. */
  revenue: number
  /** Ordered but not yet paid for (non-cancelled). Kept visually distinct from
      revenue so a COD backlog can't be mistaken for money already earned. */
  uncollected: number
}

export default function SalesChart({ data }: { data: DayData[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F5E6D3" />
        <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#8B5E0A' }} />
        <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#8B5E0A' }} allowDecimals={false} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: '#C8860A' }}
          tickFormatter={v => `₱${(v / 1000).toFixed(0)}k`} />
        <Tooltip
          formatter={(value, name) =>
            name === 'orders'
              ? [value, 'Orders']
              : [`₱${Number(value).toLocaleString()}`, name === 'revenue' ? 'Collected' : 'Uncollected']
          }
          contentStyle={{ borderRadius: '12px', border: '1px solid #E8C9A0', fontSize: 13 }}
        />
        <Legend
          wrapperStyle={{ fontSize: 13, paddingTop: 12 }}
          formatter={(name: string) =>
            name === 'orders' ? 'Orders' : name === 'revenue' ? 'Revenue (collected)' : 'Uncollected'
          }
        />
        <Bar yAxisId="left" dataKey="orders" name="orders" fill="#2C1810" radius={[4, 4, 0, 0]} maxBarSize={40} />
        <Line yAxisId="right" type="monotone" dataKey="revenue" name="revenue" stroke="#C8860A" strokeWidth={2.5} dot={{ fill: '#C8860A', r: 4 }} />
        <Line yAxisId="right" type="monotone" dataKey="uncollected" name="uncollected" stroke="#B0895C" strokeWidth={2} strokeDasharray="5 4" dot={{ fill: '#B0895C', r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
