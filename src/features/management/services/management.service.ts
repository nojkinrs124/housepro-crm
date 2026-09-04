import type { createClient } from '@/lib/supabase/server'
import type { ManagementRow } from '@/features/management/components/ManagementView'
import { RENT_CONTRACT_TYPES } from '@/features/contracts/config/contract-types'

type Client = Awaited<ReturnType<typeof createClient>>

/** За сколько дней до конца договора он считается истекающим. */
const EXPIRING_DAYS = 30



function startOfMonth(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10)
}

function stateOf(contractEnd: string | null, hasContract: boolean, today: Date): ManagementRow['state'] {
  if (!hasContract) return 'no_contract'
  if (!contractEnd) return 'active'
  const end = new Date(contractEnd)
  if (end < today) return 'expired'
  const soon = new Date(today.getTime() + EXPIRING_DAYS * 86400000)
  return end <= soon ? 'expiring' : 'active'
}

/**
 * Собирает строки раздела «Объекты в управлении».
 *
 * Источник — таблица `management_engagements`. До 03.09.2026 раздел был
 * витриной: список каждый раз выводился из `properties.deal_type` и типа
 * договора, своей сущности не существовало, и вешать на неё регламент,
 * счётчики и взаиморасчёт было некуда.
 *
 * Всё считается фиксированным числом запросов по списку id, без выборок в цикле.
 */
export async function collectManagement(supabase: Client): Promise<ManagementRow[]> {
  const { data: engagements } = await supabase
    .from('management_engagements')
    .select(`
      id, property_id, owner_contact_id, contract_id, plan_id, status,
      settlement_scheme, rate, owner_fixed_amount, owner_payout_day, repair_limit,
      started_at, ended_at, notes,
      property:properties(id, title, address, manager_id, management_fee),
      contract:contracts(id, contract_number, end_date, amount, status),
      handover:property_handovers(completed_at)
    `)
    .is('ended_at', null)
    .order('started_at', { ascending: false })

  if (!engagements || engagements.length === 0) return []

  type EngagementRow = NonNullable<typeof engagements>[number]
  const byProperty = new Map<string, EngagementRow>()
  for (const e of engagements) {
    if (e.property_id) byProperty.set(e.property_id, e)
  }

  const ids = [...byProperty.keys()]
  const ownerIds = [...new Set(engagements.map(e => e.owner_contact_id).filter((v): v is string => !!v))]
  const managerIds = [...new Set(engagements
    .map(e => (Array.isArray(e.property) ? e.property[0] : e.property)?.manager_id)
    .filter((v): v is string => !!v))]

  const now = new Date()
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const monthStart = startOfMonth(now)
  const todayStr = today.toISOString().slice(0, 10)

  const [
    { data: managers }, { data: txns }, { data: tasks }, { data: meters }, { data: rentContracts },
  ] = await Promise.all([
    managerIds.length ? supabase.from('users').select('id, full_name').in('id', managerIds) : Promise.resolve({ data: [] }),
    supabase.from('accounting_transactions')
      .select('id, property_id, contract_id, type, amount, status, date, due_date')
      .in('property_id', ids),
    supabase.from('tasks').select('id, property_id, status').in('property_id', ids),
    supabase.from('utility_meters').select('id, property_id').in('property_id', ids).eq('is_active', true),
    supabase.from('contracts')
      .select('id, property_id, contract_type, status, amount, start_date, end_date, client_contact_id')
      .in('property_id', ids)
      .in('contract_type', RENT_CONTRACT_TYPES)
      .order('start_date', { ascending: false, nullsFirst: false }),
  ])

  // Действующая аренда по объекту: не отменена и ещё не закончилась.
  // Договоры отсортированы от свежих, поэтому берётся первый подходящий.
  const rentByProperty = new Map<string, NonNullable<typeof rentContracts>[number]>()
  for (const c of rentContracts ?? []) {
    if (!c.property_id || rentByProperty.has(c.property_id)) continue
    if (c.status === 'cancelled') continue
    if (c.end_date && c.end_date < todayStr) continue
    rentByProperty.set(c.property_id, c)
  }

  const tenantIds = [...new Set([...rentByProperty.values()]
    .map(c => c.client_contact_id).filter((v): v is string => !!v))]

  const contactIds = [...new Set([...ownerIds, ...tenantIds])]
  const { data: owners } = contactIds.length
    ? await supabase.from('contacts').select('id, full_name, company_name').in('id', contactIds)
    : { data: [] }

  const meterIds = (meters ?? []).map(m => m.id)
  const { data: readings } = meterIds.length
    ? await supabase.from('meter_readings').select('meter_id, reading_date').in('meter_id', meterIds)
    : { data: [] }

  const lastReadingByMeter = new Map<string, string>()
  for (const r of readings ?? []) {
    const prev = lastReadingByMeter.get(r.meter_id)
    if (!prev || r.reading_date > prev) lastReadingByMeter.set(r.meter_id, r.reading_date)
  }

  const ownerById = new Map((owners ?? []).map(o => [o.id, o.company_name || o.full_name]))
  const managerById = new Map((managers ?? []).map(m => [m.id, m.full_name]))

  return ids.map(id => {
    const engagement = byProperty.get(id)!
    const property = (Array.isArray(engagement.property) ? engagement.property[0] : engagement.property)!
    const contract = (Array.isArray(engagement.contract) ? engagement.contract[0] : engagement.contract) ?? null
    const handover = Array.isArray(engagement.handover) ? engagement.handover[0] : engagement.handover
    const rent = rentByProperty.get(id) ?? null

    const propertyTxns = (txns ?? []).filter(t => t.property_id === id)
    const incomeMonth = propertyTxns
      .filter(t => t.type === 'income' && t.status === 'completed' && t.date >= monthStart)
      .reduce((sum, t) => sum + Number(t.amount), 0)
    const expenseMonth = propertyTxns
      .filter(t => t.type === 'expense' && t.status === 'completed' && t.date >= monthStart)
      .reduce((sum, t) => sum + Number(t.amount), 0)

    const planned = propertyTxns.filter(t => t.status === 'planned' && t.due_date)
    const overdueAmount = planned
      .filter(t => (t.due_date as string) < todayStr)
      .reduce((sum, t) => sum + Number(t.amount), 0)
    const upcoming = planned
      .filter(t => (t.due_date as string) >= todayStr)
      .sort((a, b) => (a.due_date as string).localeCompare(b.due_date as string))[0]

    const propertyMeters = (meters ?? []).filter(m => m.property_id === id)
    const lastReadingDate = propertyMeters
      .map(m => lastReadingByMeter.get(m.id))
      .filter((v): v is string => !!v)
      .sort()
      .pop() ?? null

    // Чего не хватает, чтобы обслуживание считать налаженным. Показывается на
    // карточке — тот же принцип, что и в блоке «Чего не хватает» по проекту:
    // лучше честно перечислить пробелы, чем притворяться, что всё готово.
    const missingTerms: string[] = []
    if (!engagement.owner_contact_id) missingTerms.push('собственник')
    if (!engagement.settlement_scheme) missingTerms.push('схема расчёта')
    if (!engagement.contract_id) missingTerms.push('договор управления')
    // Принять объект можно и по черновику — договор часто существует на бумаге
    // раньше, чем в CRM. Но пропасть из виду это не должно: по неподписанному
    // договору нет ни сроков, ни обязательств, на которые можно сослаться.
    else if (contract && contract.status === 'draft') missingTerms.push('подпись договора')
    if (!handover?.completed_at) missingTerms.push('акт приёма')

    return {
      id,
      engagementId: engagement.id,
      engagementStatus: engagement.status,
      settlementScheme: engagement.settlement_scheme,
      missingTerms,
      title: property.title,
      address: property.address,
      ownerId: engagement.owner_contact_id,
      ownerName: engagement.owner_contact_id ? ownerById.get(engagement.owner_contact_id) ?? null : null,
      managerName: property.manager_id ? managerById.get(property.manager_id) ?? null : null,
      contractId: contract?.id ?? null,
      contractNumber: contract?.contract_number ?? null,
      contractEnd: contract?.end_date ?? null,
      // Вознаграждение: при фиксированной схеме показываем выплату собственнику,
      // при процентной — сумму договора управления. Величины разные по смыслу,
      // поэтому в колонке подписаны схемой.
      fee: engagement.settlement_scheme === 'fixed' && engagement.owner_fixed_amount != null
        ? Number(engagement.owner_fixed_amount)
        : contract?.amount != null ? Number(contract.amount)
        : property.management_fee != null ? Number(property.management_fee) : null,
      nextPaymentDate: upcoming?.due_date ?? null,
      nextPaymentAmount: upcoming ? Number(upcoming.amount) : null,
      overdueAmount,
      incomeMonth,
      expenseMonth,
      tenantId: rent?.client_contact_id ?? null,
      tenantName: rent?.client_contact_id ? ownerById.get(rent.client_contact_id) ?? null : null,
      rentContractId: rent?.id ?? null,
      rentAmount: rent?.amount != null ? Number(rent.amount) : null,
      rentEnd: rent?.end_date ?? null,
      tenantDebt: rent
        ? propertyTxns
            .filter(t => t.contract_id === rent.id && t.status === 'planned' && t.due_date && (t.due_date as string) < todayStr)
            .reduce((sum, t) => sum + Number(t.amount), 0)
        : 0,
      openTasks: (tasks ?? []).filter(t => t.property_id === id && !['done', 'cancelled'].includes(t.status)).length,
      metersCount: propertyMeters.length,
      lastReadingDate,
      state: stateOf(contract?.end_date ?? null, !!contract, today),
    }
  })
}
