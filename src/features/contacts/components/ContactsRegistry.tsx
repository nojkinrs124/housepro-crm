'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Contact } from '@/types/database'
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

const PAGE_SIZE = 20

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
}: {
  contacts: Contact[]
  meta?: Record<string, ContactMeta>
}) {
  const router = useRouter()
  const [page, setPage] = useState(1)

  // Фильтры выше по дереву меняют список — сбрасываем на первую страницу,
  // иначе пользователь остаётся на пустой 5-й странице из двух.
  useEffect(() => { setPage(1) }, [contacts])

  if (contacts.length === 0) {
    return (
      <div className="hp-card hp-empty">
        <p className="text-[var(--hp-sub)] text-sm">Нет контактов по выбранным фильтрам</p>
      </div>
    )
  }

  const totalPages = Math.max(1, Math.ceil(contacts.length / PAGE_SIZE))
  const current = Math.min(page, totalPages)
  const from = (current - 1) * PAGE_SIZE
  const rows = contacts.slice(from, from + PAGE_SIZE)

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(n => n === 1 || n === totalPages || Math.abs(n - current) <= 1)

  return (
    <div className="hp-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="hp-registry">
          <thead>
            <tr>
              <th>Контакт</th>
              <th>Роль</th>
              <th>Статус</th>
              <th>Телефон</th>
              <th>Объект</th>
              <th>Риелтор</th>
              <th>Обновл.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(contact => {
              const status = statusConfig[contact.status] ?? statusConfig.new
              const m = meta[contact.id] ?? {}
              const name = contact.client_type === 'legal_entity'
                ? (contact.company_name || contact.full_name)
                : contact.full_name

              return (
                <tr
                  key={contact.id}
                  onClick={() => router.push(`/contacts/${contact.id}`)}
                  className="cursor-pointer"
                >
                  <td className="font-semibold max-w-[220px]">
                    <Link
                      href={`/contacts/${contact.id}`}
                      onClick={e => e.stopPropagation()}
                      className="block truncate hover:text-[var(--hp-accent)] transition-colors"
                    >
                      {name}
                    </Link>
                  </td>
                  <td className="sub whitespace-nowrap">{roleLabels[contact.role] ?? contact.role}</td>
                  <td>
                    <span className={`hp-badge ${status.badgeCls}`}>{status.label}</span>
                  </td>
                  <td className="whitespace-nowrap">
                    {contact.phone ? (
                      <a
                        href={`tel:${contact.phone}`}
                        onClick={e => e.stopPropagation()}
                        className="hover:text-[var(--hp-accent)] transition-colors"
                      >
                        {formatPhone(contact.phone)}
                      </a>
                    ) : (
                      <span className="text-[var(--hp-tertiary)]">—</span>
                    )}
                  </td>
                  <td className="sub max-w-[220px]">
                    {m.objectLabel ? (
                      m.objectHref ? (
                        <Link
                          href={m.objectHref}
                          onClick={e => e.stopPropagation()}
                          className="block truncate hover:text-[var(--hp-accent)] transition-colors"
                        >
                          {m.objectLabel}
                        </Link>
                      ) : (
                        <span className="block truncate">{m.objectLabel}</span>
                      )
                    ) : (
                      <span className="text-[var(--hp-tertiary)]">не подобран</span>
                    )}
                  </td>
                  <td className="sub whitespace-nowrap">
                    {m.managerName ?? <span className="text-[var(--hp-tertiary)]">—</span>}
                  </td>
                  <td className="sub whitespace-nowrap">
                    {formatDateCompact(contact.updated_at ?? contact.created_at)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="hp-registry-foot">
        <span>
          Показано {from + 1}–{Math.min(from + PAGE_SIZE, contacts.length)} из {contacts.length}
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className={`hp-page-btn${current === 1 ? ' disabled' : ''}`}
              aria-label="Предыдущая страница"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            {pageNumbers.map((n, i) => (
              <span key={n} className="flex items-center gap-1.5">
                {i > 0 && n - pageNumbers[i - 1] > 1 && (
                  <span className="text-[var(--hp-tertiary)]">…</span>
                )}
                <button
                  onClick={() => setPage(n)}
                  className={`hp-page-btn${n === current ? ' current' : ''}`}
                >
                  {n}
                </button>
              </span>
            ))}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className={`hp-page-btn${current === totalPages ? ' disabled' : ''}`}
              aria-label="Следующая страница"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
