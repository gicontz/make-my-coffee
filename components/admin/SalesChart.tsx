'use client'

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

interface DayData {
  date: string
  orders: number
  revenue: number
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
            name === 'revenue'
              ? [`₱${Number(value).toLocaleString()}`, 'Revenue']
              : [value, 'Orders']
          }
          contentStyle={{ borderRadius: '12px', border: '1px solid #E8C9A0', fontSize: 13 }}
        />
        <Legend wrapperStyle={{ fontSize: 13, paddingTop: 12 }} />
        <Bar yAxisId="left" dataKey="orders" name="Orders" fill="#2C1810" radius={[4, 4, 0, 0]} maxBarSize={40} />
        <Line yAxisId="right" type="monotone" dataKey="revenue" name="revenue" stroke="#C8860A" strokeWidth={2.5} dot={{ fill: '#C8860A', r: 4 }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
