'use client'

import { LayoutGrid, List } from 'lucide-react'
import { ContactCard } from '@/app/(dashboard)/contacts/ContactCard'
import { ContactsRegistry, type ContactMeta } from './ContactsRegistry'
import { RegistryToolbar } from '@/components/layout/RegistryToolbar'
import { BulkBar } from '@/features/registry/components/BulkBar'
import { useRegistryFilters } from '@/hooks/useRegistryFilters'
import { useSelection } from '@/hooks/useSelection'
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
  const [view, setView] = usePersistedState<ViewMode>('contacts:view', 'list')

  const { search, setSearch, filtered: filteredContacts, toolbarFilters, reset } = useRegistryFilters(contacts, {
    storageKey: 'contacts',
    haystack: c => [c.full_name, c.company_name, c.phone, c.email].filter(Boolean).join(' '),
    filters: [
      { key: 'role',   options: ROLE_OPTIONS,   field: c => c.role },
      { key: 'status', options: STATUS_OPTIONS, field: c => c.status },
    ],
  })

  const selection = useSelection(filteredContacts)

  return (
    <div className="space-y-4">
      <RegistryToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Поиск: имя, телефон, email"
        filters={toolbarFilters}
        views={VIEWS}
        view={view}
        onViewChange={v => setView(v as ViewMode)}
        onReset={reset}
        foundLabel={
          <>Найдено: <span className="font-semibold text-[var(--hp-ink)]">{filteredContacts.length}</span> из {contacts.length}</>
        }
      />

      {/* Групповые действия — только в реестре: у карточек нет чекбоксов */}
      {view === 'list' && <BulkBar registry="contacts" selection={selection} />}

      {/* Без AnimatePresence: mode="wait" ждал exit уходящего вида и при
          переключении с канбана на реестр новый вид не монтировался вовсе —
          таблица не появлялась ни через секунду, ни через шесть. */}
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
        <ContactsRegistry contacts={filteredContacts} meta={meta} selection={selection} />
      )}
    </div>
  )
}
