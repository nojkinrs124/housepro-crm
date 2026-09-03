'use client'

import Link from 'next/link'
import {
  DEAL_STATUS_LABELS, DEAL_TYPE_LABELS, dealStageBadgeClass,
} from '@/features/deals/config/deal-stages'
import { RegistryTable, type RegistryColumn } from '@/features/registry/components/RegistryTable'
import type { Selection } from '@/hooks/useSelection'
import { formatAmount, formatDateCompact } from '@/lib/utils'
import type { Party, DealListItem } from '@/features/deals/types/deal-views'


/**
 * Реестр сделок — та же плотная таблица, что и в контактах: номер, тип,
 * стороны, объект, этап, сумма, дата закрытия. На узком экране колонки
 * второго плана скрываются, строка остаётся кликабельной целиком.
 */
export function DealsListView({ deals, selection }: { deals: DealListItem[]; selection?: Selection }) {
  const columns: RegistryColumn<DealListItem>[] = [
    {
      key: 'number', title: '№', cellClass: 'sub whitespace-nowrap',
      cell: d => (
        <Link href={`/deals/${d.id}`}
          className="font-semibold text-[var(--hp-ink)] hover:text-[var(--hp-accent)] transition-colors">
          {d.deal_number ? `СД-${d.deal_number}` : '—'}
        </Link>
      ),
    },
    {
      key: 'type', title: 'Тип', cellClass: 'sub whitespace-nowrap',
      cell: d => DEAL_TYPE_LABELS[d.deal_type] ?? d.deal_type,
    },
    {
      key: 'client', title: 'Клиент', cellClass: 'max-w-[180px]',
      cell: d => {
        const name = d.client_contact?.company_name || d.client_contact?.full_name
        return <span className="block truncate font-medium">
          {name ?? <span className="text-[var(--hp-tertiary)] font-normal">—</span>}
        </span>
      },
    },
    {
      key: 'owner', title: 'Собственник', cellClass: 'sub max-w-[180px]', headClass: 'hidden lg:table-cell',
      cell: d => {
        const name = d.owner_contact?.company_name || d.owner_contact?.full_name
        return <span className="block truncate">{name ?? <span className="text-[var(--hp-tertiary)]">—</span>}</span>
      },
    },
    {
      key: 'property', title: 'Объект', cellClass: 'sub max-w-[220px]', headClass: 'hidden md:table-cell',
      cell: d => (
        <span className="block truncate">
          {d.property?.address ?? d.property?.title ?? <span className="text-[var(--hp-tertiary)]">не подобран</span>}
        </span>
      ),
    },
    {
      key: 'stage', title: 'Этап',
      cell: d => (
        <span className={`hp-badge ${dealStageBadgeClass(d.status)}`}>
          {DEAL_STATUS_LABELS[d.status] ?? d.status}
        </span>
      ),
    },
    {
      key: 'amount', title: 'Сумма', cellClass: 'num font-semibold whitespace-nowrap',
      cell: d => d.amount
        ? <>{formatAmount(d.amount)} <span className="text-[var(--hp-tertiary)] font-normal">₽</span></>
        : <span className="text-[var(--hp-tertiary)] font-normal">—</span>,
    },
    {
      key: 'close', title: 'Закрытие', cellClass: 'sub whitespace-nowrap', headClass: 'hidden lg:table-cell',
      cell: d => d.expected_close_date
        ? formatDateCompact(d.expected_close_date)
        : <span className="text-[var(--hp-tertiary)]">—</span>,
    },
  ]

  return (
    <RegistryTable
      rows={deals}
      columns={columns}
      href={d => `/deals/${d.id}`}
      selection={selection}
      empty="Нет сделок по выбранным фильтрам"
    />
  )
}
