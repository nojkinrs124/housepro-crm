import { createClient } from '@/lib/supabase/server'

export async function getContractFormData(excludeContractId?: string) {
  const supabase = await createClient()

  const [
    { data: rawContacts },
    { data: rawProperties },
    { data: rawReps },
    { data: rawBaseContracts },
    { data: company },
  ] = await Promise.all([
    supabase.from('contacts').select('id, full_name, phone, role, client_type').order('full_name'),
    supabase.from('properties').select('id, title, address, property_type').order('title'),
    supabase.from('contact_representatives').select('id, contact_id, full_name, position, is_primary').order('is_primary', { ascending: false }),
    supabase
      .from('contracts')
      .select('id, contract_number, end_date, property:properties(address)')
      .in('contract_type', ['rent_apartment', 'rent_commercial'])
      .order('created_at', { ascending: false }),
    supabase.from('company_settings').select('name').limit(1).maybeSingle(),
  ])

  const contacts = rawContacts ?? []
  const properties = rawProperties ?? []
  const owners = contacts.filter((c) => c.role === 'owner' || c.role === 'both')
  const clients = contacts.filter((c) => c.role === 'client' || c.role === 'both')

  interface RepRow { id: string; contact_id: string; full_name: string; position: string | null; is_primary: boolean | null }
  const representativesByContact: Record<string, RepRow[]> = {}
  for (const r of (rawReps ?? []) as RepRow[]) {
    (representativesByContact[r.contact_id] ??= []).push(r)
  }

  const baseContracts = (rawBaseContracts ?? [])
    .filter((c) => c.id !== excludeContractId)
    .map((c) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const property = c.property as any
      const addressPart = property?.address ? ` — ${property.address}` : ''
      const endPart = c.end_date ? ` (до ${new Date(c.end_date).toLocaleDateString('ru-RU')})` : ''
      return { id: c.id, label: `${c.contract_number || `№${c.id.slice(0, 8)}`}${addressPart}${endPart}` }
    })

  const companyName = company?.name || 'HousePro'

  return { owners, clients, properties, representativesByContact, baseContracts, companyName }
}
