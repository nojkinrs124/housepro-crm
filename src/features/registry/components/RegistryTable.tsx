'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { SelectBox } from '@/features/registry/components/SelectBox'
import type { Selection } from '@/hooks/useSelection'

export interface RegistryColumn<T> {
  key: string
  title: string
  /** Классы <td>: 'sub' — приглушённый текст, 'num' — число вправо */
  cellClass?: string
  /** Классы <th>, обычно скрытие на узких экранах */
  headClass?: string
  cell: (row: T) => ReactNode
}

const PAGE_SIZE = 20

/**
 * Таблица реестра — общая для всех разделов: колонка выделения, кликабельные
 * строки, клиентская пагинация, единый футер «Показано 1–20 из 1 248».
 *
 * Разделы отличаются только набором колонок, поэтому вёрстка живёт здесь, а не
 * копией в каждом списке: раньше пять таблиц разошлись по отступам, размеру
 * шрифта и наличию пагинации.
 */
export function RegistryTable<T extends { id: string }>({
  rows,
  columns,
  href,
  selection,
  empty = 'Ничего не найдено по выбранным фильтрам',
}: {
  rows: T[]
  columns: RegistryColumn<T>[]
  /** Куда ведёт клик по строке */
  href: (row: T) => string
  /** Выделение строк; не передано — колонки с чекбоксами нет */
  selection?: Selection
  empty?: string
}) {
  const router = useRouter()
  const [page, setPage] = useState(1)

  // Фильтры выше по дереву меняют список — иначе пользователь остаётся
  // на пустой пятой странице из двух.
  useEffect(() => { setPage(1) }, [rows])

  if (rows.length === 0) {
    return (
      <div className="hp-card hp-empty">
        <p className="text-[var(--hp-sub)] text-sm">{empty}</p>
      </div>
    )
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const current = Math.min(page, totalPages)
  const from = (current - 1) * PAGE_SIZE
  const pageRows = rows.slice(from, from + PAGE_SIZE)

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(n => n === 1 || n === totalPages || Math.abs(n - current) <= 1)

  return (
    <div className="hp-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="hp-registry">
          <thead>
            <tr>
              {selection && (
                <th className="w-10">
                  <SelectBox
                    checked={selection.allChecked}
                    indeterminate={selection.someChecked}
                    onChange={selection.toggleAll}
                    label="Выделить все строки"
                  />
                </th>
              )}
              {columns.map(c => <th key={c.key} className={c.headClass}>{c.title}</th>)}
            </tr>
          </thead>
          <tbody>
            {pageRows.map(row => (
              <tr
                key={row.id}
                onClick={e => {
                  if ((e.target as HTMLElement).closest('a,button,input')) return
                  router.push(href(row))
                }}
                className="cursor-pointer"
              >
                {selection && (
                  <td>
                    <SelectBox
                      checked={selection.isSelected(row.id)}
                      onChange={() => selection.toggle(row.id)}
                      label="Выделить строку"
                    />
                  </td>
                )}
                {columns.map(c => (
                  <td key={c.key} className={c.cellClass}>{c.cell(row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="hp-registry-foot">
        <span>Показано {from + 1}–{Math.min(from + PAGE_SIZE, rows.length)} из {rows.length}</span>
        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className={`hp-page-btn${current === 1 ? ' disabled' : ''}`}
              aria-label="Предыдущая страница"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            {pageNumbers.map((n, i) => (
              <span key={n} className="flex items-center gap-1.5">
                {i > 0 && n - pageNumbers[i - 1] > 1 && <span className="text-[var(--hp-tertiary)]">…</span>}
                <button onClick={() => setPage(n)} className={`hp-page-btn${n === current ? ' current' : ''}`}>
                  {n}
                </button>
              </span>
            ))}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className={`hp-page-btn${current === totalPages ? ' disabled' : ''}`}
              aria-label="Следующая страница"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
