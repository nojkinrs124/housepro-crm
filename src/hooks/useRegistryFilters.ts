'use client'

import { useMemo } from 'react'
import { usePersistedState } from '@/hooks/usePersistedFilters'
import type { FilterDef, FilterOption } from '@/components/layout/RegistryToolbar'

export interface RegistryFilterSpec<T> {
  /** Ключ фильтра: и React key, и суффикс ключа в localStorage */
  key: string
  options: FilterOption[]
  /** Значение записи, с которым сравнивается выбранный вариант */
  field: (row: T) => string | null | undefined
}

/**
 * Поиск и фильтры реестра: состояние в localStorage, готовые FilterDef для
 * RegistryToolbar и отфильтрованный список.
 *
 * Вынесено из разделов, потому что до этого каждый список писал одно и то же
 * своими руками — и они разъезжались: у лидов был свой тулбар с другой
 * вёрсткой, у договоров и объектов фильтры вообще жили в адресной строке.
 */
export function useRegistryFilters<T>(
  rows: T[],
  opts: {
    /** Префикс ключей localStorage, например 'contracts' */
    storageKey: string
    /** Строка, по которой ищет поисковая строка */
    haystack: (row: T) => string
    filters?: RegistryFilterSpec<T>[]
  },
) {
  const { storageKey, haystack, filters = [] } = opts

  const [search, setSearch] = usePersistedState<string>(`${storageKey}:search`, '')
  const [values, setValues] = usePersistedState<Record<string, string>>(`${storageKey}:filters`, {})

  const get = (key: string) => values[key] ?? 'all'
  const set = (key: string, value: string) => setValues(prev => ({ ...prev, [key]: value }))

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(row => {
      for (const f of filters) {
        const active = values[f.key] ?? 'all'
        if (active !== 'all' && String(f.field(row) ?? '') !== active) return false
      }
      if (q && !haystack(row).toLowerCase().includes(q)) return false
      return true
    })
    // haystack и filters пересоздаются на каждый рендер вызывающего компонента,
    // поэтому в зависимостях только данные и состояние фильтров.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, values])

  const toolbarFilters: FilterDef[] = filters.map(f => ({
    key: f.key,
    value: get(f.key),
    onChange: (v: string) => set(f.key, v),
    options: f.options,
  }))

  return {
    search,
    setSearch,
    filtered,
    toolbarFilters,
    reset: () => { setSearch(''); setValues({}) },
  }
}
