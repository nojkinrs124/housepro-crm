'use client'

import { useMemo } from 'react'
import { LayoutGrid, List } from 'lucide-react'
import { ContactCard } from '@/app/(dashboard)/contacts/ContactCard'
import { ContactsRegistry, type ContactMeta } from './ContactsRegistry'
import { RegistryToolbar } from '@/components/layout/RegistryToolbar'
import { motion, AnimatePresence } from 'framer-motion'
import type { Contact } from '@/types/database'
import { usePersistedState } from '@/hooks/usePersistedFilters'

type ViewMode = 'cards' | 'list'

const ROLE_OPTIONS = [
  { value: 'all',    label: 'Роль: все' },
  { value: 'client', label: 'Клиенты' },
  { value: 'owner',  label: 'Собственники' },
  { value: 'both',   label: 'Кл.+Собств.' },
]

const STATUS_OPTIONS = [
  { value: 'all',      label: 'Статус: все' },
  { value: 'new',      label: 'Новые' },
  { value: 'active',   label: 'Активные' },
  { value: 'vip',      label: 'VIP' },
  { value: 'inactive', label: 'Неактивные' },
]

const VIEWS = [
  { value: 'list',  label: 'Реестр',   icon: List },
  { value: 'cards', label: 'Карточки', icon: LayoutGrid },
]

export function ContactsViewSwitcher({
  contacts,
  meta = {},
}: {
  contacts: Contact[]
  /** Объект и риелтор по последней сделке — колонки реестра, которых нет в contacts. */
  meta?: Record<string, ContactMeta>
}) {
  // Реестр — вид по умолчанию: в нём видно семь атрибутов сразу, карточки нужны реже.
  const [view, setView]                 = usePersistedState<ViewMode>('contacts:view', 'list')
  const [search, setSearch]             = usePersistedState<string>('contacts:search', '')
  const [roleFilter, setRoleFilter]     = usePersistedState<string>('contacts:role', 'all')
  const [statusFilter, setStatusFilter] = usePersistedState<string>('contacts:status', 'all')

  const filteredContacts = useMemo(() => {
    return contacts.filter((c: Contact) => {
      if (roleFilter !== 'all' && c.role !== roleFilter) return false
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const haystack = [c.full_name, c.company_name, c.phone, c.email]
          .filter(Boolean).join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [contacts, roleFilter, statusFilter, search])

  return (
    <div className="space-y-4">
      <RegistryToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Поиск: имя, телефон, email"
        filters={[
          { key: 'role',   value: roleFilter,   onChange: setRoleFilter,   options: ROLE_OPTIONS },
          { key: 'status', value: statusFilter, onChange: setStatusFilter, options: STATUS_OPTIONS },
        ]}
        views={VIEWS}
        view={view}
        onViewChange={v => setView(v as ViewMode)}
        onReset={() => { setSearch(''); setRoleFilter('all'); setStatusFilter('all') }}
        foundLabel={
          <>Найдено: <span className="font-semibold text-[var(--hp-ink)]">{filteredContacts.length}</span> из {contacts.length}</>
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
          {view === 'cards' ? (
            filteredContacts.length === 0 ? (
              <div className="hp-card hp-empty">
                <p className="text-[var(--hp-sub)] text-sm">Нет контактов по выбранным фильтрам</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredContacts.map((contact, idx) => (
                  <ContactCard key={contact.id} contact={contact} idx={idx} />
                ))}
              </div>
            )
          ) : (
            <ContactsRegistry contacts={filteredContacts} meta={meta} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
