'use client'

import Link from 'next/link'
import { Globe, Lock } from 'lucide-react'
import { RegistryToolbar } from '@/components/layout/RegistryToolbar'
import { RegistryTable, type RegistryColumn } from '@/features/registry/components/RegistryTable'
import { BulkBar } from '@/features/registry/components/BulkBar'
import { useRegistryFilters } from '@/hooks/useRegistryFilters'
import { useSelection } from '@/hooks/useSelection'
import { formatDateCompact } from '@/lib/utils'

export interface CollectionRow {
  id: string
  title: string
  isPublic: boolean
  itemsCount: number
  leadId: string | null
  leadName: string | null
  createdAt: string | null
}

const ACCESS_OPTIONS = [
  { value: 'all',   label: 'Доступ: любой' },
  { value: 'true',  label: 'Публичные' },
  { value: 'false', label: 'Приватные' },
]

export function CollectionsView({ collections }: { collections: CollectionRow[] }) {
  const { search, setSearch, filtered, toolbarFilters, reset } = useRegistryFilters(collections, {
    storageKey: 'collections',
    haystack: c => [c.title, c.leadName].filter(Boolean).join(' '),
    filters: [{ key: 'access', options: ACCESS_OPTIONS, field: c => String(c.isPublic) }],
  })

  const selection = useSelection(filtered)

  const columns: RegistryColumn<CollectionRow>[] = [
    {
      key: 'title', title: 'Подборка', cellClass: 'font-semibold max-w-[280px]',
      cell: c => (
        <Link href={`/collections/${c.id}`} className="block truncate hover:text-[var(--hp-accent)] transition-colors">
          {c.title}
        </Link>
      ),
    },
    {
      key: 'lead', title: 'Клиент', cellClass: 'max-w-[200px]',
      cell: c => c.leadName
        ? (
          <Link href={`/leads/${c.leadId}`} className="block truncate hover:text-[var(--hp-accent)] transition-colors">
            {c.leadName}
          </Link>
        )
        : <span className="text-[var(--hp-tertiary)]">—</span>,
    },
    {
      key: 'items', title: 'Объектов', cellClass: 'num',
      cell: c => c.itemsCount,
    },
    {
      key: 'access', title: 'Доступ',
      cell: c => (
        <span className={`hp-badge ${c.isPublic ? 'hp-badge-good' : 'hp-badge-neutral'}`}>
          {c.isPublic ? <><Globe className="w-3 h-3" /> Публичная</> : <><Lock className="w-3 h-3" /> Приватная</>}
        </span>
      ),
    },
    {
      key: 'created', title: 'Создана', cellClass: 'sub whitespace-nowrap',
      cell: c => formatDateCompact(c.createdAt),
    },
  ]

  return (
    <div className="space-y-4">
      <RegistryToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Поиск: название, клиент"
        filters={toolbarFilters}
        onReset={reset}
        foundLabel={<>Найдено: <span className="font-semibold text-[var(--hp-ink)]">{filtered.length}</span> из {collections.length}</>}
      />

      <BulkBar registry="collections" selection={selection} />

      <RegistryTable
        rows={filtered}
        columns={columns}
        href={c => `/collections/${c.id}`}
        selection={selection}
        empty="Нет подборок по выбранным фильтрам"
      />
    </div>
  )
}
