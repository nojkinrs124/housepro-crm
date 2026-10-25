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

  // Фильтры направления/сотрудника/объекта — уровень страницы (URL), поэтому
  // отдельно от поиска реестра, но тем же видом «чипов», что и RegistryToolbar
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => set('direction', '')}
        className={`hp-chip${!direction ? ' active' : ''}`}
      >
        Все направления
      </button>
      {DIRECTIONS.map(d => (
        <button
          key={d.value}
          onClick={() => set('direction', d.value)}
          className={`hp-chip${direction === d.value ? ' active' : ''}`}
        >
          {d.shortLabel}
        </button>
      ))}

      <select
        value={employee ?? ''}
        onChange={e => set('employee', e.target.value)}
        className={`hp-chip outline-none focus:border-[var(--hp-ink)] max-w-[200px]${employee ? ' active' : ''}`}
      >
        <option value="">Сотрудник: все</option>
        {employees.map(e => (
          <option key={e.id} value={e.id}>{e.full_name ?? '—'}</option>
        ))}
      </select>

      <select
        value={property ?? ''}
        onChange={e => set('property', e.target.value)}
        className={`hp-chip outline-none focus:border-[var(--hp-ink)] max-w-[240px]${property ? ' active' : ''}`}
      >
        <option value="">Объект: все</option>
        {properties.map(p => (
          <option key={p.id} value={p.id}>{p.title || p.address || '—'}</option>
        ))}
      </select>
    </div>
  )
}
