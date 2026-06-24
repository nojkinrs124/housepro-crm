import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { RecurringRuleForm } from '@/features/accounting/components/RecurringRuleForm'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

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
      <div>
        <Link
          href="/accounting/recurring"
          className="inline-flex items-center gap-2 text-sm font-medium text-[#64748B] hover:text-[#111827] transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Периодические операции
        </Link>
        <h1 className="text-[28px] font-bold text-[#111827] tracking-tight leading-tight">
          Редактировать правило
        </h1>
      </div>
      <RecurringRuleForm rule={rule} categories={categories} employees={employees} />
    </div>
  )
}
