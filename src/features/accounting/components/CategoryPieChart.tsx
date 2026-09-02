'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { CHART_TOOLTIP_STYLE } from '@/lib/design/chartColors'

interface Slice {
  name: string
  color: string
  value: number
}

interface Props {
  data: Slice[]
  title: string
}

export function CategoryPieChart({ data, title }: Props) {
  const total = data.reduce((a, d) => a + d.value, 0)

  if (data.length === 0 || total === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-[var(--hp-tertiary)] text-sm">
        Нет данных
      </div>
    )
  }

  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{title}</p>
      <div className="flex items-center gap-4">
        <div className="shrink-0" style={{ width: 120, height: 120 }}>
          {data.length === 1 ? (
            /*
             * Единственная доля = сектор ровно на 360°, у которого начало дуги
             * совпадает с концом. Recharts на таком секторе строит вырожденный
             * path и не рисует ничего: в интерфейсе оставалась только легенда
             * «Категория — 100%» рядом с пустым местом. Рисуем кольцо сами —
             * тут всё равно нечего сегментировать.
             */
            <svg width="120" height="120" viewBox="0 0 120 120" role="img"
              aria-label={`${data[0].name} — 100%`}>
              <circle
                cx="60" cy="60" r="42"
                fill="none"
                stroke={data[0].color}
                strokeWidth="24"
              />
            </svg>
          ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={30}
                outerRadius={54}
                dataKey="value"
                strokeWidth={2}
                stroke="#fff"
              >
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v) => [(Number(v) ?? 0).toLocaleString('ru-RU') + ' ₽', '']}
                contentStyle={CHART_TOOLTIP_STYLE}
              />
            </PieChart>
          </ResponsiveContainer>
          )}
        </div>
        <div className="flex-1 space-y-1.5 min-w-0">
          {data.slice(0, 6).map((d) => (
            <div key={d.name} className="flex items-center gap-2">
              <span
                className="shrink-0 w-2.5 h-2.5 rounded-full"
                style={{ background: d.color }}
              />
              <span className="text-xs text-[var(--hp-ink)] truncate flex-1">{d.name}</span>
              <span className="text-xs font-semibold text-foreground shrink-0">
                {Math.round((d.value / total) * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
