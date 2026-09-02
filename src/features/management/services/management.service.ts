import type { createClient } from '@/lib/supabase/server'
import type { ManagementRow } from '@/features/management/components/ManagementView'

type Client = Awaited<ReturnType<typeof createClient>>

/** За сколько дней до конца договора он считается истекающим. */
const EXPIRING_DAYS = 30

/**
 * Типы договоров, по которым объект кому-то сдан. Именно они приводят в
 * управление арендатора: в договоре аренды сторона «клиент» —
 * client_contact_id — это и есть наниматель, а объект тот же (property_id).
 * Отдельной связи «объект в управлении → арендатор» заводить не нужно.
 */
const RENT_CONTRACT_TYPES = ['rent_apartment', 'rent_commercial', 'sublease']

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
 * Собирает строки раздела «Управление».
 *
 * Объект в управлении — это properties.deal_type = 'management' либо объект,
 * на который оформлен договор property_management: второе важнее, потому что
 * тип сделки у объекта могли не переставить, а договор уже действует.
 *
 * Всё считается пятью запросами по списку id, без выборок в цикле.
 */
export async function collectManagement(supabase: Client): Promise<ManagementRow[]> {
  const [{ data: byDealType }, { data: mgmtContracts }] = await Promise.all([
    supabase.from('properties')
      .select('id, title, address, owner_id, manager_id, management_fee')
      .eq('deal_type', 'management'),
    supabase.from('contracts')
      .select('id, contract_number, property_id, amount, end_date, status, created_at')
      .eq('contract_type', 'property_management')
      .not('property_id', 'is', null)
      .order('created_at', { ascending: false }),
  ])

  const contractByProperty = new Map<string, NonNullable<typeof mgmtContracts>[number]>()
  for (const c of mgmtContracts ?? []) {
    // Договоры отсортированы от новых к старым — берём первый по объекту
    if (c.property_id && !contractByProperty.has(c.property_id)) contractByProperty.set(c.property_id, c)
  }

  const ids = [...new Set([
    ...(byDealType ?? []).map(p => p.id),
    ...contractByProperty.keys(),
  ])]
  if (ids.length === 0) return []

  const knownProperties = new Map((byDealType ?? []).map(p => [p.id, p]))
  const missing = ids.filter(id => !knownProperties.has(id))
  if (missing.length > 0) {
    const { data: extra } = await supabase.from('properties')
      .select('id, title, address, owner_id, manager_id, management_fee')
      .in('id', missing)
    for (const p of extra ?? []) knownProperties.set(p.id, p)
  }

  const now = new Date()
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const monthStart = startOfMonth(now)
  const todayStr = today.toISOString().slice(0, 10)

  const ownerIds = [...new Set([...knownProperties.values()].map(p => p.owner_id).filter((v): v is string => !!v))]
  const managerIds = [...new Set([...knownProperties.values()].map(p => p.manager_id).filter((v): v is string => !!v))]

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
    const property = knownProperties.get(id)!
    const contract = contractByProperty.get(id) ?? null
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

    return {
      id,
      title: property.title,
      address: property.address,
      ownerId: property.owner_id,
      ownerName: property.owner_id ? ownerById.get(property.owner_id) ?? null : null,
      managerName: property.manager_id ? managerById.get(property.manager_id) ?? null : null,
      contractId: contract?.id ?? null,
      contractNumber: contract?.contract_number ?? null,
      contractEnd: contract?.end_date ?? null,
      fee: contract?.amount != null ? Number(contract.amount)
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
