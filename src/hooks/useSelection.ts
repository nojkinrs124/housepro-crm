'use client'

import { useEffect, useMemo, useState } from 'react'

/**
 * Выделение строк реестра. Выбор сбрасывается, когда меняется сам набор строк
 * (сработал фильтр или поиск), — иначе групповое действие уходило бы на записи,
 * которых пользователь уже не видит на экране.
 */
export function useSelection(rows: { id: string }[]) {
  const ids = useMemo(() => rows.map(r => r.id), [rows])
  const fingerprint = ids.join(',')

  const [selected, setSelected] = useState<string[]>([])

  useEffect(() => { setSelected([]) }, [fingerprint])

  const selectedSet = useMemo(() => new Set(selected), [selected])

  return {
    selected,
    count: selected.length,
    isSelected: (id: string) => selectedSet.has(id),
    toggle: (id: string) => setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    ),
    allChecked: ids.length > 0 && selected.length === ids.length,
    someChecked: selected.length > 0 && selected.length < ids.length,
    toggleAll: () => setSelected(prev => (prev.length === ids.length ? [] : ids)),
    clear: () => setSelected([]),
  }
}

export type Selection = ReturnType<typeof useSelection>
