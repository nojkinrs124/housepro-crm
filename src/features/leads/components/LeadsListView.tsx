'use client'

import Link from 'next/link'
import { Phone } from 'lucide-react'
import { DEAL_TYPE_LABELS as dealTypeLabels } from '@/features/deals/config/deal-stages'
import { LEAD_STATUS_BADGE, LEAD_STATUS_LABELS } from '@/features/leads/config/lead-statuses'
import { RegistryTable, type RegistryColumn } from '@/features/registry/components/RegistryTable'
import type { Selection } from '@/hooks/useSelection'
import { formatAmount } from '@/lib/utils'

export interface LeadRow {
  id: string
  full_name: string | null
  phone: string | null
  deal_type: string | null
  source: string | null
  status: string
  budget_min: number | null
  budget_max: number | null
}

export const LEAD_SOURCE_LABELS: Record<string, string> = {
  avito: 'Авито',
  cian: 'Циан',
  website: 'Сайт',
  referral: 'Рекомендация',
  instagram: 'Instagram',
  phone: 'Телефон',
  other: 'Другое',
}

function budgetOf(lead: LeadRow): string | null {
  const parts = [lead.budget_min, lead.budget_max].filter(v => v !== null && v !== undefined)
  if (parts.length === 0) return null
  return parts.map(v => formatAmount(v as number)).join(' – ') + ' ₽'
}

/** Реестр лидов — та же таблица, что в контактах, сделках и договорах. */
export function LeadsListView({ leads, selection }: { leads: LeadRow[]; selection?: Selection }) {
  const columns: RegistryColumn<LeadRow>[] = [
    {
      key: 'name', title: 'Имя', cellClass: 'font-semibold max-w-[220px]',
      cell: l => (
        <Link href={`/leads/${l.id}`} className="block truncate hover:text-[var(--hp-accent)] transition-colors">
          {l.full_name || '—'}
        </Link>
      ),
    },
    {
      key: 'phone', title: 'Телефон', cellClass: 'whitespace-nowrap',
      cell: l => l.phone
        ? (
          <a href={`tel:${l.phone}`} className="inline-flex items-center gap-1.5 hover:text-[var(--hp-accent)] transition-colors">
            <Phone className="w-3 h-3 shrink-0 text-[var(--hp-tertiary)]" />
            {l.phone}
          </a>
        )
        : <span className="text-[var(--hp-tertiary)]">—</span>,
    },
    {
      key: 'type', title: 'Тип', cellClass: 'sub whitespace-nowrap',
      cell: l => l.deal_type
        ? (dealTypeLabels[l.deal_type] ?? l.deal_type)
        : <span className="text-[var(--hp-tertiary)]">—</span>,
    },
    {
      key: 'source', title: 'Источник', cellClass: 'sub whitespace-nowrap', headClass: 'hidden md:table-cell',
      cell: l => LEAD_SOURCE_LABELS[l.source ?? ''] ?? l.source ?? '—',
    },
    {
      key: 'status', title: 'Статус',
      cell: l => (
        <span className={`hp-badge ${LEAD_STATUS_BADGE[l.status] ?? ''}`}>
          {LEAD_STATUS_LABELS[l.status] ?? l.status}
        </span>
      ),
    },
    {
      key: 'budget', title: 'Бюджет', cellClass: 'num font-semibold whitespace-nowrap',
      cell: l => budgetOf(l) ?? <span className="text-[var(--hp-tertiary)] font-normal">—</span>,
    },
  ]

  return (
    <RegistryTable
      rows={leads}
      columns={columns}
      href={l => `/leads/${l.id}`}
      selection={selection}
      empty="Нет лидов по выбранным фильтрам"
    />
  )
}
