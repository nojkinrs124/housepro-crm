'use client'

import React, { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Building2, Home, User } from 'lucide-react'
import { STAGE_COLORS } from '@/lib/design/stageColors'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function DealsKanbanBoard({ deals: initialDeals }: { deals: any[] }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deals, setDeals] = useState<any[]>(initialDeals)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [draggedDeal, setDraggedDeal] = useState<any | null>(null)
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null)
  const isDragging = useRef(false)

  const columns = [
    { status: 'new',         label: 'Новые',      ...STAGE_COLORS.blue },
    { status: 'showing',     label: 'Показы',     ...STAGE_COLORS.yellow },
    { status: 'negotiation', label: 'Переговоры', ...STAGE_COLORS.orange },
    { status: 'contract',    label: 'Договор',    ...STAGE_COLORS.purple },
    { status: 'payment',     label: 'Оплата',     ...STAGE_COLORS.cyan },
    { status: 'completed',   label: 'Завершено',  ...STAGE_COLORS.green },
  ]

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

    const supabase = createClient()
    const { error } = await supabase
      .from('deals')
      .update({ status: newStatus })
      .eq('id', draggedDeal.id)

    if (error) {
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
    <div className="overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0" style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
      <div className="flex gap-4 min-w-max">
        {columns.map(col => {
          const colDeals = byStatus(col.status)
          const isOver = dragOverStatus === col.status
          return (
            <div
              key={col.status}
              className={`w-[82vw] sm:w-72 md:w-64 border-t-2 ${col.color} border border-border rounded-[20px] flex flex-col transition-colors ${isOver ? 'bg-accent/60 border-primary/30' : 'bg-card'}`}
              style={{ scrollSnapAlign: 'start' }}
              onDragOver={(e) => handleDragOver(e, col.status)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.status)}
            >
              <div className="p-4 border-b border-border flex items-center justify-between">
                <span className="font-semibold text-foreground text-sm">{col.label}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${col.badge}`}>
                  {colDeals.length}
                </span>
              </div>

              <div className="p-3 space-y-2 min-h-48 flex-1">
                {colDeals.length === 0 ? (
                  <div className={`text-center py-8 text-xs transition-colors ${isOver ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                    {isOver ? 'Перетащите сюда' : 'Нет сделок'}
                  </div>
                ) : (
                  colDeals.map(deal => {
                    const ownerContact = deal.owner_contact as { full_name?: string } | null
                    const clientContact = deal.client_contact as { full_name?: string } | null
                    const legacyClient = deal.client as { full_name?: string } | null
                    const property = deal.property as { title?: string; address?: string } | null

                    const ownerName = ownerContact?.full_name
                    const clientName = clientContact?.full_name || legacyClient?.full_name

                    return (
                      <div
                        key={deal.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, deal)}
                        onDragEnd={handleDragEnd}
                        onClick={(e) => handleCardClick(e, deal.id)}
                        className={`bg-background border border-border rounded-xl p-3 space-y-2 hover:shadow-sm transition-all cursor-move select-none ${
                          draggedDeal?.id === deal.id ? 'opacity-40 scale-95' : ''
                        }`}
                      >
                        <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${dealTypeColors[deal.deal_type] ?? 'bg-gray-100 text-gray-600'}`}>
                          {dealTypeLabels[deal.deal_type] ?? deal.deal_type}
                        </span>

                        {ownerName && (
                          <div className="flex items-center gap-1.5 text-xs">
                            <Building2 className="w-3 h-3 text-orange-400 shrink-0" />
                            <span className="truncate text-muted-foreground">{ownerName}</span>
                          </div>
                        )}

                        {clientName && (
                          <div className="flex items-center gap-1.5 text-xs">
                            <User className="w-3 h-3 text-blue-400 shrink-0" />
                            <span className="font-medium truncate text-foreground">{clientName}</span>
                          </div>
                        )}

                        {property && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Home className="w-3 h-3 shrink-0" />
                            <span className="truncate">{property.title ?? property.address}</span>
                          </div>
                        )}

                        {deal.amount && (
                          <div className="text-xs font-semibold text-foreground">
                            {Number(deal.amount).toLocaleString('ru-RU')} ₽
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
