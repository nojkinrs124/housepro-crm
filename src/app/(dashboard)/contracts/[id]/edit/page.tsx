import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, FileText } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { updateContractAction } from '@/features/contracts/actions/contracts.actions'
import { ContractForm } from '@/features/contracts/components/ContractForm'
import { getContractFormData } from '@/features/contracts/data/contract-form-data'
import { PageHeader } from '@/components/layout/PageHeader'

export default async function EditContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: rawContract } = await supabase.from('contracts').select('*').eq('id', id).single()
  if (!rawContract) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dealId = (rawContract as any).deal_id as string | undefined
  const formData = await getContractFormData(id, dealId)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = rawContract as any
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
          contract_type_data: c.contract_type_data ?? undefined,
        }}
      />
    </div>
  )
}
