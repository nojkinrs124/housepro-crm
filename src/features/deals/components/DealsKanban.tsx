'use client'

import React, { useState } from 'react'
import { toast } from 'sonner'
import { Building2, Home, User } from 'lucide-react'
import { KanbanBoard } from '@/components/kanban/KanbanBoard'
import { updateDealStatusAction } from '../actions/deals.actions'
import { DIRECTIONS, stagesOf, terminalStageOf, isTerminal } from '@/features/directions/config/directions'
import { usePersistedState } from '@/hooks/usePersistedFilters'
import { formatAmount, shortAddress } from '@/lib/utils'
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

/** Активная колонка: столько карточек до «Показать ещё». */
const ACTIVE_LIMIT = 20
/** Колонка «Завершены»: история, не работа — показываем последние. */
const DONE_LIMIT = 5

export function DealsKanbanBoard({ deals: initialDeals }: { deals: KanbanDeal[] }) {
  const [deals] = useState(initialDeals)
  const [isDragging, setIsDragging] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const presentDirections = DIRECTIONS.filter(direction => deals.some(deal => deal.deal_type === direction.value))
  const directions = presentDirections.length ? presentDirections : DIRECTIONS.slice(0, 1)
  const activeCount = (code: string) => deals.filter(d => d.deal_type === code && !isTerminal(code, d.status)).length
  // Одна доска за раз (просьба владельца 25.10.2026): две воронки друг под
  // другом с разной горизонтальной прокруткой читались как одна сломанная.
  // По умолчанию — направление, где больше сделок в работе.
  const [picked, setPicked] = usePersistedState<string>('deals:kanban-direction', '')
  const fallback = [...directions].sort((a, b) => activeCount(b.value) - activeCount(a.value))[0]
  const current = directions.find(d => d.value === picked) ?? fallback
  const cardClick = (event: React.MouseEvent, id: string) => {
    if (isDragging) event.preventDefault()
    else window.location.href = `/deals/${id}`
  }

  return <div className="space-y-3">
    {directions.length > 1 && (
      <div role="tablist" aria-label="Направление" className="flex flex-wrap gap-2">
        {directions.map(d => {
          const total = deals.filter(deal => deal.deal_type === d.value).length
          const active = activeCount(d.value)
          const on = d.value === current.value
          return (
            <button key={d.value} type="button" role="tab" aria-selected={on} onClick={() => setPicked(d.value)}
              className={`hp-chip${on ? ' active' : ''}`}>
              {d.shortLabel}
              <span className="font-normal text-[var(--hp-sub)]">{active > 0 ? `${active} в работе · ${total}` : total}</span>
            </button>
          )
        })}
      </div>
    )}
    {[current].map(direction => {
    const directionDeals = deals.filter(deal => deal.deal_type === direction.value)
    const stages = stagesOf(direction.value)
    return <div key={direction.value}>
      <KanbanBoard<KanbanDeal> items={directionDeals} columns={stages.map(stage => ({ status: stage.value, label: stage.board }))} onDragStateChange={setIsDragging} onStatusChange={(id, status) => updateDealStatusAction(id, status)} onError={message => toast.error(message)} canDrop={deal => deal.deal_type === direction.value} onInvalidDrop={() => toast.error('Эта стадия относится к другому направлению работы')} boardClassName="flex gap-3 min-w-max" renderColumn={(column, rows, isOver) => {
        const total = rows.reduce((sum, deal) => sum + Number(deal.amount ?? 0), 0)
        // Завершённая стадия (в управлении «Обслуживание» — это работа, её не сворачиваем)
        const isDone = column.status === terminalStageOf(direction.value) && column.status === 'completed'
        const limit = isDone ? DONE_LIMIT : ACTIVE_LIMIT
        const key = `${direction.value}:${column.status}`
        const visible = expanded[key] ? rows : rows.slice(0, limit)
        return <div key={column.status} data-testid="kanban-column" data-direction={direction.value} data-stage={column.status} className={`w-[82vw] sm:w-72 md:w-[248px] flex flex-col rounded-[var(--hp-radius)] border transition-colors ${isOver ? 'bg-[var(--hp-accent-tint)] border-[var(--hp-accent)]' : isDone ? 'bg-[var(--hp-bg)] border-[var(--hp-border)]' : 'bg-[var(--hp-surface)] border-[var(--hp-border)]'}`}>
          <div className="hp-block-header flex items-center justify-between"><span>{column.label}</span><span className="tracking-normal text-[12px] text-[var(--hp-ink)]">{rows.length}</span></div>
          {total > 0 && <div className="px-[18px] py-2 text-[12px] text-[var(--hp-sub)] border-b border-[var(--hp-border-soft)]">{formatAmount(total)} ₽</div>}
              <div className="p-2.5 space-y-2 min-h-48 flex-1">{rows.length === 0 ? <div className={`text-center py-8 text-xs ${isOver ? 'text-[var(--hp-accent)] font-semibold' : 'text-[var(--hp-tertiary)]'}`}>{isOver ? 'Перетащите сюда' : 'Нет сделок'}</div> : visible.map(deal => {
                const owner = deal.owner_contact?.company_name || deal.owner_contact?.full_name
                const client = deal.client_contact?.company_name || deal.client_contact?.full_name
                return <div key={deal.id} data-testid="kanban-card" data-deal-id={deal.id} draggable onDragStart={event => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', deal.id) }} onDragEnd={() => setIsDragging(false)} onClick={event => cardClick(event, deal.id)} className="rounded-[var(--hp-radius-sm)] border border-[var(--hp-border)] bg-[var(--hp-bg)] p-3 space-y-1.5 cursor-move select-none transition-colors hover:border-[var(--hp-sub)]">
                  {/* Тип сделки не повторяем на каждой карточке — доска уже разбита по направлениям */}
                  {deal.deal_number && <div className="text-[11.5px] font-semibold text-[var(--hp-sub)]">СД-{deal.deal_number}</div>}
                  {client && <div className="flex items-center gap-1.5 text-[12.5px]"><User className="w-3 h-3 shrink-0 text-[var(--hp-tertiary)]" /><span className="font-semibold truncate text-[var(--hp-ink)]">{client}</span></div>}
                  {owner && <div className="flex items-center gap-1.5 text-[12px]"><Building2 className="w-3 h-3 shrink-0 text-[var(--hp-tertiary)]" /><span className="truncate text-[var(--hp-sub)]">{owner}</span></div>}
                  {deal.property && <div className="flex items-center gap-1.5 text-[12px] text-[var(--hp-sub)]"><Home className="w-3 h-3 shrink-0 text-[var(--hp-tertiary)]" /><span className="truncate" title={deal.property.address ?? undefined}>{deal.property.address ? shortAddress(deal.property.address) : deal.property.title}</span></div>}
                  {deal.amount ? <div className="hp-price text-[15px] text-[var(--hp-ink)] pt-0.5">{formatAmount(deal.amount)} ₽</div> : null}
                </div>
              })}
              {rows.length > limit && (
                <button
                  type="button"
                  onClick={() => setExpanded(state => ({ ...state, [key]: !state[key] }))}
                  className="w-full py-2 text-[12.5px] font-semibold text-[var(--hp-sub)] border border-dashed border-[var(--hp-border)] hover:text-[var(--hp-ink)] hover:border-[var(--hp-sub)] transition-colors"
                >
                  {expanded[key] ? 'Свернуть' : isDone ? `Показать все (${rows.length})` : `Показать ещё ${rows.length - limit}`}
                </button>
              )}</div>
        </div>
      }} />
    </div>
  })}</div>
}
