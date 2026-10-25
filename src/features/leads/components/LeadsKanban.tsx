'use client'

import React, { useState } from 'react'
import { Phone, MessageCircle, UserCheck } from 'lucide-react'
import { KanbanBoard } from '@/components/kanban/KanbanBoard'
import { toast } from 'sonner'
import { updateLeadStatusAction } from '../actions/leads.actions'
import { convertLeadToClient } from '@/features/leads/actions/leads.actions'
import { ServerActionForm } from '@/components/forms/ServerActionForm'
import { STAGE_COLORS } from '@/lib/design/stageColors'
import { LEAD_STATUSES, LEAD_STATUSES_TERMINAL } from '@/features/leads/config/lead-statuses'
import { LEAD_SOURCE_LABELS } from '@/features/leads/config/lead-sources'
import type { LeadRow } from './LeadsListView'
import { formatDateCompact } from '@/lib/utils'

const columns = LEAD_STATUSES.map(status => ({ status: status.value, label: status.board, ...STAGE_COLORS[status.stage] }))

export function LeadsKanban({ leads: initialLeads }: { leads: LeadRow[] }) {
  const [isDragging, setIsDragging] = useState(false)
  return (
    <KanbanBoard<LeadRow>
      items={initialLeads}
      columns={columns}
      onDragStateChange={setIsDragging}
      onStatusChange={(id, status) => updateLeadStatusAction(id, status)}
      onError={message => toast.error(message)}
      boardClassName="flex gap-4 min-w-max"
      previewLimit={20}
      columnClassName={(status, isOver) => `w-[82vw] sm:w-72 md:w-64 bg-card border-t-2 ${columns.find(col => col.status === status)?.color ?? ''} border flex flex-col transition-all ${isOver ? 'border-primary/50 shadow-primary/10' : 'border-border'}`}
      renderColumnHeader={(column, leads) => {
        const config = columns.find(candidate => candidate.status === column.status)
        return <div className="p-4 border-b border-border flex items-center justify-between"><span className="font-semibold text-foreground text-sm">{column.label}</span><span className={`text-xs px-2 py-0.5 rounded-[var(--hp-radius-badge)] font-medium ${config?.badge ?? ''}`}>{leads.length}</span></div>
      }}
      renderEmpty={isOver => isOver ? <div className="mx-3 mt-2 p-2 border-2 border-dashed border-primary/40 text-center text-xs text-primary/70">Переместить сюда</div> : <div className="text-center py-6 text-[var(--hp-tertiary)] text-[12.5px]">Нет лидов</div>}
      >
        {(lead) => (
          <div className="bg-background border border-border p-3 space-y-2 transition-all cursor-move select-none">
            <div><a href={`/leads/${lead.id}`} onClick={event => { if (isDragging) event.preventDefault() }} className="text-sm font-semibold text-foreground hover:text-primary transition">{lead.full_name || 'Без имени'}</a>{lead.source && <p className="text-xs text-muted-foreground">{LEAD_SOURCE_LABELS[lead.source] ?? lead.source}</p>}</div>
            <div className="space-y-1">
              {lead.phone && <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Phone className="w-3 h-3 shrink-0" /><a href={`tel:${lead.phone}`} className="hover:text-primary transition" onClick={event => event.stopPropagation()}>{lead.phone}</a></div>}
              {lead.telegram && <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><MessageCircle className="w-3 h-3 shrink-0" />{lead.telegram}</div>}
            </div>
            {lead.comment && <p className="text-xs text-muted-foreground line-clamp-2">{lead.comment}</p>}
            {(lead.budget_max || lead.deal_type || lead.rooms) && <div className="flex flex-wrap gap-1">
              {lead.deal_type && <span className="text-xs px-1.5 py-0.5 bg-[var(--hp-neutral-tint)] text-[var(--hp-sub)] font-medium">{lead.deal_type === 'rent' ? 'Аренда' : lead.deal_type === 'sale' ? 'Покупка' : lead.deal_type}</span>}
              {lead.rooms && <span className="text-xs px-1.5 py-0.5 bg-muted text-muted-foreground">{lead.rooms}к</span>}
              {lead.budget_max && <span className="text-xs px-1.5 py-0.5 bg-[var(--hp-neutral-tint)] text-[var(--hp-ink)] font-semibold">до {Number(lead.budget_max).toLocaleString('ru-RU')} ₽</span>}
            </div>}
            {lead.created_at && <p className="text-xs text-muted-foreground/60">{formatDateCompact(lead.created_at)}</p>}
            {!LEAD_STATUSES_TERMINAL.includes(lead.status as (typeof LEAD_STATUSES_TERMINAL)[number]) && <ServerActionForm action={convertLeadToClient.bind(null, lead.id)} onClick={event => event.stopPropagation()}><button type="submit" className="w-full flex items-center justify-center gap-1.5 text-xs px-2 py-1.5 border border-[var(--hp-border)] text-[var(--hp-accent)] hover:border-[var(--hp-accent)] transition-colors font-semibold"><UserCheck className="w-3 h-3" />→ Контакт</button></ServerActionForm>}
          </div>
        )}
    </KanbanBoard>
  )
}
