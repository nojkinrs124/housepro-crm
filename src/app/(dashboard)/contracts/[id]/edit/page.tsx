import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, FileText } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { updateContractAction } from '@/features/contracts/actions/contracts.actions'
import { ContractForm } from '@/features/contracts/components/ContractForm'

export default async function EditContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: rawContract }, { data: rawContacts }, { data: rawProperties }] = await Promise.all([
    supabase.from('contracts').select('*').eq('id', id).single(),
    supabase.from('contacts').select('id, full_name, phone, role').order('full_name'),
    supabase.from('properties').select('id, title, address').order('title'),
  ])

  if (!rawContract) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = rawContract as any
  const contacts = rawContacts ?? []
  const properties = rawProperties ?? []
  const owners  = contacts.filter((x: { role: string }) => x.role === 'owner' || x.role === 'both')
  const clients = contacts.filter((x: { role: string }) => x.role === 'client' || x.role === 'both')

  const boundAction = updateContractAction.bind(null, id)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href={`/contracts/${id}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition">
        <ArrowLeft className="w-4 h-4" />
        Вернуться к договору
      </Link>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
          <FileText className="w-5 h-5 text-violet-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Редактировать договор</h1>
          <p className="text-muted-foreground text-sm">{c.contract_number ?? `#${id.slice(0, 8)}`}</p>
        </div>
      </div>

      <ContractForm
        action={boundAction}
        owners={owners}
        clients={clients}
        properties={properties}
        backHref={`/contracts/${id}`}
        submitLabel="Сохранить изменения"
        mode="edit"
        defaults={{
          contract_type:     c.contract_type,
          owner_contact_id:  c.owner_contact_id ?? undefined,
          client_contact_id: c.client_contact_id ?? c.client_id ?? undefined,
          property_id:       c.property_id ?? undefined,
          amount:            c.amount,
          deposit:           c.deposit,
          start_date:        c.start_date,
          end_date:          c.end_date,
          notes:             c.notes,
          status:            c.status,
        }}
      />
    </div>
  )
}
