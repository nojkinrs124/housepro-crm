import { createClient } from '@/lib/supabase/server'
import { TransactionForm } from '@/features/accounting/components/TransactionForm'
import { PageHeader } from '@/components/layout/PageHeader'
import type { AccountingCategory, Contact, Contract, Deal } from '@/types/database'

export default async function NewTransactionPage({
  searchParams,
}: {
  searchParams: Promise<{ property_id?: string; contract_id?: string }>
}) {
  const { property_id: propertyId, contract_id: contractId } = await searchParams
  const supabase = await createClient()

  const [categoriesRes, contractsRes, dealsRes, employeesRes, contactsRes, propertiesRes, engagementsRes] = await Promise.all([
    supabase.from('accounting_categories').select('id, name, type, color, icon, is_system, sort_order, created_at').order('sort_order'),
    supabase.from('contracts').select('id, contract_number, contract_type').order('created_at', { ascending: false }).limit(100),
    supabase.from('deals').select('id, deal_type').order('created_at', { ascending: false }).limit(100),
    supabase.from('users').select('id, full_name').order('full_name'),
    supabase.from('contacts').select('id, full_name, company_name, client_type').order('full_name').limit(200),
    supabase.from('properties').select('id, title, address').order('title').limit(300),
    supabase.from('management_engagements').select('property_id').is('ended_at', null),
  ])

  const categories  = (categoriesRes.data  ?? []) as AccountingCategory[]
  const contracts   = (contractsRes.data   ?? []) as Pick<Contract, 'id' | 'contract_number' | 'contract_type'>[]
  const deals       = (dealsRes.data       ?? []) as Pick<Deal, 'id' | 'deal_type'>[]
  const employees   = (employeesRes.data   ?? [])
  const contacts    = (contactsRes.data    ?? []) as Pick<Contact, 'id' | 'full_name' | 'company_name' | 'client_type'>[]
  const properties  = propertiesRes.data   ?? []

  // Объекты в управлении: по ним операция едет во взаиморасчёт с собственником,
  // и форма обязана это сказать — иначе деньги молча минуют сальдо.
  const managedPropertyIds = (engagementsRes.data ?? [])
    .map(e => e.property_id)
    .filter((v): v is string => Boolean(v))

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
        managedPropertyIds={managedPropertyIds}
        defaultPropertyId={propertyId}
        defaultContractId={contractId}
      />
    </div>
  )
}
