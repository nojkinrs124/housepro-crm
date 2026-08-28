'use client'

import React from 'react'
import Link from 'next/link'
import { Phone, Mail, MessageCircle, TrendingUp, FileText, ChevronRight } from 'lucide-react'
import type { Contact } from '@/types/database'

const roleConfig: Record<string, { label: string }> = {
  client: { label: 'Клиент' },
  owner:  { label: 'Собственник' },
  both:   { label: 'Кл.+Собств.' },
}
const statusConfig: Record<string, { label: string; badgeCls: string }> = {
  new:      { label: 'Новый',      badgeCls: 'hp-badge-info' },
  active:   { label: 'Активный',   badgeCls: 'hp-badge-good' },
  vip:      { label: 'VIP',        badgeCls: 'hp-badge-warn' },
  inactive: { label: 'Неактивный', badgeCls: 'hp-badge-neutral' },
}

export function ContactsListView({ contacts }: { contacts: Contact[] }) {
  if (contacts.length === 0) {
    return (
      <div className="hp-card hp-empty">
        <p className="text-[var(--hp-sub)] text-sm">Нет контактов по выбранным фильтрам</p>
      </div>
    )
  }

  return (
    <div className="bg-[var(--hp-surface)] rounded-[var(--hp-radius)] border border-[var(--hp-border)] overflow-hidden">
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--hp-border)] bg-[var(--hp-neutral-tint)]">
              <th className="text-left px-5 py-3 text-[10px] font-bold text-[var(--hp-sub)] uppercase tracking-wide">Контакт</th>
              <th className="text-left px-5 py-3 text-[10px] font-bold text-[var(--hp-sub)] uppercase tracking-wide w-[150px]">Телефон</th>
              <th className="text-left px-5 py-3 text-[10px] font-bold text-[var(--hp-sub)] uppercase tracking-wide w-[200px]">Email</th>
              <th className="text-left px-5 py-3 text-[10px] font-bold text-[var(--hp-sub)] uppercase tracking-wide w-[130px]">Роль</th>
              <th className="text-left px-5 py-3 text-[10px] font-bold text-[var(--hp-sub)] uppercase tracking-wide w-[120px]">Статус</th>
              <th className="text-left px-5 py-3 text-[10px] font-bold text-[var(--hp-sub)] uppercase tracking-wide w-[140px]">Источник</th>
              <th className="text-right px-5 py-3 text-[10px] font-bold text-[var(--hp-sub)] uppercase tracking-wide w-[130px]">Действия</th>
              <th className="px-5 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--hp-border-soft)]">
            {contacts.map((contact) => {
              const role = roleConfig[contact.role] ?? roleConfig.client
              const status = statusConfig[contact.status] ?? statusConfig.new
              const initials = contact.full_name
                ?.split(' ').slice(0, 2).map(n => n.charAt(0).toUpperCase()).join('') ?? 'U'

              return (
                <tr
                  key={contact.id}
                  className="hover:bg-[var(--hp-neutral-tint)] transition-colors group cursor-pointer"
                  onClick={() => { window.location.href = `/contacts/${contact.id}` }}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ background: 'var(--hp-accent)' }}
                      >
                        {initials}
                      </div>
                      <span className="text-sm font-semibold text-[var(--hp-ink)] truncate max-w-[160px]">
                        {contact.full_name}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    {contact.phone ? (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-[var(--hp-tertiary)] shrink-0" />
                        <span className="text-sm text-[var(--hp-ink)]">{contact.phone}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-[var(--hp-tertiary)]">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {contact.email ? (
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3 h-3 text-[var(--hp-tertiary)] shrink-0" />
                        <span className="text-sm text-[var(--hp-ink)] truncate max-w-[180px]">{contact.email}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-[var(--hp-tertiary)]">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="hp-badge hp-badge-neutral">{role.label}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`hp-badge ${status.badgeCls}`}>{status.label}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs text-[var(--hp-sub)]">{contact.source ?? '—'}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                      {contact.phone && (
                        <a
                          href={`tel:${contact.phone}`}
                          className="p-1.5 rounded-[var(--hp-radius)] text-[var(--hp-sub)] hover:text-[var(--hp-ink)] hover:bg-[var(--hp-neutral-tint)] transition-colors"
                          title="Позвонить"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {contact.phone && (
                        <a
                          href={`https://wa.me/${contact.phone.replace(/\D/g, '')}`}
                          target="_blank" rel="noopener noreferrer"
                          className="p-1.5 rounded-[var(--hp-radius)] text-[var(--hp-sub)] hover:text-[var(--hp-ink)] hover:bg-[var(--hp-neutral-tint)] transition-colors"
                          title="WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <Link
                        href={`/deals/new?contact_id=${contact.id}`}
                        className="p-1.5 rounded-[var(--hp-radius)] text-[var(--hp-sub)] hover:text-[var(--hp-ink)] hover:bg-[var(--hp-neutral-tint)] transition-colors"
                        title="Создать сделку"
                      >
                        <TrendingUp className="w-3.5 h-3.5" />
                      </Link>
                      <Link
                        href={`/contracts/new?contact_id=${contact.id}`}
                        className="p-1.5 rounded-[var(--hp-radius)] text-[var(--hp-sub)] hover:text-[var(--hp-ink)] hover:bg-[var(--hp-neutral-tint)] transition-colors"
                        title="Создать договор"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <ChevronRight className="w-4 h-4 text-[var(--hp-tertiary)] group-hover:text-[var(--hp-sub)] transition-colors" />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-[var(--hp-border-soft)]">
        {contacts.map((contact) => {
          const role = roleConfig[contact.role] ?? roleConfig.client
          const status = statusConfig[contact.status] ?? statusConfig.new
          const initials = contact.full_name
            ?.split(' ').slice(0, 2).map(n => n.charAt(0).toUpperCase()).join('') ?? 'U'

          return (
            <Link key={contact.id} href={`/contacts/${contact.id}`} className="block p-4 hover:bg-[var(--hp-neutral-tint)] transition-colors">
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                  style={{ background: 'var(--hp-accent)' }}
                >
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--hp-ink)] truncate">{contact.full_name}</p>
                  {contact.phone && <p className="text-xs text-[var(--hp-sub)] truncate mt-0.5">{contact.phone}</p>}
                </div>
                <span className={`hp-badge ${status.badgeCls} shrink-0`}>{status.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="hp-badge hp-badge-neutral">{role.label}</span>
                {contact.source && (
                  <span className="text-xs text-[var(--hp-tertiary)]">{contact.source}</span>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
