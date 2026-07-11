import { createClient } from '@/lib/supabase/server'
import { TransactionForm } from '@/features/accounting/components/TransactionForm'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default async function NewTransactionPage() {
  const supabase = await createClient()

  const [categoriesRes, contractsRes, dealsRes, employeesRes] = await Promise.all([
    supabase.from('accounting_categories').select('id, name, type, color, icon, is_system, sort_order, created_at').order('sort_order'),
    supabase.from('contracts').select('id, contract_number, contract_type').order('created_at', { ascending: false }).limit(100),
    supabase.from('deals').select('id, deal_type').order('created_at', { ascending: false }).limit(100),
    supabase.from('users').select('id, full_name').order('full_name'),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const categories  = (categoriesRes.data  ?? []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contracts   = (contractsRes.data   ?? []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deals       = (dealsRes.data       ?? []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const employees   = (employeesRes.data   ?? []) as any[]

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/accounting"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Бухгалтерия
        </Link>
        <h1 className="text-[28px] font-bold text-foreground tracking-tight leading-tight">
          Новая транзакция
        </h1>
      </div>
      <TransactionForm
        categories={categories}
        contracts={contracts}
        deals={deals}
        employees={employees}
      />
    </div>
  )
}
