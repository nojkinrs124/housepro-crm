import { createClient } from '@/lib/supabase/server'
import { TransactionForm } from '@/features/accounting/components/TransactionForm'
import { PageHeader } from '@/components/layout/PageHeader'
import type { AccountingCategory, Contact, Contract, Deal } from '@/types/database'

export default async function NewTransactionPage({
  searchParams,
}: {
  searchParams: Promise<{ property_id?: string; contract_id?: string; deal_id?: string }>
}) {
  const { property_id: propertyId, contract_id: contractId, deal_id: dealId } = await searchParams
  const supabase = await createClient()

  const [categoriesRes, contractsRes, dealsRes, employeesRes, contactsRes, propertiesRes, engagementsRes] = await Promise.all([
    supabase.from('accounting_categories').select('id, name, type, color, icon, is_system, sort_order, created_at').order('sort_order'),
    supabase.from('contracts').select('id, contract_number, contract_type').order('created_at', { ascending: false }).limit(100),
    supabase.from('deals').select('id, deal_type, deal_number').order('created_at', { ascending: false }).limit(100),
    supabase.from('users').select('id, full_name').order('full_name'),
    supabase.from('contacts').select('id, full_name, company_name, client_type').order('full_name').limit(200),
    supabase.from('properties').select('id, title, address').order('title').limit(300),
    supabase.from('management_engagements').select('property_id').is('ended_at', null),
  ])

  const categories  = (categoriesRes.data  ?? []) as AccountingCategory[]
  const contracts   = (contractsRes.data   ?? []) as Pick<Contract, 'id' | 'contract_number' | 'contract_type'>[]
  let deals         = (dealsRes.data       ?? []) as Pick<Deal, 'id' | 'deal_type' | 'deal_number'>[]
  const employees   = (employeesRes.data   ?? [])
  const contacts    = (contactsRes.data    ?? []) as Pick<Contact, 'id' | 'full_name' | 'company_name' | 'client_type'>[]
  const properties  = propertiesRes.data   ?? []

  // Сделка пришла по ссылке (например «Получена комиссия» из чек-листа
  // стадии), но может быть старше последних 100 — без неё в списке select
  // отправил бы пустое значение, несмотря на то что в URL она явно указана
  // (аудит 23.10.2026, K8).
  if (dealId && !deals.some(d => d.id === dealId)) {
    const { data: targetDeal } = await supabase
      .from('deals')
      .select('id, deal_type, deal_number')
      .eq('id', dealId)
      .maybeSingle()
    if (targetDeal) {
      deals = [
        { ...targetDeal, deal_number: targetDeal.deal_number ?? undefined } as Pick<Deal, 'id' | 'deal_type' | 'deal_number'>,
        ...deals,
      ]
    }
  }

  // Объекты в управлении: по ним операция едет во взаиморасчёт с собственником,
  // и форма обязана это сказать — иначе деньги молча минуют сальдо.
  const managedPropertyIds = (engagementsRes.data ?? [])
    .map(e => e.property_id)
    .filter((v): v is string => Boolean(v))

  return (
    <div className="space-y-6">
      <PageHeader title="Новая операция" backHref="/accounting" backLabel="Бухгалтерия" />
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
        defaultDealId={dealId}
      />
    </div>
  )
}
