'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Building2, Home, User } from 'lucide-react'
import type { Deal } from '@/types/database'

export function DealsKanbanBoard({ deals: initialDeals }: { deals: Deal[] }) {
  const [deals, setDeals] = useState(initialDeals)
  const [draggedDeal, setDraggedDeal] = useState<Deal | null>(null)

  const columns = [
    { status: 'new', label: 'Новые', color: 'border-t-blue-400' },
    { status: 'showing', label: 'Показы', color: 'border-t-yellow-400' },
    { status: 'negotiation', label: 'Переговоры', color: 'border-t-orange-400' },
    { status: 'contract', label: 'Договор', color: 'border-t-purple-400' },
    { status: 'payment', label: 'Оплата', color: 'border-t-cyan-400' },
    { status: 'completed', label: 'Завершено', color: 'border-t-green-400' },
  ]

  const dealTypeLabels: Record<string, string> = {
    rent: 'Аренда',
    sale: 'Продажа',
    management: 'Управление',
    commercial: 'Коммерция',
    subrent: 'Субаренда',
  }

  const dealTypeColors: Record<string, string> = {
    rent: 'bg-blue-100 text-blue-700',
    sale: 'bg-green-100 text-green-700',
    management: 'bg-purple-100 text-purple-700',
    commercial: 'bg-orange-100 text-orange-700',
    subrent: 'bg-pink-100 text-pink-700',
  }

  const byStatus = (status: string) => deals.filter(d => d.status === status)

  const handleDragStart = (e: React.DragEvent, deal: Deal) => {
    setDraggedDeal(deal)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault()
    if (!draggedDeal) return

    if (draggedDeal.status === newStatus) {
      setDraggedDeal(null)
      return
    }

    // Update in DB
    const supabase = createClient()
    const { error } = await supabase
      .from('deals')
      .update({ status: newStatus })
      .eq('id', draggedDeal.id)

    if (!error) {
      // Update local state
      setDeals(deals.map(d => (d.id === draggedDeal.id ? { ...d, status: newStatus } : d)))
    }

    setDraggedDeal(null)
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max">
        {columns.map(col => {
          const colDeals = byStatus(col.status)
          return (
            <div
              key={col.status}
              className={`w-64 bg-card border-t-2 ${col.color} border border-border rounded-2xl flex flex-col`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.status)}
            >
              <div className="p-4 border-b border-border flex items-center justify-between">
                <span className="font-semibold text-foreground text-sm">{col.label}</span>
                <span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full font-medium">
                  {colDeals.length}
                </span>
              </div>

              <div className="p-3 space-y-2 min-h-48 flex-1">
                {colDeals.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-xs">Нет сделок</div>
                ) : (
                  colDeals.map(deal => {
                    const client = deal.client as { full_name?: string } | null
                    const owner = deal.owner as { full_name?: string } | null
                    const property = deal.property as { title?: string; address?: string } | null

                    return (
                      <div
                        key={deal.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, deal)}
                        className="bg-background border border-border rounded-xl p-3 space-y-2 hover:shadow-sm transition-all cursor-move"
                      >
                        {/* Type badge */}
                        <span
                          className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${dealTypeColors[deal.deal_type] ?? 'bg-gray-100 text-gray-600'}`}
                        >
                          {dealTypeLabels[deal.deal_type] ?? deal.deal_type}
                        </span>

                        {/* Owner */}
                        {owner?.full_name && (
                          <div className="flex items-center gap-1.5 text-xs text-foreground">
                            <Building2 className="w-3 h-3 text-orange-400 shrink-0" />
                            <span className="truncate text-muted-foreground">{owner.full_name}</span>
                          </div>
                        )}

                        {/* Client */}
                        {client?.full_name && (
                          <div className="flex items-center gap-1.5 text-xs text-foreground">
                            <User className="w-3 h-3 text-blue-400 shrink-0" />
                            <span className="font-medium truncate">{client.full_name}</span>
                          </div>
                        )}

                        {/* Property */}
                        {property && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Home className="w-3 h-3 shrink-0" />
                            <span className="truncate">{property.title ?? property.address}</span>
                          </div>
                        )}

                        {/* Amount */}
                        {deal.amount && (
                          <div className="text-xs font-medium text-foreground">
                            💰 {deal.amount.toLocaleString('ru-RU')} ₽
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
