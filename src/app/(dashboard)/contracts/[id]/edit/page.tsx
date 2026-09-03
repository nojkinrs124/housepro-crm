import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, FileText } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { updateContractAction } from '@/features/contracts/actions/contracts.actions'
import { ContractForm } from '@/features/contracts/components/ContractForm'
import { getContractFormData } from '@/features/contracts/data/contract-form-data'
import { PageHeader } from '@/components/layout/PageHeader'

/**
 * contract_type_data хранится как jsonb: компилятор знает про него только то,
 * что это Json. Форме нужен объект — всё остальное (строка, число, массив)
 * означает испорченные данные, и подсовывать их в поля не надо.
 */
function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}


export default async function EditContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: rawContract } = await supabase.from('contracts').select('*').eq('id', id).single()
  if (!rawContract) notFound()

  const dealId = rawContract.deal_id ?? undefined
  const formData = await getContractFormData(id, dealId)

  const c = rawContract
  const { owners, clients, properties, representativesByContact, baseContracts, companyProfiles, deals } = formData

  const boundAction = updateContractAction.bind(null, id)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="Редактировать договор"
        subtitle={c.contract_number ?? `#${id.slice(0, 8)}`}
        backHref={`/contracts/${id}`}
        backLabel="Вернуться к договору"
        iconBg="bg-[var(--hp-neutral-tint)]"
        icon={<FileText className="w-5 h-5 text-[var(--hp-sub)]" />}
      />

      <ContractForm
        action={boundAction}
        owners={owners}
        clients={clients}
        representativesByContact={representativesByContact}
        properties={properties}
        baseContracts={baseContracts}
        companyProfiles={companyProfiles}
        plans={formData.plans}
        deals={deals}
        backHref={`/contracts/${id}`}
        submitLabel="Сохранить изменения"
        mode="edit"
        defaults={{
          contract_type:     c.contract_type,
          owner_contact_id:  c.owner_contact_id ?? undefined,
          client_contact_id: c.client_contact_id ?? c.client_id ?? undefined,
          owner_representative_id:  c.owner_representative_id ?? undefined,
          client_representative_id: c.client_representative_id ?? undefined,
          property_id:       c.property_id ?? undefined,
          deal_id:           c.deal_id ?? undefined,
          base_contract_id:  c.base_contract_id ?? undefined,
          company_profile_id: c.company_profile_id ?? undefined,
          amount:            c.amount,
          deposit:           c.deposit,
          start_date:        c.start_date,
          end_date:          c.end_date,
          notes:             c.notes,
          status:            c.status,
          contract_type_data: asRecord(c.contract_type_data),
          plan_id:            c.plan_id ?? undefined,
          settlement_scheme:  c.settlement_scheme ?? undefined,
          owner_fixed_amount: c.owner_fixed_amount,
          owner_payout_day:   c.owner_payout_day,
        }}
      />
    </div>
  )
}
