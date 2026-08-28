'use client'

import React, { useMemo } from 'react'
import { LayoutGrid, List, Search, X, ChevronDown } from 'lucide-react'
import { ContactCard } from '@/app/(dashboard)/contacts/ContactCard'
import { ContactsListView } from './ContactsListView'
import { motion, AnimatePresence } from 'framer-motion'
import type { Contact } from '@/types/database'
import { usePersistedState } from '@/hooks/usePersistedFilters'

type ViewMode = 'cards' | 'list'

export function ContactsViewSwitcher({ contacts }: { contacts: Contact[] }) {
  const [view, setView]               = usePersistedState<ViewMode>('contacts:view', 'cards')
  const [search, setSearch]           = usePersistedState<string>('contacts:search', '')
  const [roleFilter, setRoleFilter]   = usePersistedState<string>('contacts:role', 'all')
  const [statusFilter, setStatusFilter] = usePersistedState<string>('contacts:status', 'all')
  const [roleOpen, setRoleOpen]       = React.useState(false)
  const [statusOpen, setStatusOpen]   = React.useState(false)

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
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--hp-tertiary)] pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по контактам..."
            className="w-full pl-9 pr-4 py-2.5 bg-[var(--hp-surface)] border border-[var(--hp-border)] rounded-[var(--hp-radius)] text-sm outline-none focus:border-[var(--hp-ink)] placeholder:text-[var(--hp-tertiary)] transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-[var(--hp-tertiary)] hover:text-[var(--hp-ink)]" />
            </button>
          )}
        </div>

        {/* Role filter */}
        <div className="relative">
          <button
            onClick={() => { setRoleOpen(p => !p); setStatusOpen(false) }}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-[var(--hp-surface)] border rounded-[var(--hp-radius)] text-sm font-medium transition-colors"
            style={{ borderColor: roleFilter !== 'all' ? 'var(--hp-ink)' : 'var(--hp-border)', color: roleFilter !== 'all' ? 'var(--hp-ink)' : 'var(--hp-sub)' }}
          >
            {currentRole?.label}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${roleOpen ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
            {roleOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full mt-1.5 left-0 z-50 bg-[var(--hp-surface)] border border-[var(--hp-border)] rounded-[var(--hp-radius)] py-1 min-w-[160px]"
              >
                {roleOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setRoleFilter(opt.value); setRoleOpen(false) }}
                    className={`w-full text-left px-3.5 py-2 text-sm hover:bg-[var(--hp-neutral-tint)] transition-colors ${roleFilter === opt.value ? 'font-semibold text-[var(--hp-ink)]' : 'text-[var(--hp-sub)]'}`}
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
            className="flex items-center gap-2 px-3.5 py-2.5 bg-[var(--hp-surface)] border rounded-[var(--hp-radius)] text-sm font-medium transition-colors"
            style={{ borderColor: statusFilter !== 'all' ? 'var(--hp-ink)' : 'var(--hp-border)', color: statusFilter !== 'all' ? 'var(--hp-ink)' : 'var(--hp-sub)' }}
          >
            {currentStatus?.label}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${statusOpen ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
            {statusOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full mt-1.5 left-0 z-50 bg-[var(--hp-surface)] border border-[var(--hp-border)] rounded-[var(--hp-radius)] py-1 min-w-[160px]"
              >
                {statusOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setStatusFilter(opt.value); setStatusOpen(false) }}
                    className={`w-full text-left px-3.5 py-2 text-sm hover:bg-[var(--hp-neutral-tint)] transition-colors ${statusFilter === opt.value ? 'font-semibold text-[var(--hp-ink)]' : 'text-[var(--hp-sub)]'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {hasFilters && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-2.5 text-sm text-[var(--hp-sub)] hover:text-[var(--hp-ink)] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Сбросить
          </motion.button>
        )}

        <div className="flex-1" />

        <div className="flex items-center gap-1 bg-[var(--hp-surface)] border border-[var(--hp-border)] rounded-[var(--hp-radius)] p-1">
          <button
            onClick={() => setView('cards')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--hp-radius)] text-sm font-medium transition-colors"
            style={view === 'cards' ? { background: 'var(--hp-accent)', color: '#fff' } : { color: 'var(--hp-sub)' }}
          >
            <LayoutGrid className="w-4 h-4" />
            <span className="hidden sm:inline">Карточки</span>
          </button>
          <button
            onClick={() => setView('list')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--hp-radius)] text-sm font-medium transition-colors"
            style={view === 'list' ? { background: 'var(--hp-accent)', color: '#fff' } : { color: 'var(--hp-sub)' }}
          >
            <List className="w-4 h-4" />
            <span className="hidden sm:inline">Список</span>
          </button>
        </div>
      </div>

      {hasFilters && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-[var(--hp-sub)]">
          Найдено: <span className="font-semibold text-[var(--hp-ink)]">{filteredContacts.length}</span> из {contacts.length}
        </motion.p>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {filteredContacts.length === 0 ? (
            <div className="hp-card hp-empty">
              <p className="text-[var(--hp-sub)] text-sm">Нет контактов по выбранным фильтрам</p>
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
