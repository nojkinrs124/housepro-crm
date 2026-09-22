'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { DIRECTIONS } from '@/features/directions/config/directions'

interface Props {
  direction?: string
  employee?: string
  property?: string
  employees: Array<{ id: string; full_name: string | null }>
  properties: Array<{ id: string; title: string | null; address: string | null }>
}

export function AccountingFilters({ direction, employee, property, employees, properties }: Props) {
  const router = useRouter()
  const params = useSearchParams()

  const set = useCallback((key: string, value: string) => {
    const sp = new URLSearchParams(params.toString())
    if (value) sp.set(key, value)
    else sp.delete(key)
    router.push(`/accounting?${sp.toString()}`)
  }, [router, params])

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => set('direction', '')}
        className={`px-3 py-1.5 text-xs font-medium border transition-colors ${
          !direction
            ? 'border-[var(--hp-ink)] bg-[var(--hp-ink)] text-[var(--hp-surface)]'
            : 'border-[var(--hp-border)] bg-[var(--hp-surface)] text-[var(--hp-sub)] hover:border-primary/40'
        }`}
      >
        Все направления
      </button>
      {DIRECTIONS.map(d => (
        <button
          key={d.value}
          onClick={() => set('direction', d.value)}
          className={`px-3 py-1.5 text-xs font-medium border transition-colors ${
            direction === d.value
              ? 'border-[var(--hp-ink)] bg-[var(--hp-ink)] text-[var(--hp-surface)]'
              : 'border-[var(--hp-border)] bg-[var(--hp-surface)] text-[var(--hp-sub)] hover:border-primary/40'
          }`}
        >
          {d.shortLabel}
        </button>
      ))}

      <select
        value={employee ?? ''}
        onChange={e => set('employee', e.target.value)}
        className="text-xs px-2 py-1.5 border border-[var(--hp-border)] bg-[var(--hp-surface)] outline-none focus:border-[var(--hp-ink)] max-w-[180px]"
      >
        <option value="">Сотрудник: все</option>
        {employees.map(e => (
          <option key={e.id} value={e.id}>{e.full_name ?? '—'}</option>
        ))}
      </select>

      <select
        value={property ?? ''}
        onChange={e => set('property', e.target.value)}
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
