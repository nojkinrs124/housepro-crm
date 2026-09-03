import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { PlanForm } from '@/features/plans/components/PlanForm'
import { createPlanAction } from '@/features/plans/actions/plans.actions'
import { can, toUserRole } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

export default async function NewPlanPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  if (!can(toUserRole(profile?.role), 'settings', 'update')) redirect('/settings/plans')

  return (
    <div className="space-y-6">
      <PageHeader title="Новый тариф" subtitle="Условия работы агентства" />
      <PlanForm action={createPlanAction} submitLabel="Создать тариф" backHref="/settings/plans" />
    </div>
  )
}
