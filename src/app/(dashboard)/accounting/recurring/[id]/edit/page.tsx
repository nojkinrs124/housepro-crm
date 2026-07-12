import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { RecurringRuleForm } from '@/features/accounting/components/RecurringRuleForm'
import { PageHeader } from '@/components/layout/PageHeader'

export default async function EditRecurringPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [ruleRes, categoriesRes, employeesRes] = await Promise.all([
    supabase.from('accounting_recurring_rules').select('*').eq('id', id).single(),
    supabase.from('accounting_categories').select('id, name, type, color, icon, is_system, sort_order, created_at').order('sort_order'),
    supabase.from('users').select('id, full_name').order('full_name'),
  ])

  if (!ruleRes.data) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rule       = ruleRes.data as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const categories = (categoriesRes.data ?? []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const employees  = (employeesRes.data  ?? []) as any[]

  return (
    <div className="space-y-6">
      <PageHeader title="Редактировать правило" backHref="/accounting/recurring" backLabel="Периодические операции" />
      <RecurringRuleForm rule={rule} categories={categories} employees={employees} />
    </div>
  )
}
