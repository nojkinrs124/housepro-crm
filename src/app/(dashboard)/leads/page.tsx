import { createClient } from '@/lib/supabase/server'
import { Plus, Zap, TrendingUp, CheckCircle2, Clock } from 'lucide-react'
import Link from 'next/link'
import { LeadsViewSwitcher } from '@/features/leads/components/LeadsViewSwitcher'
import { PageHeader } from '@/components/layout/PageHeader'
import { buttonVariants } from '@/components/ui/button'
import { LEAD_STATUSES_IN_WORK } from '@/features/leads/config/lead-statuses'

export default async function LeadsPage() {
 const supabase = await createClient()
 const { data: leads } = await supabase
 .from('leads')
 .select('id, full_name, phone, status, source, budget_min, budget_max, deal_type, assigned_to, created_at')
 .order('created_at', { ascending: false })

 const total = leads?.length ?? 0
 const newCount = (leads ?? []).filter(l => l.status === 'new').length
 const inWork = (leads ?? []).filter(l => LEAD_STATUSES_IN_WORK.includes(l.status)).length
 const converted = (leads ?? []).filter(l => l.status === 'converted').length

 return (
 <div className="space-y-6">
 <PageHeader
 title="Лиды"
 subtitle={`${total} всего · ${newCount} новых · ${converted} конвертировано`}
 actions={
 <Link href="/leads/new" className={buttonVariants({ size: 'sm' })}>
 <Plus style={{ width: 16, height: 16 }} />
 Новый лид
 </Link>
 }
 />

 {/* Stats */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
 {[
 { label: 'Всего лидов', value: total, Icon: Zap, iconCls: 'bg-[var(--hp-info-tint)]', iconColor: 'text-[var(--hp-info)]' },
 { label: 'Новых', value: newCount, Icon: Clock, iconCls: 'bg-[var(--hp-warn-tint)]', iconColor: 'text-[var(--hp-warn)]' },
 { label: 'В работе', value: inWork, Icon: TrendingUp, iconCls: 'bg-[var(--hp-neutral-tint)]', iconColor: 'text-[var(--hp-sub)]' },
 { label: 'Конвертировано', value: converted, Icon: CheckCircle2, iconCls: 'bg-[var(--hp-good-tint)]', iconColor: 'text-[var(--hp-good)]' },
 ].map(stat => {
 const Icon = stat.Icon
 return (
 <div key={stat.label} className="hp-card p-5 flex items-center gap-3 sm:gap-4">
 <div className={`w-11 h-11 flex items-center justify-center shrink-0 ${stat.iconCls}`}>
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

 <LeadsViewSwitcher leads={leads ?? []} />
 </div>
 )
}
