'use client'

import React, { useState, useRef } from 'react'
import { updateDealStatusAction } from '../actions/deals.actions'
import { Building2, Home, User } from 'lucide-react'
import { DEAL_STAGES, DEAL_TYPE_LABELS } from '@/features/deals/config/deal-stages'
import { formatAmount } from '@/lib/utils'

/**
 * Kanban сделок в «Кабинете»: колонки без цветового кодирования по этапам —
 * этап читается по позиции слева направо и по счётчику, а единственный акцент
 * в системе один. Цветными раньше были и колонки, и типы сделок, из-за чего
 * доска пестрила шестью палитрами сразу.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function DealsKanbanBoard({ deals: initialDeals }: { deals: any[] }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deals, setDeals] = useState<any[]>(initialDeals)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [draggedDeal, setDraggedDeal] = useState<any | null>(null)
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null)
  const isDragging = useRef(false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byStatus = (status: string) => deals.filter((d: any) => d.status === status)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDragStart = (e: React.DragEvent, deal: any) => {
    isDragging.current = true
    setDraggedDeal(deal)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', deal.id)
  }

  const handleDragOver = (e: React.DragEvent, status: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverStatus(status)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if leaving the column entirely (not just a child element)
    const rel = e.relatedTarget as Node | null
    if (!e.currentTarget.contains(rel)) {
      setDragOverStatus(null)
    }
  }

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault()
    setDragOverStatus(null)
    if (!draggedDeal) return

    if (draggedDeal.status === newStatus) {
      setDraggedDeal(null)
      isDragging.current = false
      return
    }

    const prevStatus = draggedDeal.status
    setDeals(prev => prev.map(d => d.id === draggedDeal.id ? { ...d, status: newStatus } : d))

    // Через server action, а не браузерный клиент Supabase: тот требует
    // NEXT_PUBLIC_SUPABASE_* в бандле, и без них перетаскивание молча не
    // сохранялось — карточка переезжала на экране, а в базу ничего не шло.
    // Заодно экшен проверяет права роли, чего прямой запрос из браузера не делал.
    const res = await updateDealStatusAction(draggedDeal.id, newStatus)

    if (res?.error) {
      setDeals(prev => prev.map(d => d.id === draggedDeal.id ? { ...d, status: prevStatus } : d))
    }

    setDraggedDeal(null)
    isDragging.current = false
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
    <div
      className="overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0"
      style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
    >
      <div className="flex gap-3 min-w-max">
        {DEAL_STAGES.map(col => {
          const colDeals = byStatus(col.value)
          const isOver = dragOverStatus === col.value
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
              onDragOver={(e) => handleDragOver(e, col.value)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.value)}
            >
              <div className="hp-block-header flex items-center justify-between">
                <span>{col.label}</span>
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
                    {isOver ? 'Перетащите сюда' : 'Нет сделок'}
                  </div>
                ) : (
                  colDeals.map(deal => {
                    const ownerContact  = deal.owner_contact  as { full_name?: string; company_name?: string } | null
                    const clientContact = deal.client_contact as { full_name?: string; company_name?: string } | null
                    const legacyClient  = deal.client as { full_name?: string } | null
                    const property = deal.property as { title?: string; address?: string } | null

                    const ownerName  = ownerContact?.company_name || ownerContact?.full_name
                    const clientName = clientContact?.company_name || clientContact?.full_name || legacyClient?.full_name

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
  )
}
