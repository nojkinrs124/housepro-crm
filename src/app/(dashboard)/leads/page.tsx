import { createClient } from '@/lib/supabase/server'
import { Plus, Zap } from 'lucide-react'
import Link from 'next/link'
import { LeadsViewSwitcher } from '@/features/leads/components/LeadsViewSwitcher'
import { PageHeader } from '@/components/layout/PageHeader'
import { buttonVariants } from '@/components/ui/button'
import { StatStrip } from '@/components/layout/StatStrip'
import { EmptyState } from '@/components/layout/EmptyState'
import { LEAD_STATUSES_IN_WORK } from '@/features/leads/config/lead-statuses'

export default async function LeadsPage() {
 const supabase = await createClient()
 const { data: leads } = await supabase
 .from('leads')
 .select('id, full_name, phone, telegram, comment, status, source, budget_min, budget_max, rooms, deal_type, assigned_to, created_at')
 .order('created_at', { ascending: false })

 const total = leads?.length ?? 0
 const newCount = (leads ?? []).filter(l => l.status === 'new').length
 const inWork = (leads ?? []).filter(l => LEAD_STATUSES_IN_WORK.includes(l.status)).length
 const converted = (leads ?? []).filter(l => l.status === 'converted').length

 return (
 <div className="space-y-5">
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

 {total > 0 && (
 <StatStrip
 items={[
 { label: 'Всего лидов', value: total },
 { label: 'Новых', value: newCount, hint: newCount > 0 ? 'ещё не связались' : 'все обработаны', alert: newCount > 0 },
 { label: 'В работе', value: inWork },
 { label: 'Стали клиентами', value: converted, hint: total > 0 ? `${Math.round((converted / total) * 100)}% от всех` : undefined },
 ]}
 />
 )}

 {total === 0 ? (
 <EmptyState
 icon={<Zap className="w-5 h-5 text-[var(--hp-sub)]" />}
 title="Лидов пока нет"
 description="Лид — входящий звонок или сообщение от человека, который ещё не стал клиентом. Заявки с сайта и Авито попадают сюда сами; звонок записывается вручную."
 actionHref="/leads/new"
 actionLabel="Новый лид"
 />
 ) : (
 <LeadsViewSwitcher leads={leads ?? []} />
 )}
 </div>
 )
}
