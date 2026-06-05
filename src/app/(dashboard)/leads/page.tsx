import { createClient } from '@/lib/supabase/server'
import { Plus, Zap, TrendingUp, CheckCircle2, Clock } from 'lucide-react'
import Link from 'next/link'
import { LeadsKanban } from '@/features/leads/components/LeadsKanban'

const cardStyle = {
  background: '#ffffff',
  borderRadius: '20px',
  border: '1px solid rgba(214,219,235,0.6)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05)',
}

export default async function LeadsPage() {
  const supabase = await createClient()
  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })

  const total    = leads?.length ?? 0
  const newCount = (leads ?? []).filter(l => l.status === 'new').length
  const inWork   = (leads ?? []).filter(l => l.status === 'in_work').length
  const converted = (leads ?? []).filter(l => l.status === 'converted').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111827] tracking-tight">Лиды</h1>
          <p className="text-[#64748B] mt-1 text-sm">
            {total} всего · {newCount} новых · {converted} конвертировано
          </p>
        </div>
        <Link href="/leads/new"
          className="flex items-center gap-2 px-4 py-2.5 text-white rounded-[12px] text-sm font-semibold"
          style={{
            background: 'linear-gradient(135deg, #16A34A, #22C55E)',
            boxShadow: '0 2px 8px rgba(22,163,74,0.3)',
          }}>
          <Plus style={{ width: 16, height: 16 }} />
          Новый лид
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Всего лидов',     value: total,     icon: Zap,          iconBg: '#EFF6FF', iconColor: '#3B82F6' },
          { label: 'Новых',           value: newCount,  icon: Clock,        iconBg: '#FFFBEB', iconColor: '#D97706' },
          { label: 'В работе',        value: inWork,    icon: TrendingUp,   iconBg: '#F5F3FF', iconColor: '#7C3AED' },
          { label: 'Конвертировано',  value: converted, icon: CheckCircle2, iconBg: '#F0FDF4', iconColor: '#16A34A' },
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

      {total === 0 ? (
        <div className="p-16 text-center rounded-[20px]"
          style={{
            background: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 50%, #F0FDF4 100%)',
            border: '1px solid rgba(34,197,94,0.2)',
          }}>
          <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mx-auto mb-4"
            style={{ boxShadow: '0 4px 12px rgba(34,197,94,0.2)' }}>
            <Zap style={{ width: 24, height: 24, color: '#16A34A' }} />
          </div>
          <h3 className="font-bold text-[#111827] text-lg">Нет лидов</h3>
          <p className="text-[#64748B] text-sm mt-1">Добавьте первый лид из входящего обращения</p>
          <Link href="/leads/new"
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 text-white rounded-[12px] text-sm font-semibold"
            style={{ background: 'linear-gradient(135deg, #16A34A, #22C55E)', boxShadow: '0 2px 8px rgba(22,163,74,0.3)' }}>
            <Plus style={{ width: 16, height: 16 }} />
            Добавить лид
          </Link>
        </div>
      ) : (
        <LeadsKanban leads={leads ?? []} />
      )}
    </div>
  )
}
