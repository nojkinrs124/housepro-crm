'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { Calendar } from 'lucide-react'
import { todayIso } from '@/lib/timezone'
import { DIRECTIONS } from '@/features/directions/config/directions'

interface Props {
  from?: string
  to?: string
  direction?: string
  employee?: string
  property?: string
  employees: Array<{ id: string; full_name: string | null }>
  properties: Array<{ id: string; title: string | null; address: string | null }>
}

const PRESETS = [
  { label: '7 дней', days: 7 },
  { label: '30 дней', days: 30 },
  { label: '90 дней', days: 90 },
  { label: 'Год', days: 365 },
]

/**
 * Даты + направление/сотрудник/объект — один компонент, потому что все они
 * пишут в один и тот же URL: раздельные пуши в router рисковали бы затирать
 * параметры друг друга при быстром переключении.
 */
export function AnalyticsFilters({ from, to, direction, employee, property, employees, properties }: Props) {
  const router = useRouter()
  const params = useSearchParams()

  const set = useCallback((patch: Record<string, string>) => {
    const sp = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(patch)) {
      if (value) sp.set(key, value)
      else sp.delete(key)
    }
    router.push(`/analytics?${sp.toString()}`)
  }, [router, params])

  function applyPreset(days: number) {
    const t = new Date()
    const f = new Date(t)
    f.setDate(f.getDate() - days)
    set({ from: f.toISOString().slice(0, 10), to: t.toISOString().slice(0, 10) })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map(p => (
        <button
          key={p.days}
          onClick={() => applyPreset(p.days)}
          className="px-3 py-1.5 text-xs font-medium border border-[var(--hp-border)] bg-[var(--hp-surface)] text-[var(--hp-sub)] hover:bg-[var(--hp-neutral-tint)] hover:border-primary/40 transition-colors"
        >
          {p.label}
        </button>
      ))}

      <div className="flex items-center gap-1.5">
        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
        <input
          type="date"
          defaultValue={from}
          onChange={e => set({ from: e.target.value, to: to ?? todayIso() })}
          className="text-xs px-2 py-1.5 border border-[var(--hp-border)] bg-[var(--hp-surface)] outline-none focus:border-[var(--hp-ink)]"
        />
        <span className="text-muted-foreground text-xs">—</span>
        <input
          type="date"
          defaultValue={to}
          onChange={e => set({ from: from ?? '', to: e.target.value })}
          className="text-xs px-2 py-1.5 border border-[var(--hp-border)] bg-[var(--hp-surface)] outline-none focus:border-[var(--hp-ink)]"
        />
      </div>

      <select
        value={direction ?? ''}
        onChange={e => set({ direction: e.target.value })}
        className="text-xs px-2 py-1.5 border border-[var(--hp-border)] bg-[var(--hp-surface)] outline-none focus:border-[var(--hp-ink)]"
      >
        <option value="">Направление: все</option>
        {DIRECTIONS.map(d => (
          <option key={d.value} value={d.value}>{d.shortLabel}</option>
        ))}
      </select>

      <select
        value={employee ?? ''}
        onChange={e => set({ employee: e.target.value })}
        className="text-xs px-2 py-1.5 border border-[var(--hp-border)] bg-[var(--hp-surface)] outline-none focus:border-[var(--hp-ink)] max-w-[180px]"
      >
        <option value="">Сотрудник: все</option>
        {employees.map(e => (
          <option key={e.id} value={e.id}>{e.full_name ?? '—'}</option>
        ))}
      </select>

      <select
        value={property ?? ''}
        onChange={e => set({ property: e.target.value })}
        className="text-xs px-2 py-1.5 border border-[var(--hp-border)] bg-[var(--hp-surface)] outline-none focus:border-[var(--hp-ink)] max-w-[220px]"
      >
        <option value="">Объект: все</option>
        {properties.map(p => (
          <option key={p.id} value={p.id}>{p.title || p.address || '—'}</option>
        ))}
      </select>
    </div>
  )
}
