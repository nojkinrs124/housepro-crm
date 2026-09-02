'use client'

import {
  ResponsiveContainer, ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { CHART, CHART_AXIS_TICK, CHART_GRID_STROKE, CHART_TOOLTIP_STYLE, CHART_TOOLTIP_LABEL_STYLE } from '@/lib/design/chartColors'

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
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} vertical={false} />
        <XAxis
          dataKey="month"
          tick={CHART_AXIS_TICK}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={fmt}
          tick={CHART_AXIS_TICK}
          axisLine={false}
          tickLine={false}
          width={44}
        />
        <Tooltip
          formatter={(value, name) => [
            (Number(value) ?? 0).toLocaleString('ru-RU') + ' ₽',
            name === 'income' ? 'Доход' : name === 'expense' ? 'Расход' : 'Прибыль',
          ]}
          contentStyle={CHART_TOOLTIP_STYLE}
          labelStyle={CHART_TOOLTIP_LABEL_STYLE}
        />
        <Legend
          formatter={(v) => v === 'income' ? 'Доход' : v === 'expense' ? 'Расход' : 'Прибыль'}
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
        />
        <Bar dataKey="income"  fill="var(--hp-accent)" radius={[4,4,0,0]} barSize={18} />
        <Bar dataKey="expense" fill={CHART.danger} radius={[4,4,0,0]} barSize={18} />
        <Line
          type="monotone"
          dataKey="profit"
          stroke={CHART.sub}
          strokeWidth={2}
          dot={{ r: 3, fill: CHART.sub }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
