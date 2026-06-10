import { createContractAction } from '@/features/contracts/actions/contracts.actions'
import { ContractForm } from '@/features/contracts/components/ContractForm'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, FileText } from 'lucide-react'
import Link from 'next/link'

export default async function NewContractPage({
  searchParams,
}: {
  searchParams: Promise<{ client_id?: string; owner_id?: string; property_id?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const [{ data: rawContacts }, { data: rawProperties }] = await Promise.all([
    supabase.from('contacts').select('id, full_name, phone, role').order('full_name'),
    supabase.from('properties').select('id, title, address').order('title'),
  ])

  const contacts = rawContacts ?? []
  const properties = rawProperties ?? []
  const owners  = contacts.filter(c => c.role === 'owner' || c.role === 'both')
  const clients = contacts.filter(c => c.role === 'client' || c.role === 'both')

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/contracts" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Назад к договорам
      </Link>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
          <FileText className="w-5 h-5 text-violet-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Новый договор</h1>
          <p className="text-muted-foreground text-sm">Укажите обе стороны из единой базы контактов</p>
        </div>
      </div>

      <ContractForm
        action={createContractAction}
        owners={owners}
        clients={clients}
        properties={properties}
        backHref="/contracts"
        submitLabel="Создать договор"
        mode="create"
        defaults={{
          owner_contact_id: params.owner_id,
          client_contact_id: params.client_id,
          property_id: params.property_id,
        }}
      />
    </div>
  )
}
