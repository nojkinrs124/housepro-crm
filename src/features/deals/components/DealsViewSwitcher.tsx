'use client'

import { useMemo } from 'react'
import { LayoutGrid, List } from 'lucide-react'
import { DealsKanbanBoard } from './DealsKanban'
import { DealsListView } from './DealsListView'
import { RegistryToolbar } from '@/components/layout/RegistryToolbar'
import { motion, AnimatePresence } from 'framer-motion'
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function DealsViewSwitcher({ deals }: { deals: any[] }) {
  const [view, setView]                 = usePersistedState<ViewMode>('deals:view', 'kanban')
  const [search, setSearch]             = usePersistedState<string>('deals:search', '')
  const [statusFilter, setStatusFilter] = usePersistedState<string>('deals:status', 'all')
  const [typeFilter, setTypeFilter]     = usePersistedState<string>('deals:type', 'all')

  const filteredDeals = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return deals.filter((d: any) => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false
      if (typeFilter !== 'all' && d.deal_type !== typeFilter) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const haystack = [
          d.deal_number ? `сд-${d.deal_number}` : '',
          d.client_contact?.full_name, d.client_contact?.company_name, d.client?.full_name,
          d.owner_contact?.full_name, d.owner_contact?.company_name,
          d.property?.title, d.property?.address,
        ].filter(Boolean).join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [deals, statusFilter, typeFilter, search])

  return (
    <div className="space-y-4">
      <RegistryToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Поиск: № сделки, клиент, объект"
        filters={[
          { key: 'status', value: statusFilter, onChange: setStatusFilter, options: STATUS_OPTIONS },
          { key: 'type',   value: typeFilter,   onChange: setTypeFilter,   options: TYPE_OPTIONS },
        ]}
        views={VIEWS}
        view={view}
        onViewChange={v => setView(v as ViewMode)}
        onReset={() => { setSearch(''); setStatusFilter('all'); setTypeFilter('all') }}
        foundLabel={
          <>Найдено: <span className="font-semibold text-[var(--hp-ink)]">{filteredDeals.length}</span> из {deals.length}</>
        }
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {view === 'kanban'
            ? <DealsKanbanBoard deals={filteredDeals} />
            : <DealsListView deals={filteredDeals} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
