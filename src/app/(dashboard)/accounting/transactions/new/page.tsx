import { createClient } from '@/lib/supabase/server'
import { TransactionForm } from '@/features/accounting/components/TransactionForm'
import { PageHeader } from '@/components/layout/PageHeader'

export default async function NewTransactionPage() {
  const supabase = await createClient()

  const [categoriesRes, contractsRes, dealsRes, employeesRes, contactsRes] = await Promise.all([
    supabase.from('accounting_categories').select('id, name, type, color, icon, is_system, sort_order, created_at').order('sort_order'),
    supabase.from('contracts').select('id, contract_number, contract_type').order('created_at', { ascending: false }).limit(100),
    supabase.from('deals').select('id, deal_type').order('created_at', { ascending: false }).limit(100),
    supabase.from('users').select('id, full_name').order('full_name'),
    supabase.from('contacts').select('id, full_name, company_name, client_type').order('full_name').limit(200),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const categories  = (categoriesRes.data  ?? []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contracts   = (contractsRes.data   ?? []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deals       = (dealsRes.data       ?? []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const employees   = (employeesRes.data   ?? []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contacts    = (contactsRes.data    ?? []) as any[]

  return (
    <div className="space-y-6">
      <PageHeader title="Новая транзакция" backHref="/accounting" backLabel="Бухгалтерия" />
      <TransactionForm
        categories={categories}
        contracts={contracts}
        deals={deals}
        employees={employees}
        contacts={contacts}
      />
    </div>
  )
}
