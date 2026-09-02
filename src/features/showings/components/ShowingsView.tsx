'use client'

import Link from 'next/link'
import { SHOWING_STATUSES } from '@/features/registry/config/registries'
import { RegistryToolbar } from '@/components/layout/RegistryToolbar'
import { RegistryTable, type RegistryColumn } from '@/features/registry/components/RegistryTable'
import { BulkBar } from '@/features/registry/components/BulkBar'
import { useRegistryFilters } from '@/hooks/useRegistryFilters'
import { useSelection } from '@/hooks/useSelection'

export interface ShowingRow {
  id: string
  scheduledAt: string
  status: string
  durationMin: number | null
  propertyId: string | null
  propertyLabel: string | null
  leadName: string | null
  agentName: string | null
}

const STATUS_BADGE: Record<string, string> = {
  planned:   'hp-badge-info',
  completed: 'hp-badge-good',
  cancelled: 'hp-badge-neutral',
  no_show:   'hp-badge-danger',
}

const STATUS_LABELS: Record<string, string> =
  Object.fromEntries(SHOWING_STATUSES.map(s => [s.value, s.label]))

const STATUS_OPTIONS = [
  { value: 'all', label: 'Статус: все' },
  ...SHOWING_STATUSES.map(s => ({ value: s.value, label: s.label })),
]

function fmtWhen(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
}

export function ShowingsView({ showings }: { showings: ShowingRow[] }) {
  const { search, setSearch, filtered, toolbarFilters, reset } = useRegistryFilters(showings, {
    storageKey: 'showings',
    haystack: s => [s.propertyLabel, s.leadName, s.agentName].filter(Boolean).join(' '),
    filters: [{ key: 'status', options: STATUS_OPTIONS, field: s => s.status }],
  })

  const selection = useSelection(filtered)

  const columns: RegistryColumn<ShowingRow>[] = [
    {
      key: 'property', title: 'Объект', cellClass: 'font-semibold max-w-[260px]',
      cell: s => s.propertyId
        ? (
          <Link href={`/properties/${s.propertyId}`} className="block truncate hover:text-[var(--hp-accent)] transition-colors">
            {s.propertyLabel ?? 'Объект'}
          </Link>
        )
        : <span className="block truncate">{s.propertyLabel ?? <span className="text-[var(--hp-tertiary)] font-normal">не указан</span>}</span>,
    },
    {
      key: 'lead', title: 'Клиент', cellClass: 'max-w-[180px]',
      cell: s => <span className="block truncate">{s.leadName ?? <span className="text-[var(--hp-tertiary)]">—</span>}</span>,
    },
    {
      key: 'agent', title: 'Агент', cellClass: 'sub whitespace-nowrap', headClass: 'hidden md:table-cell',
      cell: s => s.agentName ?? <span className="text-[var(--hp-tertiary)]">—</span>,
    },
    {
      key: 'when', title: 'Когда', cellClass: 'sub whitespace-nowrap',
      cell: s => (
        <>
          {fmtWhen(s.scheduledAt)}
          {s.durationMin ? <span className="text-[var(--hp-tertiary)]"> · {s.durationMin} мин</span> : null}
        </>
      ),
    },
    {
      key: 'status', title: 'Статус',
      cell: s => (
        <span className={`hp-badge ${STATUS_BADGE[s.status] ?? 'hp-badge-neutral'}`}>
          {STATUS_LABELS[s.status] ?? s.status}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <RegistryToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Поиск: объект, клиент, агент"
        filters={toolbarFilters}
        onReset={reset}
        foundLabel={<>Найдено: <span className="font-semibold text-[var(--hp-ink)]">{filtered.length}</span> из {showings.length}</>}
      />

      <BulkBar registry="showings" selection={selection} />

      <RegistryTable
        rows={filtered}
        columns={columns}
        href={s => `/showings/${s.id}`}
        selection={selection}
        empty="Нет показов по выбранным фильтрам"
      />
    </div>
  )
}
