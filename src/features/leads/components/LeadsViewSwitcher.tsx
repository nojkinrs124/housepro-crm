'use client'

import { LayoutGrid, List } from 'lucide-react'
import { LeadsKanban } from './LeadsKanban'
import { LeadsListView, LEAD_SOURCE_LABELS, type LeadRow } from './LeadsListView'
import { RegistryToolbar } from '@/components/layout/RegistryToolbar'
import { BulkBar } from '@/features/registry/components/BulkBar'
import { useRegistryFilters } from '@/hooks/useRegistryFilters'
import { useSelection } from '@/hooks/useSelection'
import { usePersistedState } from '@/hooks/usePersistedFilters'
import { LEAD_STATUSES } from '@/features/leads/config/lead-statuses'
import { DEAL_TYPE_LABELS } from '@/features/deals/config/deal-stages'

type ViewMode = 'kanban' | 'list'

const STATUS_OPTIONS = [
  { value: 'all', label: 'Статус: все' },
  ...LEAD_STATUSES.map(s => ({ value: s.value, label: s.label })),
]

const TYPE_OPTIONS = [
  { value: 'all', label: 'Тип: все' },
  ...Object.entries(DEAL_TYPE_LABELS).map(([value, label]) => ({ value, label })),
]

const SOURCE_OPTIONS = [
  { value: 'all', label: 'Источник: все' },
  ...Object.entries(LEAD_SOURCE_LABELS).map(([value, label]) => ({ value, label })),
]

const VIEWS = [
  { value: 'kanban', label: 'Канбан', icon: LayoutGrid },
  { value: 'list',   label: 'Список', icon: List },
]

export function LeadsViewSwitcher({ leads }: { leads: LeadRow[] }) {
  const [view, setView] = usePersistedState<ViewMode>('leads:view', 'kanban')

  const { search, setSearch, filtered, toolbarFilters, reset } = useRegistryFilters(leads, {
    storageKey: 'leads',
    haystack: l => [l.full_name, l.phone].filter(Boolean).join(' '),
    filters: [
      { key: 'status', options: STATUS_OPTIONS, field: l => l.status },
      { key: 'type',   options: TYPE_OPTIONS,   field: l => l.deal_type },
      { key: 'source', options: SOURCE_OPTIONS, field: l => l.source },
    ],
  })

  const selection = useSelection(filtered)

  return (
    <div className="space-y-4">
      <RegistryToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Поиск: имя, телефон"
        filters={toolbarFilters}
        views={VIEWS}
        view={view}
        onViewChange={v => setView(v as ViewMode)}
        onReset={reset}
        foundLabel={<>Найдено: <span className="font-semibold text-[var(--hp-ink)]">{filtered.length}</span> из {leads.length}</>}
      />

      {/* Групповые действия — только в списке: на канбане строк с чекбоксами нет */}
      {view === 'list' && <BulkBar registry="leads" selection={selection} />}

      {/* Без AnimatePresence: mode="wait" ждал exit уходящего вида и при
          переключении с канбана на реестр новый вид не монтировался вовсе —
          таблица не появлялась ни через секунду, ни через шесть. */}
      {view === 'kanban'
        ? <LeadsKanban leads={filtered} />
        : <LeadsListView leads={filtered} selection={selection} />}
    </div>
  )
}
