import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { PlanForm, type PlanDefaults } from '@/features/plans/components/PlanForm'
import { updatePlanAction } from '@/features/plans/actions/plans.actions'
import { can, toUserRole } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

function obligationsOf(value: unknown): { code: string; title: string }[] {
  if (!Array.isArray(value)) return []
  return value.filter((o): o is { code: string; title: string } =>
    typeof o === 'object' && o !== null && typeof (o as { title?: unknown }).title === 'string')
}

export default async function EditPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  if (!can(toUserRole(profile?.role), 'settings', 'update')) redirect('/settings/plans')

  const { data: plan } = await supabase
    .from('service_plans')
    .select('id, code, title, charge_type, rate, repair_limit, obligations, directions, is_active, sort_order')
    .eq('id', id)
    .maybeSingle()

  if (!plan) notFound()

  const defaults: PlanDefaults = {
    id: plan.id,
    code: plan.code,
    title: plan.title,
    charge_type: plan.charge_type,
    rate: plan.rate,
    repair_limit: plan.repair_limit,
    obligations: obligationsOf(plan.obligations),
    directions: plan.directions ?? [],
    is_active: plan.is_active,
    sort_order: plan.sort_order,
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={plan.title}
        subtitle="Изменение ставки не затронет уже заключённые договоры"
      />
      <PlanForm action={updatePlanAction} defaults={defaults} submitLabel="Сохранить" backHref="/settings/plans" />
    </div>
  )
}
