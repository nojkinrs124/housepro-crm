'use client'

import React, { useState, useRef } from 'react'
import { Phone, MessageCircle, UserCheck } from 'lucide-react'
import { toast } from 'sonner'
import { updateLeadStatusAction } from '../actions/leads.actions'
import { convertLeadToClient } from '@/features/leads/actions/leads.actions'
import { ServerActionForm } from '@/components/forms/ServerActionForm'
import { STAGE_COLORS } from '@/lib/design/stageColors'
import { LEAD_STATUSES, LEAD_STATUSES_TERMINAL } from '@/features/leads/config/lead-statuses'
import { LEAD_SOURCE_LABELS } from '@/features/leads/config/lead-sources'
import type { LeadRow } from './LeadsListView'

// Колонка на каждый статус: лид, для которого колонки нет, не «уезжает вниз»,
// а пропадает с доски совсем — так до 02.09.2026 терялись interested и rejected.
const columns = LEAD_STATUSES.map(s => ({
 status: s.value,
 label: s.board,
 ...STAGE_COLORS[s.stage],
}))


export function LeadsKanban({ leads: initialLeads }: { leads: LeadRow[] }) {
 const [leads, setLeads] = useState<LeadRow[]>(initialLeads)
 const [draggedLead, setDraggedLead] = useState<LeadRow | null>(null)
 const isDragging = useRef(false)
 const [dragOverCol, setDragOverCol] = useState<string | null>(null)

 const byStatus = (status: string) => leads.filter(l => l.status === status)

 const handleDragStart = (e: React.DragEvent, lead: LeadRow) => {
 isDragging.current = true
 setDraggedLead(lead)
 e.dataTransfer.effectAllowed = 'move'
 }

 const handleDragOver = (e: React.DragEvent, colStatus: string) => {
 e.preventDefault()
 e.dataTransfer.dropEffect = 'move'
 setDragOverCol(colStatus)
 }

 const handleDrop = async (e: React.DragEvent, newStatus: string) => {
 e.preventDefault()
 setDragOverCol(null)
 if (!draggedLead || draggedLead.status === newStatus) {
 setDraggedLead(null)
 return
 }

 // Optimistic update
 setLeads(prev => prev.map(l => l.id === draggedLead.id ? { ...l, status: newStatus } : l))

 // Через server action, а не браузерный клиент Supabase: тот требует
 // NEXT_PUBLIC_SUPABASE_* в бандле, и без них перетаскивание молча не
 // сохранялось — карточка переезжала на экране, а в базу ничего не шло.
 // Заодно экшен проверяет права роли, чего прямой запрос из браузера не делал.
 const res = await updateLeadStatusAction(draggedLead.id, newStatus)

 if (res?.error) {
 // Rollback + видимая причина: молчаливый откат карточки читается как «лагает»,
 // а не как отказ сервера.
 setLeads(prev => prev.map(l => l.id === draggedLead.id ? { ...l, status: draggedLead.status } : l))
 toast.error(res.error)
 }

 setDraggedLead(null)
 isDragging.current = false
 }

 const handleDragLeave = (e: React.DragEvent) => {
 // Only clear if leaving the column entirely
 if (!e.currentTarget.contains(e.relatedTarget as Node)) {
 setDragOverCol(null)
 }
 }

 return (
 <div className="overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0" style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
 <div className="flex gap-4 min-w-max">
 {columns.map(col => {
 const colLeads = byStatus(col.status)
 const isOver = dragOverCol === col.status
 return (
 <div
 key={col.status}
 className={`w-[82vw] sm:w-72 md:w-64 bg-card border-t-2 ${col.color} border flex flex-col transition-all ${
 isOver ? 'border-primary/50 shadow-primary/10' : 'border-border'
 }`}
 style={{ scrollSnapAlign: 'start' }}
 onDragOver={(e) => handleDragOver(e, col.status)}
 onDragLeave={handleDragLeave}
 onDrop={(e) => handleDrop(e, col.status)}
 >
 {/* Column header */}
 <div className="p-4 border-b border-border flex items-center justify-between">
 <span className="font-semibold text-foreground text-sm">{col.label}</span>
 <span className={`text-xs px-2 py-0.5 rounded-[var(--hp-radius-badge)] font-medium ${col.badge}`}>
 {colLeads.length}
 </span>
 </div>

 {/* Drop zone hint */}
 {isOver && draggedLead && (
 <div className="mx-3 mt-2 p-2 border-2 border-dashed border-primary/40 text-center text-xs text-primary/70">
 Переместить сюда
 </div>
 )}

 {/* Cards */}
 <div className="p-3 space-y-2 min-h-40 flex-1">
 {colLeads.length === 0 && !isOver ? (
 <div className="text-center py-6 text-muted-foreground text-xs">Нет лидов</div>
 ) : (
 colLeads.map(lead => (
 <div
 key={lead.id}
 draggable
 onDragStart={(e) => handleDragStart(e, lead)}
 onDragEnd={() => { setDraggedLead(null); setDragOverCol(null); isDragging.current = false }}
 className={`bg-background border border-border p-3 space-y-2 transition-all cursor-move select-none ${
 draggedLead?.id === lead.id ? 'opacity-40 scale-95' : ''
 }`}
 >
 {/* Name + source */}
 <div>
 <a href={`/leads/${lead.id}`}
 onClick={e => { if (isDragging.current) e.preventDefault() }}
 className="text-sm font-semibold text-foreground hover:text-primary transition">
 {lead.full_name || 'Без имени'}
 </a>
 {lead.source && (
 <p className="text-xs text-muted-foreground">{LEAD_SOURCE_LABELS[lead.source] ?? lead.source}</p>
 )}
 </div>

 {/* Contacts */}
 <div className="space-y-1">
 {lead.phone && (
 <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
 <Phone className="w-3 h-3 shrink-0" />
 <a href={`tel:${lead.phone}`} className="hover:text-primary transition" onClick={e => e.stopPropagation()}>
 {lead.phone}
 </a>
 </div>
 )}
 {lead.telegram && (
 <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
 <MessageCircle className="w-3 h-3 shrink-0" />
 {lead.telegram}
 </div>
 )}
 </div>

 {lead.comment && (
 <p className="text-xs text-muted-foreground line-clamp-2">{lead.comment}</p>
 )}

 {/* Criteria preview */}
 {(lead.budget_max || lead.deal_type || lead.rooms) && (
 <div className="flex flex-wrap gap-1">
 {lead.deal_type && (
 <span className="text-xs px-1.5 py-0.5 bg-[var(--hp-info-tint)] text-[var(--hp-info)] font-medium">
 {lead.deal_type === 'rent' ? 'Аренда' : lead.deal_type === 'sale' ? 'Покупка' : lead.deal_type}
 </span>
 )}
 {lead.rooms && (
 <span className="text-xs px-1.5 py-0.5 bg-muted text-muted-foreground">
 {lead.rooms}к
 </span>
 )}
 {lead.budget_max && (
 <span className="text-xs px-1.5 py-0.5 bg-[var(--hp-good-tint)] text-[var(--hp-good)] font-medium">
 до {Number(lead.budget_max).toLocaleString('ru-RU')} ₽
 </span>
 )}
 </div>
 )}

 {/* Date */}
 {lead.created_at && (
 <p className="text-xs text-muted-foreground/60">
 {new Date(lead.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
 </p>
 )}

 {/* Convert button */}
 {!LEAD_STATUSES_TERMINAL.includes(col.status) && (
 <ServerActionForm action={convertLeadToClient.bind(null, lead.id)}
 onClick={e => e.stopPropagation()}>
 <button type="submit"
 className="w-full flex items-center justify-center gap-1.5 text-xs px-2 py-1.5 bg-[var(--hp-good-tint)] text-[var(--hp-good)] hover:bg-[var(--hp-accent-hover)] transition-all font-medium">
 <UserCheck className="w-3 h-3" />
 → Контакт
 </button>
 </ServerActionForm>
 )}
 </div>
 ))
 )}
 </div>
 </div>
 )
 })}
 </div>
 </div>
 )
}
