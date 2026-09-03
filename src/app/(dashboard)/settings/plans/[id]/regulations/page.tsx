import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { RegulationEditor, type RegulationRow } from '@/features/management/components/RegulationEditor'
import { can, toUserRole } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

/**
 * Регламент обслуживания по тарифу.
 *
 * Живёт в тарифе, а не в объекте: именно набором правил различаются
 * «Управление» и «Управление Премиум», и это разница в обязательствах перед
 * собственником, а не в тексте на сайте.
 */
export default async function PlanRegulationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  if (!can(toUserRole(profile?.role), 'settings', 'update')) redirect('/settings/plans')

  const [{ data: plan }, { data: regulations }] = await Promise.all([
    supabase.from('service_plans').select('id, title, code, charge_type').eq('id', id).maybeSingle(),
    supabase.from('management_regulations')
      .select('id, code, title, description, period, day_of_month, lead_days, priority, is_active, sort_order')
      .eq('plan_id', id)
      .order('sort_order'),
  ])

  if (!plan) notFound()

  const rows: RegulationRow[] = (regulations ?? []).map(r => ({
    id: r.id,
    code: r.code,
    title: r.title,
    description: r.description,
    period: r.period,
    dayOfMonth: r.day_of_month,
    leadDays: r.lead_days,
    priority: r.priority,
    isActive: r.is_active,
    sortOrder: r.sort_order,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Регламент обслуживания"
        subtitle={`${plan.title} · ${rows.length} правил`}
        backHref="/settings/plans"
        backLabel="Тарифы"
      />

      <p className="hp-card p-3 text-sm text-[var(--hp-sub)]">
        По этим правилам ежедневный крон заводит задачи по объектам в управлении с этим
        тарифом. Задача создаётся заранее — за указанное число дней до срока — и не
        дублируется при повторном прогоне.
      </p>

      <RegulationEditor planId={id} regulations={rows} />
    </div>
  )
}
