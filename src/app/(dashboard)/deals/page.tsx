import { createClient } from '@/lib/supabase/server'
import { Plus, Home, User, DollarSign, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { updateDealStatusAction } from '@/features/deals/actions/deals.actions'

const columns = [
  { status: 'new', label: 'Новые', color: 'border-t-blue-400' },
  { status: 'showing', label: 'Показы', color: 'border-t-yellow-400' },
  { status: 'negotiation', label: 'Переговоры', color: 'border-t-orange-400' },
  { status: 'contract', label: 'Договор', color: 'border-t-purple-400' },
  { status: 'payment', label: 'Оплата', color: 'border-t-cyan-400' },
  { status: 'completed', label: 'Завершено', color: 'border-t-green-400' },
]

const dealTypeLabels: Record<string, string> = {
  rent: 'Аренда', sale: 'Продажа',
  management: 'Управление', commercial: 'Коммерция', subrent: 'Субаренда',
}

const dealTypeColors: Record<string, string> = {
  rent: 'bg-blue-100 text-blue-700',
  sale: 'bg-emerald-100 text-emerald-700',
  management: 'bg-purple-100 text-purple-700',
  commercial: 'bg-orange-100 text-orange-700',
  subrent: 'bg-cyan-100 text-cyan-700',
}

const nextStatus: Record<string, string> = {
  new: 'showing', showing: 'negotiation', negotiation: 'contract',
  contract: 'payment', payment: 'completed',
}

export default async function DealsPage() {
  const supabase = await createClient()

  const { data: deals } = await supabase
    .from('deals')
    .select('*, client:clients(full_name), property:properties(title, address)')
    .order('created_at', { ascending: false })

  const byStatus = (status: string) =>
    (deals ?? []).filter(d => d.status === status)

  const totalAmount = (deals ?? [])
    .filter(d => d.status === 'completed' && d.amount)
    .reduce((sum, d) => sum + Number(d.amount), 0)

  const activeDealCount = (deals ?? []).filter(d =>
    !['completed', 'cancelled'].includes(d.status)).length

  return (
    <div className="space-y-6 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Сделки</h1>
          <p className="text-muted-foreground mt-1">
            {activeDealCount} активных · {totalAmount > 0 ? `${totalAmount.toLocaleString('ru-RU')} ₽ завершено` : ''}
          </p>
        </div>
        <Link href="/deals/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all">
          <Plus className="w-4 h-4" />
          Новая сделка
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Всего сделок', value: deals?.length ?? 0, icon: TrendingUp, color: 'bg-blue-50 text-blue-600' },
          { label: 'Активных', value: activeDealCount, icon: DollarSign, color: 'bg-green-50 text-green-600' },
          { label: 'Завершено', value: byStatus('completed').length, icon: TrendingUp, color: 'bg-emerald-50 text-emerald-600' },
          { label: 'Отменено', value: byStatus('cancelled').length, icon: TrendingUp, color: 'bg-red-50 text-red-600' },
        ].map(stat => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${stat.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Kanban */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {columns.map(col => {
            const colDeals = byStatus(col.status)
            return (
              <div key={col.status}
                className={`w-64 bg-card border-t-2 ${col.color} border border-border rounded-2xl flex flex-col`}>
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
                      const property = deal.property as { title?: string; address?: string } | null
                      return (
                        <div key={deal.id}
                          className="bg-background border border-border rounded-xl p-3 space-y-2 hover:shadow-sm transition-all">
                          {/* Type badge */}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${dealTypeColors[deal.deal_type] ?? 'bg-gray-100 text-gray-600'}`}>
                            {dealTypeLabels[deal.deal_type] ?? deal.deal_type}
                          </span>

                          {/* Client */}
                          {client?.full_name && (
                            <div className="flex items-center gap-1.5 text-xs text-foreground">
                              <User className="w-3 h-3 text-muted-foreground shrink-0" />
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
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                              <DollarSign className="w-3 h-3 text-emerald-500" />
                              {Number(deal.amount).toLocaleString('ru-RU')} ₽
                            </div>
                          )}

                          {/* Move forward */}
                          {nextStatus[col.status] && (
                            <form action={updateDealStatusAction.bind(null, deal.id, nextStatus[col.status])}>
                              <button type="submit"
                                className="w-full text-xs py-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-all font-medium">
                                Следующий этап →
                              </button>
                            </form>
                          )}

                          {/* Create contract */}
                          {col.status === 'contract' && (
                            <Link
                              href={`/contracts/new?client_id=${deal.client_id}&property_id=${deal.property_id}`}
                              className="block w-full text-center text-xs py-1.5 bg-violet-100 text-violet-700 rounded-lg hover:bg-violet-200 transition-all font-medium">
                              + Создать договор
                            </Link>
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
}
