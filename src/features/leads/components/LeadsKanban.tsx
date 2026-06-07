'use client'

import { useState } from 'react'
import { Phone, MessageCircle, UserCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { convertLeadToClient } from '@/features/leads/actions/leads.actions'
import { formAction } from '@/lib/form-action'

const columns = [
  { status: 'new',       label: 'Новые',    color: 'border-t-blue-400',   badge: 'bg-blue-100 text-blue-700' },
  { status: 'contacted', label: 'Связались', color: 'border-t-yellow-400', badge: 'bg-yellow-100 text-yellow-700' },
  { status: 'showing',   label: 'Показ',    color: 'border-t-orange-400',  badge: 'bg-orange-100 text-orange-700' },
  { status: 'searching', label: 'Подбор',   color: 'border-t-purple-400',  badge: 'bg-purple-100 text-purple-700' },
  { status: 'converted', label: 'Клиенты',  color: 'border-t-green-400',   badge: 'bg-green-100 text-green-700' },
  { status: 'closed',    label: 'Закрыты',  color: 'border-t-gray-300',    badge: 'bg-gray-100 text-gray-600' },
]

const sourceLabels: Record<string, string> = {
  avito: 'Авито', cian: 'ЦИАН', whatsapp: 'WhatsApp',
  telegram: 'Telegram', call: 'Звонок', website: 'Сайт',
  referral: 'Рекомендация', other: 'Другое',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function LeadsKanban({ leads: initialLeads }: { leads: any[] }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [leads, setLeads] = useState<any[]>(initialLeads)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [draggedLead, setDraggedLead] = useState<any | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)

  const byStatus = (status: string) => leads.filter(l => l.status === status)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDragStart = (e: React.DragEvent, lead: any) => {
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

    const supabase = createClient()
    const { error } = await supabase
      .from('leads')
      .update({ status: newStatus })
      .eq('id', draggedLead.id)

    if (error) {
      // Rollback
      setLeads(prev => prev.map(l => l.id === draggedLead.id ? { ...l, status: draggedLead.status } : l))
    }

    setDraggedLead(null)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if leaving the column entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverCol(null)
    }
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max">
        {columns.map(col => {
          const colLeads = byStatus(col.status)
          const isOver = dragOverCol === col.status
          return (
            <div
              key={col.status}
              className={`w-64 bg-card border-t-2 ${col.color} border rounded-2xl flex flex-col transition-all ${
                isOver ? 'border-primary/50 shadow-lg shadow-primary/10' : 'border-border'
              }`}
              onDragOver={(e) => handleDragOver(e, col.status)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.status)}
            >
              {/* Column header */}
              <div className="p-4 border-b border-border flex items-center justify-between">
                <span className="font-semibold text-foreground text-sm">{col.label}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${col.badge}`}>
                  {colLeads.length}
                </span>
              </div>

              {/* Drop zone hint */}
              {isOver && draggedLead && (
                <div className="mx-3 mt-2 p-2 border-2 border-dashed border-primary/40 rounded-xl text-center text-xs text-primary/70">
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
                      onDragEnd={() => { setDraggedLead(null); setDragOverCol(null) }}
                      className={`bg-background border border-border rounded-xl p-3 space-y-2 hover:shadow-sm transition-all cursor-move select-none ${
                        draggedLead?.id === lead.id ? 'opacity-40 scale-95' : ''
                      }`}
                    >
                      {/* Name + source */}
                      <div>
                        <a href={`/leads/${lead.id}`}
                          onClick={e => e.stopPropagation()}
                          className="text-sm font-semibold text-foreground hover:text-primary transition">
                          {lead.full_name || 'Без имени'}
                        </a>
                        {lead.source && (
                          <p className="text-xs text-muted-foreground">{sourceLabels[lead.source] ?? lead.source}</p>
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
                            <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-md font-medium">
                              {lead.deal_type === 'rent' ? 'Аренда' : lead.deal_type === 'sale' ? 'Покупка' : lead.deal_type}
                            </span>
                          )}
                          {lead.rooms && (
                            <span className="text-xs px-1.5 py-0.5 bg-muted text-muted-foreground rounded-md">
                              {lead.rooms}к
                            </span>
                          )}
                          {lead.budget_max && (
                            <span className="text-xs px-1.5 py-0.5 bg-green-50 text-green-700 rounded-md font-medium">
                              до {Number(lead.budget_max).toLocaleString('ru-RU')} ₽
                            </span>
                          )}
                        </div>
                      )}

                      {/* Date */}
                      <p className="text-xs text-muted-foreground/60">
                        {new Date(lead.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                      </p>

                      {/* Convert button */}
                      {col.status !== 'converted' && col.status !== 'closed' && (
                        <form action={formAction(convertLeadToClient.bind(null, lead.id))}
                          onClick={e => e.stopPropagation()}>
                          <button type="submit"
                            className="w-full flex items-center justify-center gap-1.5 text-xs px-2 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-all font-medium">
                            <UserCheck className="w-3 h-3" />
                            → Контакт
                          </button>
                        </form>
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
