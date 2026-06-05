import { DealsKanbanBoard } from '@/features/deals/components/DealsKanban'
import { Plus, DollarSign, TrendingUp, XCircle, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

const cardStyle = {
  background: '#ffffff',
  borderRadius: '20px',
  border: '1px solid rgba(214,219,235,0.6)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05)',
}

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111827] tracking-tight">Сделки</h1>
          <p className="text-[#64748B] mt-1 text-sm">
            {activeDealCount} активных{totalAmount > 0 ? ` · ${totalAmount.toLocaleString('ru-RU')} ₽ завершено` : ''}
          </p>
        </div>
        <Link href="/deals/new"
          className="flex items-center gap-2 px-4 py-2.5 text-white rounded-[12px] text-sm font-semibold"
          style={{
            background: 'linear-gradient(135deg, #16A34A, #22C55E)',
            boxShadow: '0 2px 8px rgba(22,163,74,0.3)',
          }}>
          <Plus style={{ width: 16, height: 16 }} />
          Новая сделка
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Всего сделок', value: deals?.length ?? 0,         icon: TrendingUp,   iconBg: '#EFF6FF', iconColor: '#3B82F6' },
          { label: 'Активных',     value: activeDealCount,             icon: DollarSign,   iconBg: '#F0FDF4', iconColor: '#16A34A' },
          { label: 'Завершено',    value: byStatus('completed').length, icon: CheckCircle2, iconBg: '#ECFDF5', iconColor: '#059669' },
          { label: 'Отменено',     value: byStatus('cancelled').length, icon: XCircle,      iconBg: '#FEF2F2', iconColor: '#DC2626' },
        ].map(stat => {
          const Icon = stat.icon
          return (
            <div key={stat.label} style={cardStyle} className="p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0"
                style={{ background: stat.iconBg }}>
                <Icon style={{ width: 20, height: 20, color: stat.iconColor }} />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#111827]">{stat.value}</p>
                <p className="text-xs text-[#64748B] font-medium mt-0.5">{stat.label}</p>
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
