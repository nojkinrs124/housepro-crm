import { DealsViewSwitcher } from '@/features/deals/components/DealsViewSwitcher'
import { Plus, DollarSign, TrendingUp, XCircle, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { buttonVariants } from '@/components/ui/button'

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

  const activeDealCount = (deals ?? []).filter(d => !['completed', 'cancelled'].includes(d.status)).length
  const completedCount  = (deals ?? []).filter(d => d.status === 'completed').length
  const cancelledCount  = (deals ?? []).filter(d => d.status === 'cancelled').length
  const totalAmount = (deals ?? [])
    .filter(d => d.status === 'completed' && d.amount)
    .reduce((sum, d) => sum + Number(d.amount), 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Сделки"
        subtitle={`${activeDealCount} активных${totalAmount > 0 ? ` · ${totalAmount.toLocaleString('ru-RU')} ₽ завершено` : ''}`}
        actions={
          <Link href="/deals/new" className={buttonVariants({ size: 'sm' })} style={{ background: 'var(--hp-gradient-primary)' }}>
            <Plus style={{ width: 16, height: 16 }} />
            Новая сделка
          </Link>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Всего сделок', value: deals?.length ?? 0, Icon: TrendingUp,   iconCls: 'bg-blue-50',    iconColor: 'text-blue-500' },
          { label: 'Активных',     value: activeDealCount,    Icon: DollarSign,   iconCls: 'bg-green-50',   iconColor: 'text-green-600' },
          { label: 'Завершено',    value: completedCount,     Icon: CheckCircle2, iconCls: 'bg-emerald-50', iconColor: 'text-emerald-600' },
          { label: 'Отменено',     value: cancelledCount,     Icon: XCircle,      iconCls: 'bg-red-50',     iconColor: 'text-red-500' },
        ].map(stat => {
          const Icon = stat.Icon
          return (
            <div key={stat.label} className="bg-white rounded-[20px] border border-slate-200/60 shadow-sm p-5 flex items-center gap-3 sm:gap-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${stat.iconCls}`}>
                <Icon className={stat.iconColor} style={{ width: 20, height: 20 }} />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground font-medium mt-0.5 leading-tight break-words">{stat.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      <DealsViewSwitcher deals={deals ?? []} />
    </div>
  )
}
