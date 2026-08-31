'use client'

import React from 'react'
import Link from 'next/link'
import { Phone, MessageCircle, ExternalLink, User } from 'lucide-react'

const statusLabels: Record<string, string> = {
 new: 'Новый',
 in_work: 'В работе',
 converted: 'Конвертирован',
 rejected: 'Отказ',
}
const statusColors: Record<string, string> = {
 new: 'bg-[var(--hp-info-tint)] text-[var(--hp-info)] border-[var(--hp-border)]',
 in_work: 'bg-[var(--hp-warn-tint)] text-[var(--hp-warn)] border-[var(--hp-border)]',
 converted: 'bg-[var(--hp-good-tint)] text-[var(--hp-good)] border-[var(--hp-border)]',
 rejected: 'bg-[var(--hp-danger-tint)] text-[var(--hp-danger)] border-[var(--hp-border)]',
}
const sourceLabels: Record<string, string> = {
 avito: 'Авито',
 cian: 'Циан',
 website: 'Сайт',
 referral: 'Рекомендация',
 instagram: 'Instagram',
 phone: 'Телефон',
 other: 'Другое',
}
const dealTypeLabels: Record<string, string> = {
 rent: 'Аренда',
 sale: 'Продажа',
 management: 'Управление',
 commercial: 'Коммерция',
 subrent: 'Субаренда',
}
const dealTypeColors: Record<string, string> = {
 rent: 'bg-[var(--hp-info-tint)] text-[var(--hp-info)]',
 sale: 'bg-[var(--hp-good-tint)] text-[var(--hp-good)]',
 management: 'bg-[var(--hp-neutral-tint)] text-[var(--hp-sub)]',
 commercial: 'bg-[var(--hp-warn-tint)] text-[var(--hp-warn)]',
 subrent: 'bg-[var(--hp-neutral-tint)] text-[var(--hp-sub)]',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function LeadsListView({ leads }: { leads: any[] }) {
 if (leads.length === 0) {
 return (
 <div className="hp-card p-16 text-center">
 <p className="text-muted-foreground text-sm">Нет лидов по выбранным фильтрам</p>
 </div>
 )
 }

 return (
 <div className="hp-card overflow-hidden">
 {/* Desktop table */}
 <div className="hidden md:block overflow-x-auto">
 <table className="w-full">
 <thead>
 <tr className="border-b border-[var(--hp-border-soft)] bg-[var(--hp-neutral-tint)]">
 <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Имя</th>
 <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-[140px]">Телефон</th>
 <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-[130px]">Тип</th>
 <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-[120px]">Источник</th>
 <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-[130px]">Статус</th>
 <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-[160px]">Бюджет</th>
 <th className="px-5 py-3 w-10"></th>
 </tr>
 </thead>
 <tbody className="divide-y divide-[var(--hp-border-soft)]">
 {leads.map((lead) => {
 const budgetStr = lead.budget_min || lead.budget_max
 ? [lead.budget_min, lead.budget_max]
 .filter(Boolean)
 .map((v: number) => Number(v).toLocaleString('ru-RU'))
 .join(' – ') + ' ₽'
 : null

 return (
 <tr
 key={lead.id}
 className="hover:bg-[var(--hp-neutral-tint)] transition-colors group cursor-pointer"
 onClick={() => { window.location.href = `/leads/${lead.id}` }}
 >
 <td className="px-5 py-3.5">
 <div className="flex items-center gap-2">
 <div className="w-7 h-7 rounded-[var(--hp-radius)] bg-[var(--hp-neutral-tint)] flex items-center justify-center shrink-0">
 <User className="w-3.5 h-3.5 text-white" />
 </div>
 <span className="text-sm font-semibold text-foreground truncate max-w-[180px]">{lead.full_name || '—'}</span>
 </div>
 </td>
 <td className="px-5 py-3.5">
 {lead.phone ? (
 <div className="flex items-center gap-1.5">
 <Phone className="w-3 h-3 text-[var(--hp-tertiary)] shrink-0" />
 <span className="text-sm text-[var(--hp-ink)]">{lead.phone}</span>
 </div>
 ) : (
 <span className="text-xs text-[var(--hp-tertiary)]">—</span>
 )}
 </td>
 <td className="px-5 py-3.5">
 {lead.deal_type ? (
 <span className={`inline-block text-xs px-2.5 py-1 rounded-[var(--hp-radius-badge)] font-medium ${dealTypeColors[lead.deal_type] ?? 'bg-[var(--hp-neutral-tint)] text-[var(--hp-sub)]'}`}>
 {dealTypeLabels[lead.deal_type] ?? lead.deal_type}
 </span>
 ) : (
 <span className="text-xs text-[var(--hp-tertiary)]">—</span>
 )}
 </td>
 <td className="px-5 py-3.5">
 <span className="text-xs text-muted-foreground">
 {sourceLabels[lead.source] ?? lead.source ?? '—'}
 </span>
 </td>
 <td className="px-5 py-3.5">
 <span className={`inline-block text-xs px-2.5 py-1 rounded-[var(--hp-radius-badge)] font-medium border ${statusColors[lead.status] ?? 'bg-[var(--hp-neutral-tint)] text-[var(--hp-sub)] border-[var(--hp-border)]'}`}>
 {statusLabels[lead.status] ?? lead.status}
 </span>
 </td>
 <td className="px-5 py-3.5 text-right">
 {budgetStr ? (
 <span className="text-sm font-semibold text-foreground">{budgetStr}</span>
 ) : (
 <span className="text-xs text-[var(--hp-tertiary)]">—</span>
 )}
 </td>
 <td className="px-5 py-3.5">
 <ExternalLink className="w-4 h-4 text-[var(--hp-tertiary)] group-hover:text-[var(--hp-sub)] transition-colors" />
 </td>
 </tr>
 )
 })}
 </tbody>
 </table>
 </div>

 {/* Mobile cards */}
 <div className="md:hidden divide-y divide-[var(--hp-border-soft)]">
 {leads.map((lead) => {
 const budgetStr = lead.budget_min || lead.budget_max
 ? [lead.budget_min, lead.budget_max]
 .filter(Boolean)
 .map((v: number) => Number(v).toLocaleString('ru-RU'))
 .join(' – ') + ' ₽'
 : null

 return (
 <Link key={lead.id} href={`/leads/${lead.id}`} className="block p-4 hover:bg-[var(--hp-neutral-tint)] transition-colors">
 <div className="flex items-center justify-between gap-2 mb-2">
 <span className="text-sm font-semibold text-foreground truncate min-w-0 flex-1">{lead.full_name || '—'}</span>
 <span className={`text-xs px-2 py-0.5 rounded-[var(--hp-radius-badge)] font-medium border whitespace-nowrap shrink-0 ${statusColors[lead.status] ?? 'bg-[var(--hp-neutral-tint)] text-[var(--hp-sub)] border-[var(--hp-border)]'}`}>
 {statusLabels[lead.status] ?? lead.status}
 </span>
 </div>
 {lead.phone && (
 <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
 <Phone className="w-3 h-3 shrink-0" />
 <span>{lead.phone}</span>
 </div>
 )}
 <div className="flex items-center gap-2 mt-2 flex-wrap">
 {lead.deal_type && (
 <span className={`text-xs px-2 py-0.5 rounded-[var(--hp-radius-badge)] font-medium ${dealTypeColors[lead.deal_type] ?? 'bg-[var(--hp-neutral-tint)] text-[var(--hp-sub)]'}`}>
 {dealTypeLabels[lead.deal_type] ?? lead.deal_type}
 </span>
 )}
 {lead.source && (
 <span className="text-xs text-[var(--hp-tertiary)]">{sourceLabels[lead.source] ?? lead.source}</span>
 )}
 </div>
 {budgetStr && (
 <p className="text-sm font-semibold text-[var(--hp-accent)] mt-1.5">{budgetStr}</p>
 )}
 {lead.phone && (
 <div className="flex gap-2 mt-3">
 <a
 href={`tel:${lead.phone}`}
 onClick={e => e.stopPropagation()}
 className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold bg-[var(--hp-good-tint)] text-[var(--hp-good)] border border-[var(--hp-border)]"
 >
 <Phone className="w-3 h-3" />
 Звонок
 </a>
 <a
 href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`}
 target="_blank" rel="noopener noreferrer"
 onClick={e => e.stopPropagation()}
 className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold bg-[var(--hp-good-tint)] text-[var(--hp-good)] border border-[var(--hp-border)]"
 >
 <MessageCircle className="w-3 h-3" />
 WA
 </a>
 </div>
 )}
 </Link>
 )
 })}
 </div>
 </div>
 )
}
