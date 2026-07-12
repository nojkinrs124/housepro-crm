import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { TransactionForm } from '@/features/accounting/components/TransactionForm'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [txnRes, categoriesRes, contractsRes, dealsRes, employeesRes] = await Promise.all([
    supabase
      .from('accounting_transactions')
      .select('*')
      .eq('id', id)
      .single(),
    supabase.from('accounting_categories').select('id, name, type, color, icon, is_system, sort_order, created_at').order('sort_order'),
    supabase.from('contracts').select('id, contract_number, contract_type').order('created_at', { ascending: false }).limit(100),
    supabase.from('deals').select('id, deal_type').order('created_at', { ascending: false }).limit(100),
    supabase.from('users').select('id, full_name').order('full_name'),
  ])

  if (!txnRes.data) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transaction = txnRes.data as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const categories  = (categoriesRes.data ?? []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contracts   = (contractsRes.data  ?? []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deals       = (dealsRes.data      ?? []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const employees   = (employeesRes.data  ?? []) as any[]

  return (
    <div className="space-y-6">
      <PageHeader title="Редактировать транзакцию" backHref={`/accounting/transactions/${id}`} backLabel="Назад" />
      <TransactionForm
        transaction={transaction}
        categories={categories}
        contracts={contracts}
        deals={deals}
        employees={employees}
      />
    </div>
  )
}
