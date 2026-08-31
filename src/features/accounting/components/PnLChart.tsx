'use client'

import {
  ResponsiveContainer, ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'

interface DataPoint {
  month: string
  income: number
  expense: number
  profit: number
}

interface Props {
  data: DataPoint[]
}

function fmt(v: number) {
  if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M'
  if (Math.abs(v) >= 1_000)     return (v / 1_000).toFixed(0) + 'K'
  return String(v)
}

export function PnLChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="h-[260px] flex items-center justify-center text-[var(--hp-tertiary)] text-sm">
        Нет данных за период
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EAEEE2" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: '#8A9382' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={fmt}
          tick={{ fontSize: 11, fill: '#8A9382' }}
          axisLine={false}
          tickLine={false}
          width={44}
        />
        <Tooltip
          formatter={(value, name) => [
            (Number(value) ?? 0).toLocaleString('ru-RU') + ' ₽',
            name === 'income' ? 'Доход' : name === 'expense' ? 'Расход' : 'Прибыль',
          ]}
          contentStyle={{
            borderRadius: 12,
            border: '1px solid #DFE4D6',
            fontSize: 12,
          }}
          labelStyle={{ fontWeight: 600, color: '#232A24', marginBottom: 4 }}
        />
        <Legend
          formatter={(v) => v === 'income' ? 'Доход' : v === 'expense' ? 'Расход' : 'Прибыль'}
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
        />
        <Bar dataKey="income"  fill="var(--hp-accent)" radius={[4,4,0,0]} barSize={18} />
        <Bar dataKey="expense" fill="#C2705A" radius={[4,4,0,0]} barSize={18} />
        <Line
          type="monotone"
          dataKey="profit"
          stroke="#5C6659"
          strokeWidth={2}
          dot={{ r: 3, fill: '#5C6659' }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
