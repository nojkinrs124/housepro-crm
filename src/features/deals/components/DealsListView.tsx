'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  DEAL_STATUS_LABELS, DEAL_TYPE_LABELS, dealStageBadgeClass,
} from '@/features/deals/config/deal-stages'
import { formatAmount, formatDateCompact } from '@/lib/utils'

const PAGE_SIZE = 20

/**
 * Реестр сделок — та же плотная таблица, что и в контактах: номер, тип,
 * стороны, объект, этап, сумма, дата закрытия. На узком экране колонки
 * второго плана скрываются, строка остаётся кликабельной целиком.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function DealsListView({ deals }: { deals: any[] }) {
  const router = useRouter()
  const [page, setPage] = useState(1)

  useEffect(() => { setPage(1) }, [deals])

  if (deals.length === 0) {
    return (
      <div className="hp-card hp-empty">
        <p className="text-[var(--hp-sub)] text-sm">Нет сделок по выбранным фильтрам</p>
      </div>
    )
  }

  const totalPages = Math.max(1, Math.ceil(deals.length / PAGE_SIZE))
  const current = Math.min(page, totalPages)
  const from = (current - 1) * PAGE_SIZE
  const rows = deals.slice(from, from + PAGE_SIZE)

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(n => n === 1 || n === totalPages || Math.abs(n - current) <= 1)

  return (
    <div className="hp-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="hp-registry">
          <thead>
            <tr>
              <th>№</th>
              <th>Тип</th>
              <th>Клиент</th>
              <th className="hidden lg:table-cell">Собственник</th>
              <th className="hidden md:table-cell">Объект</th>
              <th>Этап</th>
              <th className="text-right">Сумма</th>
              <th className="hidden lg:table-cell">Закрытие</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(deal => {
              const ownerContact  = deal.owner_contact  as { full_name?: string; company_name?: string } | null
              const clientContact = deal.client_contact as { full_name?: string; company_name?: string } | null
              const property = deal.property as { title?: string; address?: string } | null

              const ownerName  = ownerContact?.company_name || ownerContact?.full_name
              const clientName = clientContact?.company_name || clientContact?.full_name
              const propLabel  = property?.address ?? property?.title

              return (
                <tr
                  key={deal.id}
                  onClick={() => router.push(`/deals/${deal.id}`)}
                  className="cursor-pointer"
                >
                  <td className="sub whitespace-nowrap">
                    <Link
                      href={`/deals/${deal.id}`}
                      onClick={e => e.stopPropagation()}
                      className="font-semibold text-[var(--hp-ink)] hover:text-[var(--hp-accent)] transition-colors"
                    >
                      {deal.deal_number ? `СД-${deal.deal_number}` : '—'}
                    </Link>
                  </td>
                  <td className="sub whitespace-nowrap">
                    {DEAL_TYPE_LABELS[deal.deal_type] ?? deal.deal_type}
                  </td>
                  <td className="max-w-[180px]">
                    <span className="block truncate font-medium">
                      {clientName ?? <span className="text-[var(--hp-tertiary)] font-normal">—</span>}
                    </span>
                  </td>
                  <td className="sub hidden lg:table-cell max-w-[180px]">
                    <span className="block truncate">
                      {ownerName ?? <span className="text-[var(--hp-tertiary)]">—</span>}
                    </span>
                  </td>
                  <td className="sub hidden md:table-cell max-w-[220px]">
                    <span className="block truncate">
                      {propLabel ?? <span className="text-[var(--hp-tertiary)]">не подобран</span>}
                    </span>
                  </td>
                  <td>
                    <span className={`hp-badge ${dealStageBadgeClass(deal.status)}`}>
                      {DEAL_STATUS_LABELS[deal.status] ?? deal.status}
                    </span>
                  </td>
                  <td className="num font-semibold whitespace-nowrap">
                    {deal.amount
                      ? <>{formatAmount(deal.amount)} <span className="text-[var(--hp-tertiary)] font-normal">₽</span></>
                      : <span className="text-[var(--hp-tertiary)] font-normal">—</span>}
                  </td>
                  <td className="sub hidden lg:table-cell whitespace-nowrap">
                    {deal.expected_close_date
                      ? formatDateCompact(deal.expected_close_date)
                      : <span className="text-[var(--hp-tertiary)]">—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="hp-registry-foot">
        <span>Показано {from + 1}–{Math.min(from + PAGE_SIZE, deals.length)} из {deals.length}</span>
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
