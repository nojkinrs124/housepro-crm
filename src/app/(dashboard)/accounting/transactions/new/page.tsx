import { createClient } from '@/lib/supabase/server'
import { TransactionForm } from '@/features/accounting/components/TransactionForm'
import { PageHeader } from '@/components/layout/PageHeader'

export default async function NewTransactionPage({
  searchParams,
}: {
  searchParams: Promise<{ property_id?: string; contract_id?: string }>
}) {
  const { property_id: propertyId, contract_id: contractId } = await searchParams
  const supabase = await createClient()

  const [categoriesRes, contractsRes, dealsRes, employeesRes, contactsRes, propertiesRes] = await Promise.all([
    supabase.from('accounting_categories').select('id, name, type, color, icon, is_system, sort_order, created_at').order('sort_order'),
    supabase.from('contracts').select('id, contract_number, contract_type').order('created_at', { ascending: false }).limit(100),
    supabase.from('deals').select('id, deal_type').order('created_at', { ascending: false }).limit(100),
    supabase.from('users').select('id, full_name').order('full_name'),
    supabase.from('contacts').select('id, full_name, company_name, client_type').order('full_name').limit(200),
    supabase.from('properties').select('id, title, address').order('title').limit(300),
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
  const properties  = propertiesRes.data   ?? []

  return (
    <div className="space-y-6">
      <PageHeader title="Новая транзакция" backHref="/accounting" backLabel="Бухгалтерия" />
      <TransactionForm
        categories={categories}
        contracts={contracts}
        deals={deals}
        employees={employees}
        contacts={contacts}
        properties={properties}
        defaultPropertyId={propertyId}
        defaultContractId={contractId}
      />
    </div>
  )
}
