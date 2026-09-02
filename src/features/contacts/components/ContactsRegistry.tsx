'use client'

import Link from 'next/link'
import type { Contact } from '@/types/database'
import { RegistryTable, type RegistryColumn } from '@/features/registry/components/RegistryTable'
import type { Selection } from '@/hooks/useSelection'
import { formatPhone, formatDateCompact } from '@/lib/utils'

/** Данные, которых нет в самой таблице contacts: объект и риелтор по последней сделке. */
export interface ContactMeta {
  objectLabel?: string
  objectHref?: string
  managerName?: string
}

const roleLabels: Record<string, string> = {
  client: 'Клиент', owner: 'Собственник', both: 'Кл.+Собств.',
}
const statusConfig: Record<string, { label: string; badgeCls: string }> = {
  new:      { label: 'Новый',      badgeCls: 'hp-badge-info' },
  active:   { label: 'Активный',   badgeCls: 'hp-badge-good' },
  vip:      { label: 'VIP',        badgeCls: 'hp-badge-warn' },
  inactive: { label: 'Неактивный', badgeCls: 'hp-badge-neutral' },
}

/**
 * Реестр контактов — плотная таблица с капс-заголовками колонок и постраничным
 * выводом (макет «Кабинет», направление 1b/1c). Пришёл на смену списку карточек-
 * строк: в таблице видно семь атрибутов сразу, включая объект и ответственного.
 *
 * Пагинация клиентская: фильтры и поиск в ContactsViewSwitcher тоже работают на
 * клиенте (с сохранением в localStorage), а страница уже держит весь список в
 * памяти. Смысл пагинации здесь — не грузить DOM тысячей строк.
 */
export function ContactsRegistry({
  contacts,
  meta = {},
  selection,
}: {
  contacts: Contact[]
  meta?: Record<string, ContactMeta>
  selection?: Selection
}) {
  const columns: RegistryColumn<Contact>[] = [
    {
      key: 'name', title: 'Контакт', cellClass: 'font-semibold max-w-[220px]',
      cell: c => (
        <Link href={`/contacts/${c.id}`} className="block truncate hover:text-[var(--hp-accent)] transition-colors">
          {c.client_type === 'legal_entity' ? (c.company_name || c.full_name) : c.full_name}
        </Link>
      ),
    },
    {
      key: 'role', title: 'Роль', cellClass: 'sub whitespace-nowrap',
      cell: c => roleLabels[c.role] ?? c.role,
    },
    {
      key: 'status', title: 'Статус',
      cell: c => {
        const status = statusConfig[c.status] ?? statusConfig.new
        return <span className={`hp-badge ${status.badgeCls}`}>{status.label}</span>
      },
    },
    {
      key: 'phone', title: 'Телефон', cellClass: 'whitespace-nowrap',
      cell: c => c.phone
        ? <a href={`tel:${c.phone}`} className="hover:text-[var(--hp-accent)] transition-colors">{formatPhone(c.phone)}</a>
        : <span className="text-[var(--hp-tertiary)]">—</span>,
    },
    {
      key: 'object', title: 'Объект', cellClass: 'sub max-w-[220px]', headClass: 'hidden md:table-cell',
      cell: c => {
        const m = meta[c.id] ?? {}
        if (!m.objectLabel) return <span className="text-[var(--hp-tertiary)]">не подобран</span>
        return m.objectHref
          ? <Link href={m.objectHref} className="block truncate hover:text-[var(--hp-accent)] transition-colors">{m.objectLabel}</Link>
          : <span className="block truncate">{m.objectLabel}</span>
      },
    },
    {
      key: 'manager', title: 'Риелтор', cellClass: 'sub whitespace-nowrap', headClass: 'hidden lg:table-cell',
      cell: c => meta[c.id]?.managerName ?? <span className="text-[var(--hp-tertiary)]">—</span>,
    },
    {
      key: 'updated', title: 'Обновл.', cellClass: 'sub whitespace-nowrap',
      cell: c => formatDateCompact(c.updated_at ?? c.created_at),
    },
  ]

  return (
    <RegistryTable
      rows={contacts}
      columns={columns}
      href={c => `/contacts/${c.id}`}
      selection={selection}
      empty="Нет контактов по выбранным фильтрам"
    />
  )
}
