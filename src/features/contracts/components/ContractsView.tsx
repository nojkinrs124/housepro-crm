'use client'

import Link from 'next/link'
import { CONTRACT_TYPE_LABELS } from '@/features/contracts/config/contract-types'
import { CONTRACT_STATUSES } from '@/features/registry/config/registries'
import { RegistryToolbar } from '@/components/layout/RegistryToolbar'
import { RegistryTable, type RegistryColumn } from '@/features/registry/components/RegistryTable'
import { BulkBar } from '@/features/registry/components/BulkBar'
import { useRegistryFilters } from '@/hooks/useRegistryFilters'
import { useSelection } from '@/hooks/useSelection'
import { formatAmount, formatDateCompact } from '@/lib/utils'

export interface ContractRow {
  id: string
  number: string
  contractType: string
  status: string
  amount: number | null
  clientName: string | null
  propertyLabel: string | null
  createdAt: string | null
}

const STATUS_BADGE: Record<string, string> = {
  draft:     'hp-badge-neutral',
  generated: 'hp-badge-info',
  signed:    'hp-badge-good',
  completed: 'hp-badge-good',
  cancelled: 'hp-badge-danger',
}

const STATUS_LABELS: Record<string, string> =
  Object.fromEntries(CONTRACT_STATUSES.map(s => [s.value, s.label]))

const STATUS_OPTIONS = [
  { value: 'all', label: 'Статус: все' },
  ...CONTRACT_STATUSES.map(s => ({ value: s.value, label: s.label })),
]

const TYPE_OPTIONS = [
  { value: 'all', label: 'Тип: все' },
  ...Object.entries(CONTRACT_TYPE_LABELS).map(([value, label]) => ({ value, label })),
]

export function ContractsView({ contracts }: { contracts: ContractRow[] }) {
  const { search, setSearch, filtered, toolbarFilters, reset } = useRegistryFilters(contracts, {
    storageKey: 'contracts',
    haystack: c => [c.number, c.clientName, c.propertyLabel].filter(Boolean).join(' '),
    filters: [
      { key: 'status', options: STATUS_OPTIONS, field: c => c.status },
      { key: 'type',   options: TYPE_OPTIONS,   field: c => c.contractType },
    ],
  })

  const selection = useSelection(filtered)

  const columns: RegistryColumn<ContractRow>[] = [
    {
      key: 'number', title: 'Номер', cellClass: 'font-semibold whitespace-nowrap',
      cell: c => (
        <Link href={`/contracts/${c.id}`} className="hover:text-[var(--hp-accent)] transition-colors">
          {c.number}
        </Link>
      ),
    },
    {
      key: 'type', title: 'Тип', cellClass: 'sub whitespace-nowrap',
      cell: c => CONTRACT_TYPE_LABELS[c.contractType] ?? c.contractType,
    },
    {
      key: 'client', title: 'Клиент', cellClass: 'max-w-[200px]',
      cell: c => <span className="block truncate">{c.clientName ?? <span className="text-[var(--hp-tertiary)]">—</span>}</span>,
    },
    {
      key: 'property', title: 'Объект', cellClass: 'sub max-w-[220px]', headClass: 'hidden md:table-cell',
      cell: c => <span className="block truncate">{c.propertyLabel ?? <span className="text-[var(--hp-tertiary)]">—</span>}</span>,
    },
    {
      key: 'amount', title: 'Сумма', cellClass: 'num font-semibold whitespace-nowrap',
      cell: c => c.amount
        ? <>{formatAmount(c.amount)} <span className="text-[var(--hp-tertiary)] font-normal">₽</span></>
        : <span className="text-[var(--hp-tertiary)] font-normal">—</span>,
    },
    {
      key: 'status', title: 'Статус',
      cell: c => (
        <span className={`hp-badge ${STATUS_BADGE[c.status] ?? 'hp-badge-neutral'}`}>
          {STATUS_LABELS[c.status] ?? c.status}
        </span>
      ),
    },
    {
      key: 'date', title: 'Дата', cellClass: 'sub whitespace-nowrap',
      cell: c => formatDateCompact(c.createdAt),
    },
    {
      key: 'docx', title: '', cellClass: 'whitespace-nowrap',
      cell: c => (
        <Link href={`/contracts/${c.id}/generate`}
          className="text-[12.5px] font-semibold text-[var(--hp-sub)] hover:text-[var(--hp-ink)] transition-colors">
          DOCX
        </Link>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <RegistryToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Поиск: номер, клиент, объект"
        filters={toolbarFilters}
        onReset={reset}
        foundLabel={<>Найдено: <span className="font-semibold text-[var(--hp-ink)]">{filtered.length}</span> из {contracts.length}</>}
      />

      <BulkBar registry="contracts" selection={selection} />

      <RegistryTable
        rows={filtered}
        columns={columns}
        href={c => `/contracts/${c.id}`}
        selection={selection}
        empty="Нет договоров по выбранным фильтрам"
      />
    </div>
  )
}
