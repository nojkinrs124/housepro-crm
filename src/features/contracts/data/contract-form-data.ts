import { createClient } from '@/lib/supabase/server'
import { DEAL_TYPE_LABELS as dealTypeLabels } from '@/features/deals/config/deal-stages'

// currentDealId — сделка, уже привязанная к редактируемому договору. Список сделок
// по умолчанию скрывает завершённые/отменённые (чтобы не создавать новые договоры под
// них), но если договор УЖЕ был привязан к такой сделке, её нужно показать в списке —
// иначе при сохранении формы связь молча потеряется (в select её просто не будет).
export async function getContractFormData(excludeContractId?: string, currentDealId?: string) {
  const supabase = await createClient()

  const [
    { data: rawContacts },
    { data: rawProperties },
    { data: rawReps },
    { data: rawBaseContracts },
    { data: rawCompanyProfiles },
    { data: rawDeals },
  ] = await Promise.all([
    supabase.from('contacts').select('id, full_name, phone, role, client_type').order('full_name'),
    supabase.from('properties').select('id, title, address, property_type').order('title'),
    supabase.from('contact_representatives').select('id, contact_id, full_name, position, is_primary').order('is_primary', { ascending: false }),
    supabase
      .from('contracts')
      .select('id, contract_number, end_date, property:properties(address)')
      .in('contract_type', ['rent_apartment', 'rent_commercial'])
      .order('created_at', { ascending: false }),
    supabase
      .from('company_settings')
      .select('id, legal_form, name, is_default')
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true }),
    // Открытые сделки — для связки «Сделка» на форме договора (двигает сделку по
    // стадиям автоматически при создании договора / формировании DOCX / оплате).
    // Плюс — уже привязанная к этому договору сделка, даже если она завершена/отменена,
    // иначе при сохранении формы связь молча потеряется.
    supabase
      .from('deals')
      .select('id, deal_type, amount, property:properties(title, address)')
      .or(
        currentDealId
          ? `status.not.in.(completed,cancelled),id.eq.${currentDealId}`
          : 'status.not.in.(completed,cancelled)'
      )
      .order('created_at', { ascending: false }),
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

  const companyProfiles = (rawCompanyProfiles ?? []).map((p) => ({
    id: p.id as string,
    name: (p.name as string) || 'Без названия',
    legalForm: p.legal_form as string,
    isDefault: !!p.is_default,
  }))
  const defaultCompanyProfileId = companyProfiles.find((p) => p.isDefault)?.id ?? companyProfiles[0]?.id ?? ''

  const deals = (rawDeals ?? []).map((d) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const property = d.property as any
    const addressPart = property?.title ? ` — ${property.title}` : ''
    const amountPart = d.amount ? ` (${Number(d.amount).toLocaleString('ru-RU')} ₽)` : ''
    return { id: d.id as string, label: `${dealTypeLabels[d.deal_type] ?? d.deal_type}${addressPart}${amountPart}` }
  })

  return { owners, clients, properties, representativesByContact, baseContracts, companyProfiles, defaultCompanyProfileId, deals }
}
