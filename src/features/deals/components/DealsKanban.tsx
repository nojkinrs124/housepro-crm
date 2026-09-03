'use client'

import React, { useState, useRef } from 'react'
import { toast } from 'sonner'
import { Building2, Home, User } from 'lucide-react'
import { updateDealStatusAction } from '../actions/deals.actions'
import { DIRECTIONS, stagesOf } from '@/features/directions/config/directions'
import { DEAL_TYPE_LABELS } from '@/features/deals/config/deal-stages'
import { formatAmount } from '@/lib/utils'
import type { Party, PropertyRef } from '@/features/deals/types/deal-views'


/** Поля, которые доска действительно читает. Страница отдаёт их с запасом. */
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

/**
 * Kanban работ в «Кабинете»: колонки без цветового кодирования — стадия
 * читается по позиции слева направо и по счётчику.
 *
 * С 03.09.2026 доска строится по направлениям: у аренды, управления, продажи и
 * подбора разные воронки, и одной доски на всех больше не существует. Когда в
 * списке работы нескольких направлений, показывается несколько досок подряд.
 *
 * Перетащить работу в колонку чужого направления нельзя: стадия «Регистрация
 * перехода права» не наступает в аренде, и молча принять такой сброс значило бы
 * записать в базу бессмыслицу.
 */
export function DealsKanbanBoard({ deals: initialDeals }: { deals: KanbanDeal[] }) {
  const [deals, setDeals] = useState<KanbanDeal[]>(initialDeals)
  const [draggedDeal, setDraggedDeal] = useState<KanbanDeal | null>(null)
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null)
  const isDragging = useRef(false)

  // Показываем только те направления, работы которых есть в списке: пустые
  // доски занимают экран и ничего не сообщают.
  const presentDirections = DIRECTIONS.filter(d => deals.some(deal => deal.deal_type === d.value))
  const directions = presentDirections.length > 0 ? presentDirections : DIRECTIONS.slice(0, 1)

  const handleDragStart = (e: React.DragEvent, deal: KanbanDeal) => {
    isDragging.current = true
    setDraggedDeal(deal)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', deal.id)
  }

  const handleDragOver = (e: React.DragEvent, status: string, direction: string) => {
    if (draggedDeal && draggedDeal.deal_type !== direction) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverStatus(status)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    const rel = e.relatedTarget as Node | null
    if (!e.currentTarget.contains(rel)) setDragOverStatus(null)
  }

  const handleDrop = async (e: React.DragEvent, newStatus: string, direction: string) => {
    e.preventDefault()
    setDragOverStatus(null)
    if (!draggedDeal) return

    const deal = draggedDeal
    setDraggedDeal(null)
    isDragging.current = false

    if (deal.deal_type !== direction) {
      toast.error('Эта стадия относится к другому направлению работы')
      return
    }
    if (deal.status === newStatus) return

    const prevStatus = deal.status
    setDeals(prev => prev.map(d => d.id === deal.id ? { ...d, status: newStatus } : d))

    // Через server action, а не браузерный клиент Supabase: тот требует
    // NEXT_PUBLIC_SUPABASE_* в бандле, и без них перетаскивание молча не
    // сохранялось — карточка переезжала на экране, а в базу ничего не шло.
    // Заодно экшен проверяет права роли и предусловия перехода.
    const res = await updateDealStatusAction(deal.id, newStatus)

    if (res?.error) {
      setDeals(prev => prev.map(d => d.id === deal.id ? { ...d, status: prevStatus } : d))
      toast.error(res.error)
    }
  }

  const handleDragEnd = () => {
    setDraggedDeal(null)
    setDragOverStatus(null)
    isDragging.current = false
  }

  const handleCardClick = (e: React.MouseEvent, dealId: string) => {
    if (isDragging.current) {
      e.preventDefault()
      return
    }
    window.location.href = `/deals/${dealId}`
  }

  return (
    <div className="space-y-6">
      {directions.map(direction => {
        const directionDeals = deals.filter(d => d.deal_type === direction.value)
        const columns = stagesOf(direction.value)

        return (
          <div key={direction.value} className="space-y-2">
            {directions.length > 1 && (
              <h2 className="text-sm font-semibold text-[var(--hp-ink)]">
                {direction.label}
                <span className="ml-2 font-normal text-[var(--hp-sub)]">{directionDeals.length}</span>
              </h2>
            )}

            <div
              className="overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0"
              style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
            >
              <div className="flex gap-3 min-w-max">
                {columns.map(col => {
                  const colDeals = directionDeals.filter(d => d.status === col.value)
                  const isOver = dragOverStatus === col.value && draggedDeal?.deal_type === direction.value
                  const colSum = colDeals.reduce((s, d) => s + Number(d.amount ?? 0), 0)

                  return (
                    <div
                      key={col.value}
                      className="w-[82vw] sm:w-72 md:w-[248px] flex flex-col rounded-[var(--hp-radius)] border transition-colors"
                      style={{
                        scrollSnapAlign: 'start',
                        background: isOver ? 'var(--hp-accent-tint)' : 'var(--hp-surface)',
                        borderColor: isOver ? 'var(--hp-accent)' : 'var(--hp-border)',
                      }}
                      onDragOver={(e) => handleDragOver(e, col.value, direction.value)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, col.value, direction.value)}
                    >
                      <div className="hp-block-header flex items-center justify-between">
                        <span>{col.board}</span>
                        <span className="tracking-normal text-[11px] text-[var(--hp-ink)]">{colDeals.length}</span>
                      </div>

                      {colSum > 0 && (
                        <div className="px-[18px] py-2 text-[12px] text-[var(--hp-sub)] border-b border-[var(--hp-border-soft)]">
                          {formatAmount(colSum)} ₽
                        </div>
                      )}

                      <div className="p-2.5 space-y-2 min-h-48 flex-1">
                        {colDeals.length === 0 ? (
                          <div className={`text-center py-8 text-xs transition-colors ${isOver ? 'text-[var(--hp-accent)] font-semibold' : 'text-[var(--hp-tertiary)]'}`}>
                            {isOver ? 'Перетащите сюда' : 'Пусто'}
                          </div>
                        ) : (
                          colDeals.map(deal => {
                            const ownerName  = deal.owner_contact?.company_name || deal.owner_contact?.full_name
                            const clientName = deal.client_contact?.company_name || deal.client_contact?.full_name
                            const property = deal.property

                            return (
                              <div
                                key={deal.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, deal)}
                                onDragEnd={handleDragEnd}
                                onClick={(e) => handleCardClick(e, deal.id)}
                                className={`rounded-[var(--hp-radius-sm)] border border-[var(--hp-border)] bg-[var(--hp-bg)] p-3 space-y-1.5 cursor-move select-none transition-colors hover:border-[var(--hp-sub)] ${
                                  draggedDeal?.id === deal.id ? 'opacity-40' : ''
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[11px] font-semibold text-[var(--hp-sub)]">
                                    {deal.deal_number ? `СД-${deal.deal_number}` : ''}
                                  </span>
                                  <span className="hp-badge hp-badge-neutral" style={{ padding: '1px 8px', fontSize: 10 }}>
                                    {DEAL_TYPE_LABELS[deal.deal_type] ?? deal.deal_type}
                                  </span>
                                </div>

                                {clientName && (
                                  <div className="flex items-center gap-1.5 text-[12.5px]">
                                    <User className="w-3 h-3 shrink-0 text-[var(--hp-tertiary)]" />
                                    <span className="font-semibold truncate text-[var(--hp-ink)]">{clientName}</span>
                                  </div>
                                )}

                                {ownerName && (
                                  <div className="flex items-center gap-1.5 text-[12px]">
                                    <Building2 className="w-3 h-3 shrink-0 text-[var(--hp-tertiary)]" />
                                    <span className="truncate text-[var(--hp-sub)]">{ownerName}</span>
                                  </div>
                                )}

                                {property && (
                                  <div className="flex items-center gap-1.5 text-[12px] text-[var(--hp-sub)]">
                                    <Home className="w-3 h-3 shrink-0 text-[var(--hp-tertiary)]" />
                                    <span className="truncate">{property.address ?? property.title}</span>
                                  </div>
                                )}

                                {deal.amount && (
                                  <div className="text-[13px] font-semibold text-[var(--hp-ink)] pt-0.5">
                                    {formatAmount(deal.amount)} <span className="text-[var(--hp-tertiary)] font-normal">₽</span>
                                  </div>
                                )}
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
