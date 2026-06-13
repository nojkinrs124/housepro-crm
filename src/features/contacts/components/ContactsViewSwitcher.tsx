'use client'

import React, { useState, useMemo } from 'react'
import { LayoutGrid, List, Search, X, ChevronDown } from 'lucide-react'
import { ContactCard } from '@/app/(dashboard)/contacts/ContactCard'
import { ContactsListView } from './ContactsListView'
import { motion, AnimatePresence } from 'framer-motion'
import type { Contact } from '@/types/database'

type ViewMode = 'cards' | 'list'

export function ContactsViewSwitcher({ contacts }: { contacts: Contact[] }) {
  const [view, setView] = useState<ViewMode>('cards')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [roleOpen, setRoleOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)

  const roleOptions = [
    { value: 'all',    label: 'Все роли' },
    { value: 'client', label: 'Клиенты' },
    { value: 'owner',  label: 'Собственники' },
    { value: 'both',   label: 'Кл.+Собств.' },
  ]

  const statusOptions = [
    { value: 'all',      label: 'Все статусы' },
    { value: 'new',      label: 'Новые' },
    { value: 'active',   label: 'Активные' },
    { value: 'vip',      label: 'VIP' },
    { value: 'inactive', label: 'Неактивные' },
  ]

  const filteredContacts = useMemo(() => {
    return contacts.filter((c: Contact) => {
      if (roleFilter !== 'all' && c.role !== roleFilter) return false
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const name = (c.full_name || '').toLowerCase()
        const phone = (c.phone || '').toLowerCase()
        const email = (c.email || '').toLowerCase()
        if (!name.includes(q) && !phone.includes(q) && !email.includes(q)) return false
      }
      return true
    })
  }, [contacts, roleFilter, statusFilter, search])

  const hasFilters = roleFilter !== 'all' || statusFilter !== 'all' || search.trim() !== ''

  const clearFilters = () => {
    setSearch('')
    setRoleFilter('all')
    setStatusFilter('all')
  }

  const currentRole = roleOptions.find(o => o.value === roleFilter)
  const currentStatus = statusOptions.find(o => o.value === statusFilter)

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
            placeholder="Поиск по контактам..."
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 placeholder:text-slate-400 transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
            </button>
          )}
        </div>

        {/* Role filter */}
        <div className="relative">
          <button
            onClick={() => { setRoleOpen(p => !p); setStatusOpen(false) }}
            className={`flex items-center gap-2 px-3.5 py-2.5 bg-white border rounded-xl text-sm font-medium transition-all ${roleFilter !== 'all' ? 'border-green-400 text-green-700 bg-green-50' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
          >
            {currentRole?.label}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${roleOpen ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
            {roleOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full mt-1.5 left-0 z-50 bg-white border border-slate-200 rounded-xl shadow-lg py-1 min-w-[160px]"
              >
                {roleOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setRoleFilter(opt.value); setRoleOpen(false) }}
                    className={`w-full text-left px-3.5 py-2 text-sm hover:bg-slate-50 transition-colors ${roleFilter === opt.value ? 'text-green-700 font-semibold' : 'text-[#374151]'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Status filter */}
        <div className="relative">
          <button
            onClick={() => { setStatusOpen(p => !p); setRoleOpen(false) }}
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
            onClick={() => setView('cards')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${view === 'cards' ? 'bg-[#16A34A] text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span className="hidden sm:inline">Карточки</span>
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
          Найдено: <span className="font-semibold text-[#111827]">{filteredContacts.length}</span> из {contacts.length}
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
          {filteredContacts.length === 0 ? (
            <div className="bg-white rounded-[20px] border border-slate-200/60 shadow-sm p-16 text-center">
              <p className="text-[#64748B] text-sm">Нет контактов по выбранным фильтрам</p>
            </div>
          ) : view === 'cards' ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredContacts.map((contact, idx) => (
                <ContactCard key={contact.id} contact={contact} idx={idx} />
              ))}
            </div>
          ) : (
            <ContactsListView contacts={filteredContacts} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
