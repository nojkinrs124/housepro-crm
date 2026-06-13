import { createClient } from '@/lib/supabase/server'
import { Plus, Zap, TrendingUp, CheckCircle2, Clock } from 'lucide-react'
import Link from 'next/link'
import { LeadsViewSwitcher } from '@/features/leads/components/LeadsViewSwitcher'

export default async function LeadsPage() {
  const supabase = await createClient()
  const { data: leads } = await supabase
    .from('leads')
    .select('id, full_name, phone, status, source, budget_min, budget_max, deal_type, assigned_to, created_at')
    .order('created_at', { ascending: false })

  const total     = leads?.length ?? 0
  const newCount  = (leads ?? []).filter(l => l.status === 'new').length
  const inWork    = (leads ?? []).filter(l => l.status === 'in_work').length
  const converted = (leads ?? []).filter(l => l.status === 'converted').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-bold text-[#111827] tracking-tight leading-tight">Лиды</h1>
          <p className="text-[#64748B] mt-1 text-sm">
            {total} всего · {newCount} новых · {converted} конвертировано
          </p>
        </div>
        <Link href="/leads/new"
          className="flex items-center gap-2 px-4 py-2.5 text-white rounded-xl text-sm font-semibold"
          style={{ background: 'linear-gradient(135deg, #16A34A, #22C55E)', boxShadow: '0 4px 16px rgba(22,163,74,0.35)' }}>
          <Plus style={{ width: 16, height: 16 }} />
          Новый лид
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Всего лидов',    value: total,     Icon: Zap,          iconCls: 'bg-blue-50',   iconColor: 'text-blue-500' },
          { label: 'Новых',          value: newCount,  Icon: Clock,        iconCls: 'bg-amber-50',  iconColor: 'text-amber-500' },
          { label: 'В работе',       value: inWork,    Icon: TrendingUp,   iconCls: 'bg-violet-50', iconColor: 'text-violet-600' },
          { label: 'Конвертировано', value: converted, Icon: CheckCircle2, iconCls: 'bg-green-50',  iconColor: 'text-green-600' },
        ].map(stat => {
          const Icon = stat.Icon
          return (
            <div key={stat.label} className="bg-white rounded-[20px] border border-slate-200/60 shadow-sm p-5 flex items-center gap-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${stat.iconCls}`}>
                <Icon className={stat.iconColor} style={{ width: 20, height: 20 }} />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#111827]">{stat.value}</p>
                <p className="text-xs text-[#64748B] font-medium mt-0.5">{stat.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      <LeadsViewSwitcher leads={leads ?? []} />
    </div>
  )
}
