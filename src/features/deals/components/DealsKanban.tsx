'use client'

import React, { useState } from 'react'
import { toast } from 'sonner'
import { Building2, Home, User } from 'lucide-react'
import { KanbanBoard } from '@/components/kanban/KanbanBoard'
import { updateDealStatusAction } from '../actions/deals.actions'
import { DIRECTIONS, stagesOf } from '@/features/directions/config/directions'
import { DEAL_TYPE_LABELS } from '@/features/deals/config/deal-stages'
import { formatAmount } from '@/lib/utils'
import type { Party, PropertyRef } from '@/features/deals/types/deal-views'

export interface KanbanDeal {
  id: string
  status: string
  deal_type: string
  deal_number: number | null
  amount: number | null
  owner_contact?: Party | null
  client_contact?: Party | null
  property?: PropertyRef | null
}

export function DealsKanbanBoard({ deals: initialDeals }: { deals: KanbanDeal[] }) {
  const [deals, setDeals] = useState(initialDeals)
  const [isDragging, setIsDragging] = useState(false)
  const presentDirections = DIRECTIONS.filter(direction => deals.some(deal => deal.deal_type === direction.value))
  const directions = presentDirections.length ? presentDirections : DIRECTIONS.slice(0, 1)
  const cardClick = (event: React.MouseEvent, id: string) => {
    if (isDragging) event.preventDefault()
    else window.location.href = `/deals/${id}`
  }

  return <div className="space-y-6">{directions.map(direction => {
    const directionDeals = deals.filter(deal => deal.deal_type === direction.value)
    const stages = stagesOf(direction.value)
    return <div key={direction.value} className="space-y-2">
      {directions.length > 1 && <h2 className="text-sm font-semibold text-[var(--hp-ink)]">{direction.label}<span className="ml-2 font-normal text-[var(--hp-sub)]">{directionDeals.length}</span></h2>}
      <KanbanBoard<KanbanDeal> items={directionDeals} columns={stages.map(stage => ({ status: stage.value, label: stage.board }))} onDragStateChange={setIsDragging} onStatusChange={(id, status) => updateDealStatusAction(id, status)} onError={message => toast.error(message)} canDrop={deal => deal.deal_type === direction.value} onInvalidDrop={() => toast.error('Эта стадия относится к другому направлению работы')} boardClassName="flex gap-3 min-w-max" renderColumn={(column, rows, isOver) => {
        const total = rows.reduce((sum, deal) => sum + Number(deal.amount ?? 0), 0)
        return <div key={column.status} data-testid="kanban-column" data-direction={direction.value} data-stage={column.status} className={`w-[82vw] sm:w-72 md:w-[248px] flex flex-col rounded-[var(--hp-radius)] border transition-colors ${isOver ? 'bg-[var(--hp-accent-tint)] border-[var(--hp-accent)]' : 'bg-[var(--hp-surface)] border-[var(--hp-border)]'}`}>
          <div className="hp-block-header flex items-center justify-between"><span>{column.label}</span><span className="tracking-normal text-[11px] text-[var(--hp-ink)]">{rows.length}</span></div>
          {total > 0 && <div className="px-[18px] py-2 text-[12px] text-[var(--hp-sub)] border-b border-[var(--hp-border-soft)]">{formatAmount(total)} ₽</div>}
              <div className="p-2.5 space-y-2 min-h-48 flex-1">{rows.length === 0 ? <div className={`text-center py-8 text-xs ${isOver ? 'text-[var(--hp-accent)] font-semibold' : 'text-[var(--hp-tertiary)]'}`}>{isOver ? 'Перетащите сюда' : 'Нет сделок'}</div> : rows.map(deal => {
                const owner = deal.owner_contact?.company_name || deal.owner_contact?.full_name
                const client = deal.client_contact?.company_name || deal.client_contact?.full_name
                return <div key={deal.id} data-testid="kanban-card" data-deal-id={deal.id} draggable onDragStart={event => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', deal.id) }} onDragEnd={() => setIsDragging(false)} onClick={event => cardClick(event, deal.id)} className="rounded-[var(--hp-radius-sm)] border border-[var(--hp-border)] bg-[var(--hp-bg)] p-3 space-y-1.5 cursor-move select-none transition-colors hover:border-[var(--hp-sub)]">
                  <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-semibold text-[var(--hp-sub)]">{deal.deal_number ? `СД-${deal.deal_number}` : ''}</span><span className="hp-badge hp-badge-neutral" style={{ padding: '1px 8px', fontSize: 10 }}>{DEAL_TYPE_LABELS[deal.deal_type] ?? deal.deal_type}</span></div>
                  {client && <div className="flex items-center gap-1.5 text-[12.5px]"><User className="w-3 h-3 shrink-0 text-[var(--hp-tertiary)]" /><span className="font-semibold truncate text-[var(--hp-ink)]">{client}</span></div>}
                  {owner && <div className="flex items-center gap-1.5 text-[12px]"><Building2 className="w-3 h-3 shrink-0 text-[var(--hp-tertiary)]" /><span className="truncate text-[var(--hp-sub)]">{owner}</span></div>}
                  {deal.property && <div className="flex items-center gap-1.5 text-[12px] text-[var(--hp-sub)]"><Home className="w-3 h-3 shrink-0 text-[var(--hp-tertiary)]" /><span className="truncate">{deal.property.address ?? deal.property.title}</span></div>}
                  {deal.amount && <div className="text-[13px] font-semibold text-[var(--hp-ink)] pt-0.5">{formatAmount(deal.amount)} <span className="text-[var(--hp-tertiary)] font-normal">₽</span></div>}
                </div>
              })}</div>
        </div>
      }} />
    </div>
  })}</div>
}
