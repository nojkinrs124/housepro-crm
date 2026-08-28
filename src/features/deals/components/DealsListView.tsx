'use client'

import React from 'react'
import Link from 'next/link'
import { Building2, User, Home, ExternalLink } from 'lucide-react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function DealsListView({ deals }: { deals: any[] }) {
 const dealTypeLabels: Record<string, string> = {
 rent: 'Аренда', sale: 'Продажа',
 management: 'Управление', commercial: 'Коммерция', subrent: 'Субаренда',
 }
 const dealTypeColors: Record<string, string> = {
 rent: 'bg-blue-100 text-blue-700',
 sale: 'bg-green-100 text-green-700',
 management: 'bg-purple-100 text-purple-700',
 commercial: 'bg-orange-100 text-orange-700',
 subrent: 'bg-pink-100 text-pink-700',
 }
 const statusLabels: Record<string, string> = {
 new: 'Новая', showing: 'Показ', negotiation: 'Переговоры',
 contract: 'Договор', payment: 'Оплата', completed: 'Завершено', cancelled: 'Отменено',
 }
 const statusColors: Record<string, string> = {
 new: 'bg-blue-50 text-blue-600 border-blue-200',
 showing: 'bg-yellow-50 text-yellow-700 border-yellow-200',
 negotiation: 'bg-orange-50 text-orange-600 border-orange-200',
 contract: 'bg-purple-50 text-purple-600 border-purple-200',
 payment: 'bg-cyan-50 text-cyan-600 border-cyan-200',
 completed: 'bg-green-50 text-green-700 border-green-200',
 cancelled: 'bg-red-50 text-red-500 border-red-200',
 }

 if (deals.length === 0) {
 return (
 <div className="bg-white border border-slate-200/60 shadow-sm p-16 text-center">
 <p className="text-muted-foreground text-sm">Нет сделок по выбранным фильтрам</p>
 </div>
 )
 }

 return (
 <div className="bg-white border border-slate-200/60 shadow-sm overflow-hidden">
 {/* Desktop table */}
 <div className="hidden md:block overflow-x-auto">
 <table className="w-full">
 <thead>
 <tr className="border-b border-slate-100 bg-slate-50/60">
 <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-[180px]">Тип</th>
 <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Клиент</th>
 <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Собственник</th>
 <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Объект</th>
 <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-[120px]">Статус</th>
 <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-[140px]">Сумма</th>
 <th className="px-5 py-3 w-10"></th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100">
 {deals.map((deal) => {
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const ownerContact = deal.owner_contact as { full_name?: string } | null
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const clientContact = deal.client_contact as { full_name?: string } | null
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const legacyClient = deal.client as { full_name?: string } | null
 const property = deal.property as { title?: string; address?: string } | null

 const ownerName = ownerContact?.full_name
 const clientName = clientContact?.full_name || legacyClient?.full_name
 const propLabel = property?.title ?? property?.address

 return (
 <tr
 key={deal.id}
 className="hover:bg-slate-50/60 transition-colors group cursor-pointer"
 onClick={() => { window.location.href = `/deals/${deal.id}` }}
 >
 <td className="px-5 py-3.5">
 <span className={`inline-block text-xs px-2.5 py-1 rounded-full font-medium ${dealTypeColors[deal.deal_type] ?? 'bg-gray-100 text-gray-600'}`}>
 {dealTypeLabels[deal.deal_type] ?? deal.deal_type}
 </span>
 </td>
 <td className="px-5 py-3.5">
 {clientName ? (
 <div className="flex items-center gap-2">
 <User className="w-3.5 h-3.5 text-blue-400 shrink-0" />
 <span className="text-sm font-medium text-foreground truncate max-w-[160px]">{clientName}</span>
 </div>
 ) : (
 <span className="text-xs text-slate-400">—</span>
 )}
 </td>
 <td className="px-5 py-3.5">
 {ownerName ? (
 <div className="flex items-center gap-2">
 <Building2 className="w-3.5 h-3.5 text-orange-400 shrink-0" />
 <span className="text-sm text-[#374151] truncate max-w-[160px]">{ownerName}</span>
 </div>
 ) : (
 <span className="text-xs text-slate-400">—</span>
 )}
 </td>
 <td className="px-5 py-3.5">
 {propLabel ? (
 <div className="flex items-center gap-2">
 <Home className="w-3.5 h-3.5 text-slate-400 shrink-0" />
 <span className="text-sm text-[#374151] truncate max-w-[200px]">{propLabel}</span>
 </div>
 ) : (
 <span className="text-xs text-slate-400">—</span>
 )}
 </td>
 <td className="px-5 py-3.5">
 <span className={`inline-block text-xs px-2.5 py-1 rounded-full font-medium border ${statusColors[deal.status] ?? 'bg-gray-50 text-gray-500 border-gray-200'}`}>
 {statusLabels[deal.status] ?? deal.status}
 </span>
 </td>
 <td className="px-5 py-3.5 text-right">
 {deal.amount ? (
 <span className="text-sm font-semibold text-foreground">
 {Number(deal.amount).toLocaleString('ru-RU')} ₽
 </span>
 ) : (
 <span className="text-xs text-slate-400">—</span>
 )}
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
 {deals.map((deal) => {
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const clientContact = deal.client_contact as { full_name?: string } | null
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const legacyClient = deal.client as { full_name?: string } | null
 const property = deal.property as { title?: string; address?: string } | null
 const clientName = clientContact?.full_name || legacyClient?.full_name
 const propLabel = property?.title ?? property?.address

 return (
 <Link key={deal.id} href={`/deals/${deal.id}`} className="block p-4 hover:bg-slate-50/60 transition-colors">
 <div className="flex items-center justify-between mb-2">
 <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${dealTypeColors[deal.deal_type] ?? 'bg-gray-100 text-gray-600'}`}>
 {dealTypeLabels[deal.deal_type] ?? deal.deal_type}
 </span>
 <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${statusColors[deal.status] ?? 'bg-gray-50 text-gray-500 border-gray-200'}`}>
 {statusLabels[deal.status] ?? deal.status}
 </span>
 </div>
 {clientName && <p className="text-sm font-medium text-foreground truncate">{clientName}</p>}
 {propLabel && <p className="text-xs text-muted-foreground truncate mt-0.5">{propLabel}</p>}
 {deal.amount && (
 <p className="text-sm font-semibold text-[#16A34A] mt-1.5">
 {Number(deal.amount).toLocaleString('ru-RU')} ₽
 </p>
 )}
 </Link>
 )
 })}
 </div>
 </div>
 )
}
