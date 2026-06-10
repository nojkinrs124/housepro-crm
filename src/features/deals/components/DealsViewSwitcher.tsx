'use client'

import React, { useState, useMemo } from 'react'
import { LayoutGrid, List, Search, X, ChevronDown } from 'lucide-react'
import { DealsKanbanBoard } from './DealsKanban'
import { DealsListView } from './DealsListView'
import { motion, AnimatePresence } from 'framer-motion'

type ViewMode = 'kanban' | 'list'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function DealsViewSwitcher({ deals }: { deals: any[] }) {
  const [view, setView] = useState<ViewMode>('kanban')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusOpen, setStatusOpen] = useState(false)
  const [typeOpen, setTypeOpen] = useState(false)

  const statusOptions = [
    { value: 'all', label: 'Все статусы' },
    { value: 'new', label: 'Новые' },
    { value: 'showing', label: 'Показы' },
    { value: 'negotiation', label: 'Переговоры' },
    { value: 'contract', label: 'Договор' },
    { value: 'payment', label: 'Оплата' },
    { value: 'completed', label: 'Завершено' },
    { value: 'cancelled', label: 'Отменено' },
  ]

  const typeOptions = [
    { value: 'all', label: 'Все типы' },
    { value: 'rent', label: 'Аренда' },
    { value: 'sale', label: 'Продажа' },
    { value: 'management', label: 'Управление' },
    { value: 'commercial', label: 'Коммерция' },
    { value: 'subrent', label: 'Субаренда' },
  ]

  const filteredDeals = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return deals.filter((d: any) => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false
      if (typeFilter !== 'all' && d.deal_type !== typeFilter) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const clientName = (d.client_contact?.full_name || d.client?.full_name || '').toLowerCase()
        const ownerName = (d.owner_contact?.full_name || '').toLowerCase()
        const propTitle = (d.property?.title || d.property?.address || '').toLowerCase()
        if (!clientName.includes(q) && !ownerName.includes(q) && !propTitle.includes(q)) return false
      }
      return true
    })
  }, [deals, statusFilter, typeFilter, search])

  const hasFilters = statusFilter !== 'all' || typeFilter !== 'all' || search.trim() !== ''

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('all')
    setTypeFilter('all')
  }

  const currentStatus = statusOptions.find(o => o.value === statusFilter)
  const currentType = typeOptions.find(o => o.value === typeFilter)

  return (
    <div className="space-y-4">
      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по сделкам..."
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 placeholder:text-slate-400 transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
            </button>
          )}
        </div>

        {/* Status filter */}
        <div className="relative">
          <button
            onClick={() => { setStatusOpen(p => !p); setTypeOpen(false) }}
            className={`flex items-center gap-2 px-3.5 py-2.5 bg-white border rounded-xl text-sm font-medium transition-all ${statusFilter !== 'all' ? 'border-green-400 text-green-700 bg-green-50' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
          >
            {currentStatus?.label}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${statusOpen ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
            {statusOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full mt-1.5 left-0 z-50 bg-white border border-slate-200 rounded-xl shadow-lg py-1 min-w-[160px]"
              >
                {statusOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setStatusFilter(opt.value); setStatusOpen(false) }}
                    className={`w-full text-left px-3.5 py-2 text-sm hover:bg-slate-50 transition-colors ${statusFilter === opt.value ? 'text-green-700 font-semibold' : 'text-[#374151]'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Type filter */}
        <div className="relative">
          <button
            onClick={() => { setTypeOpen(p => !p); setStatusOpen(false) }}
            className={`flex items-center gap-2 px-3.5 py-2.5 bg-white border rounded-xl text-sm font-medium transition-all ${typeFilter !== 'all' ? 'border-green-400 text-green-700 bg-green-50' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
          >
            {currentType?.label}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${typeOpen ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
            {typeOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full mt-1.5 left-0 z-50 bg-white border border-slate-200 rounded-xl shadow-lg py-1 min-w-[160px]"
              >
                {typeOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setTypeFilter(opt.value); setTypeOpen(false) }}
                    className={`w-full text-left px-3.5 py-2 text-sm hover:bg-slate-50 transition-colors ${typeFilter === opt.value ? 'text-green-700 font-semibold' : 'text-[#374151]'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Clear filters */}
        {hasFilters && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-2.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Сбросить
          </motion.button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* View switcher */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
          <button
            onClick={() => setView('kanban')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${view === 'kanban' ? 'bg-[#16A34A] text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span className="hidden sm:inline">Канбан</span>
          </button>
          <button
            onClick={() => setView('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${view === 'list' ? 'bg-[#16A34A] text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <List className="w-4 h-4" />
            <span className="hidden sm:inline">Список</span>
          </button>
        </div>
      </div>

      {/* Results count when filtered */}
      {hasFilters && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs text-slate-500"
        >
          Найдено: <span className="font-semibold text-[#111827]">{filteredDeals.length}</span> из {deals.length}
        </motion.p>
      )}

      {/* View */}
      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {view === 'kanban' ? (
            <DealsKanbanBoard deals={filteredDeals} />
          ) : (
            <DealsListView deals={filteredDeals} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
