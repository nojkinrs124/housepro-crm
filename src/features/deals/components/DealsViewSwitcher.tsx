'use client'

import { LayoutGrid, List } from 'lucide-react'
import { DealsKanbanBoard } from './DealsKanban'
import { DealsListView } from './DealsListView'
import { RegistryToolbar } from '@/components/layout/RegistryToolbar'
import { BulkBar } from '@/features/registry/components/BulkBar'
import { useRegistryFilters } from '@/hooks/useRegistryFilters'
import { useSelection } from '@/hooks/useSelection'
import { usePersistedState } from '@/hooks/usePersistedFilters'
import { DEAL_STAGES, DEAL_STAGE_CANCELLED, DEAL_TYPE_LABELS } from '@/features/deals/config/deal-stages'

type ViewMode = 'kanban' | 'list'

const STATUS_OPTIONS = [
  { value: 'all', label: 'Этап: все' },
  ...[...DEAL_STAGES, DEAL_STAGE_CANCELLED].map(s => ({ value: s.value, label: s.label })),
]

const TYPE_OPTIONS = [
  { value: 'all', label: 'Тип: все' },
  ...Object.entries(DEAL_TYPE_LABELS).map(([value, label]) => ({ value, label })),
]

const VIEWS = [
  { value: 'kanban', label: 'Канбан', icon: LayoutGrid },
  { value: 'list',   label: 'Реестр', icon: List },
]

interface Party { full_name?: string; company_name?: string }

/** Поля сделки, которые нужны фильтрам и реестру; страница отдаёт их с запасом. */
interface DealItem {
  id: string
  status: string
  deal_type: string
  deal_number: number | null
  amount: number | null
  expected_close_date: string | null
  client_contact?: Party | null
  owner_contact?: Party | null
  client?: { full_name?: string } | null
  property?: { title?: string; address?: string } | null
}

export function DealsViewSwitcher({ deals }: { deals: DealItem[] }) {
  const [view, setView] = usePersistedState<ViewMode>('deals:view', 'kanban')

  const { search, setSearch, filtered: filteredDeals, toolbarFilters, reset } = useRegistryFilters(deals, {
    storageKey: 'deals',
    haystack: d => [
      d.deal_number ? `сд-${d.deal_number}` : '',
      d.client_contact?.full_name, d.client_contact?.company_name, d.client?.full_name,
      d.owner_contact?.full_name, d.owner_contact?.company_name,
      d.property?.title, d.property?.address,
    ].filter(Boolean).join(' '),
    filters: [
      { key: 'status', options: STATUS_OPTIONS, field: d => d.status },
      { key: 'type',   options: TYPE_OPTIONS,   field: d => d.deal_type },
    ],
  })

  const selection = useSelection(filteredDeals)

  return (
    <div className="space-y-4">
      <RegistryToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Поиск: № сделки, клиент, объект"
        filters={toolbarFilters}
        views={VIEWS}
        view={view}
        onViewChange={v => setView(v as ViewMode)}
        onReset={reset}
        foundLabel={
          <>Найдено: <span className="font-semibold text-[var(--hp-ink)]">{filteredDeals.length}</span> из {deals.length}</>
        }
      />

      {/* Групповые действия — только в реестре: на канбане строк с чекбоксами нет */}
      {view === 'list' && <BulkBar registry="deals" selection={selection} />}

      {/* Без AnimatePresence: mode="wait" ждал exit уходящего вида и при
          переключении с канбана на реестр новый вид не монтировался вовсе —
          таблица не появлялась ни через секунду, ни через шесть. */}
      {view === 'kanban'
        ? <DealsKanbanBoard deals={filteredDeals} />
        : <DealsListView deals={filteredDeals} selection={selection} />}
    </div>
  )
}
