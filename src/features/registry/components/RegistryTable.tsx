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
  /** Доп. классы <th> (не для скрытия — для него hideBelow) */
  headClass?: string
  /**
   * Скрыть колонку, пока ширина ТАБЛИЦЫ меньше порога: md 768, lg 1024, xl 1152 px.
   * Считается по контейнеру, а не по окну: при меню 300 px окно 1280 даёт
   * таблице ~950 px, и брейкпоинты окна прятали колонки слишком поздно.
   * Прячутся и заголовок, и ячейки — иначе столбцы съезжают.
   */
  hideBelow?: 'md' | 'lg' | 'xl'
  cell: (row: T) => ReactNode
}

// Полные литералы — чтобы Tailwind их увидел при сборке
const HIDE_CLASS = {
  md: 'hidden @3xl:table-cell',
  lg: 'hidden @5xl:table-cell',
  xl: 'hidden @6xl:table-cell',
} as const

function colClass(base: string | undefined, hide: RegistryColumn<unknown>['hideBelow']): string | undefined {
  const cls = [base, hide ? HIDE_CLASS[hide] : null].filter(Boolean).join(' ')
  return cls || undefined
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
      <div className="overflow-x-auto @container">
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
              {columns.map(c => <th key={c.key} className={colClass(c.headClass, c.hideBelow)}>{c.title}</th>)}
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
                  <td key={c.key} className={colClass(c.cellClass, c.hideBelow)}>{c.cell(row)}</td>
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
