import { createContractAction } from '@/features/contracts/actions/contracts.actions'
import { ContractForm } from '@/features/contracts/components/ContractForm'
import { getContractFormData } from '@/features/contracts/data/contract-form-data'
import { createClient } from '@/lib/supabase/server'
import { FileText } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'

// Тип сделки -> тип договора по умолчанию. 'rent' уточняется ниже по типу объекта
// (жилой -> rent_apartment, коммерческий -> rent_commercial).
const DEAL_TYPE_TO_CONTRACT_TYPE: Record<string, string> = {
  sale: 'sale',
  management: 'property_management',
  commercial: 'rent_commercial',
  subrent: 'sublease',
}

export default async function NewContractPage({
  searchParams,
}: {
  // contact_id — универсальный параметр, роль определяется автоматически.
  // client_id/owner_id оставлены для обратной совместимости со старыми ссылками.
  searchParams: Promise<{ client_id?: string; owner_id?: string; contact_id?: string; property_id?: string; deal_id?: string }>
}) {
  const params = await searchParams
  const { owners, clients, properties, representativesByContact, baseContracts, companyProfiles, defaultCompanyProfileId, deals } =
    await getContractFormData()

  // Авто-подстановка стороны по роли контакта, если договор создаётся с его карточки.
  let contactOwnerId = params.owner_id
  let contactClientId = params.client_id
  if (params.contact_id) {
    const isOwner = owners.some(o => o.id === params.contact_id)
    const isClient = clients.some(c => c.id === params.contact_id)
    // Роль 'both' неоднозначна — по умолчанию считаем клиентом (см. аналогичную логику в deals/new).
    if (isOwner && !isClient) contactOwnerId = params.contact_id
    else if (isClient) contactClientId = params.contact_id
  }

  // Если договор создаётся из карточки сделки — подтягиваем стороны, объект и сумму сделки.
  let dealDefaults: {
    contract_type?: string
    owner_contact_id?: string
    client_contact_id?: string
    owner_representative_id?: string
    client_representative_id?: string
    property_id?: string
    amount?: number | null
  } = {}

  if (params.deal_id) {
    const supabase = await createClient()
    const { data: deal } = await supabase
      .from('deals')
      .select('deal_type, owner_contact_id, client_contact_id, owner_representative_id, client_representative_id, property_id, amount')
      .eq('id', params.deal_id)
      .maybeSingle()

    if (deal) {
      const property = properties.find(p => p.id === deal.property_id)
      const isCommercialProperty = property?.property_type
        ? ['commercial', 'office', 'warehouse', 'land'].includes(property.property_type)
        : false

      const contractType = deal.deal_type === 'rent'
        ? (isCommercialProperty ? 'rent_commercial' : 'rent_apartment')
        : DEAL_TYPE_TO_CONTRACT_TYPE[deal.deal_type] ?? 'rent_apartment'

      dealDefaults = {
        contract_type: contractType,
        owner_contact_id: deal.owner_contact_id ?? undefined,
        client_contact_id: deal.client_contact_id ?? undefined,
        owner_representative_id: deal.owner_representative_id ?? undefined,
        client_representative_id: deal.client_representative_id ?? undefined,
        property_id: deal.property_id ?? undefined,
        amount: deal.amount,
      }
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="Новый договор"
        subtitle="Укажите обе стороны из единой базы контактов"
        backHref="/contracts"
        backLabel="Назад к договорам"
        iconBg="bg-[var(--hp-neutral-tint)]"
        icon={<FileText className="w-5 h-5 text-[var(--hp-sub)]" />}
      />

      <ContractForm
        action={createContractAction}
        owners={owners}
        clients={clients}
        representativesByContact={representativesByContact}
        properties={properties}
        baseContracts={baseContracts}
        companyProfiles={companyProfiles}
        deals={deals}
        backHref="/contracts"
        submitLabel="Создать договор"
        mode="create"
        defaults={{
          contract_type: dealDefaults.contract_type,
          owner_contact_id: dealDefaults.owner_contact_id ?? contactOwnerId,
          client_contact_id: dealDefaults.client_contact_id ?? contactClientId,
          owner_representative_id: dealDefaults.owner_representative_id,
          client_representative_id: dealDefaults.client_representative_id,
          property_id: dealDefaults.property_id ?? params.property_id,
          deal_id: params.deal_id,
          amount: dealDefaults.amount,
          company_profile_id: defaultCompanyProfileId,
        }}
      />
    </div>
  )
}
