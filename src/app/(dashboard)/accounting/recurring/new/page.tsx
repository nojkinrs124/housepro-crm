import { createClient } from '@/lib/supabase/server'
import { RecurringRuleForm } from '@/features/accounting/components/RecurringRuleForm'
import { PageHeader } from '@/components/layout/PageHeader'

export default async function NewRecurringPage() {
  const supabase = await createClient()

  const [categoriesRes, employeesRes] = await Promise.all([
    supabase.from('accounting_categories').select('id, name, type, color, icon, is_system, sort_order, created_at').order('sort_order'),
    supabase.from('users').select('id, full_name').order('full_name'),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const categories = (categoriesRes.data ?? []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const employees  = (employeesRes.data  ?? []) as any[]

  return (
    <div className="space-y-6">
      <PageHeader title="Новое правило" backHref="/accounting/recurring" backLabel="Периодические операции" />
      <RecurringRuleForm categories={categories} employees={employees} />
    </div>
  )
}
