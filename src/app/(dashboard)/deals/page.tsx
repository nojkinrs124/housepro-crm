import { DealsKanbanBoard } from '@/features/deals/components/DealsKanban'
import { Plus, DollarSign, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function DealsPage() {
  const supabase = await createClient()

  const { data: rawDeals } = await supabase
    .from('deals')
    .select(`
      *,
      client:clients(full_name, phone),
      property:properties(title, address),
      owner_contact:contacts!deals_owner_contact_id_fkey(full_name, phone),
      client_contact:contacts!deals_client_contact_id_fkey(full_name, phone)
    `)
    .order('created_at', { ascending: false })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deals = rawDeals as any[] | null

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
          { label: 'Всего сделок',  value: deals?.length ?? 0,         icon: TrendingUp, color: 'bg-blue-50 text-blue-600' },
          { label: 'Активных',      value: activeDealCount,             icon: DollarSign, color: 'bg-green-50 text-green-600' },
          { label: 'Завершено',     value: byStatus('completed').length, icon: TrendingUp, color: 'bg-emerald-50 text-emerald-600' },
          { label: 'Отменено',      value: byStatus('cancelled').length, icon: TrendingUp, color: 'bg-red-50 text-red-600' },
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
      <DealsKanbanBoard deals={deals ?? []} />
    </div>
  )
}
