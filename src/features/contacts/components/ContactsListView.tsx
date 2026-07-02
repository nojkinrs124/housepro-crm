'use client'

import React from 'react'
import Link from 'next/link'
import { Phone, Mail, MessageCircle, TrendingUp, FileText, ExternalLink } from 'lucide-react'
import type { Contact } from '@/types/database'

const roleConfig: Record<string, { label: string; cls: string }> = {
  client: { label: 'Клиент',      cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
  owner:  { label: 'Собственник', cls: 'bg-green-50 text-green-700 border border-green-200' },
  both:   { label: 'Кл.+Собств.', cls: 'bg-violet-50 text-violet-700 border border-violet-200' },
}
const statusConfig: Record<string, { label: string; cls: string }> = {
  new:      { label: 'Новый',      cls: 'bg-slate-50 text-slate-600 border-slate-200' },
  active:   { label: 'Активный',   cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  vip:      { label: 'VIP',        cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  inactive: { label: 'Неактивный', cls: 'bg-red-50 text-red-600 border-red-200' },
}

const avatarGradients = [
  ['#16A34A', '#22C55E'], ['#3B82F6', '#60A5FA'], ['#8B5CF6', '#A78BFA'],
  ['#F59E0B', '#FBBF24'], ['#06B6D4', '#22D3EE'], ['#EF4444', '#F87171'],
]

export function ContactsListView({ contacts }: { contacts: Contact[] }) {
  if (contacts.length === 0) {
    return (
      <div className="bg-white rounded-[20px] border border-slate-200/60 shadow-sm p-16 text-center">
        <p className="text-[#64748B] text-sm">Нет контактов по выбранным фильтрам</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-[20px] border border-slate-200/60 shadow-sm overflow-hidden">
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60">
              <th className="text-left px-5 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wide">Контакт</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wide w-[150px]">Телефон</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wide w-[200px]">Email</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wide w-[130px]">Роль</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wide w-[120px]">Статус</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wide w-[140px]">Источник</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wide w-[130px]">Действия</th>
              <th className="px-5 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {contacts.map((contact, idx) => {
              const role = roleConfig[contact.role] ?? roleConfig.client
              const status = statusConfig[contact.status] ?? statusConfig.new
              const [c1, c2] = avatarGradients[idx % avatarGradients.length]
              const initials = contact.full_name
                ?.split(' ').slice(0, 2).map(n => n.charAt(0).toUpperCase()).join('') ?? 'U'

              return (
                <tr
                  key={contact.id}
                  className="hover:bg-slate-50/60 transition-colors group cursor-pointer"
                  onClick={() => { window.location.href = `/contacts/${contact.id}` }}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
                      >
                        {initials}
                      </div>
                      <span className="text-sm font-semibold text-[#111827] truncate max-w-[160px]">
                        {contact.full_name}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    {contact.phone ? (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="text-sm text-[#374151]">{contact.phone}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {contact.email ? (
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="text-sm text-[#374151] truncate max-w-[180px]">{contact.email}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-block text-xs px-2.5 py-1 rounded-full font-medium border ${role.cls}`}>
                      {role.label}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-block text-xs px-2.5 py-1 rounded-full font-medium border ${status.cls}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs text-[#64748B]">{contact.source ?? '—'}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                      {contact.phone && (
                        <a
                          href={`tel:${contact.phone}`}
                          className="p-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                          title="Позвонить"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {contact.phone && (
                        <a
                          href={`https://wa.me/${contact.phone.replace(/\D/g, '')}`}
                          target="_blank" rel="noopener noreferrer"
                          className="p-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                          title="WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <Link
                        href={`/deals/new?contact_id=${contact.id}`}
                        className="p-1.5 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors"
                        title="Создать сделку"
                      >
                        <TrendingUp className="w-3.5 h-3.5" />
                      </Link>
                      <Link
                        href={`/contracts/new?contact_id=${contact.id}`}
                        className="p-1.5 rounded-lg bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors"
                        title="Создать договор"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-slate-100">
        {contacts.map((contact, idx) => {
          const role = roleConfig[contact.role] ?? roleConfig.client
          const status = statusConfig[contact.status] ?? statusConfig.new
          const [c1, c2] = avatarGradients[idx % avatarGradients.length]
          const initials = contact.full_name
            ?.split(' ').slice(0, 2).map(n => n.charAt(0).toUpperCase()).join('') ?? 'U'

          return (
            <Link key={contact.id} href={`/contacts/${contact.id}`} className="block p-4 hover:bg-slate-50/60 transition-colors">
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0"
                  style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
                >
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#111827] truncate">{contact.full_name}</p>
                  {contact.phone && <p className="text-xs text-[#64748B] truncate mt-0.5">{contact.phone}</p>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${status.cls} shrink-0`}>
                  {status.label}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${role.cls}`}>
                  {role.label}
                </span>
                {contact.source && (
                  <span className="text-xs text-slate-400">{contact.source}</span>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
