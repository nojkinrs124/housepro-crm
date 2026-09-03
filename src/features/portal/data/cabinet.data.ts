import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { calcSettlement, isVacantOn } from '@/features/management/services/settlement.service'
import { buildMonthlyReport, type MonthlyReport } from '@/features/management/services/report.service'
import { loadSettlementOperations } from '@/features/management/data/settlement.data'

/**
 * Данные личного кабинета.
 *
 * Все запросы идут сервисным клиентом в обход RLS — потому что у собственника и
 * арендатора нет учётки в организации. Отсюда железное правило: КАЖДАЯ функция
 * здесь принимает уже проверенный доступ (`grant`) и фильтрует по его
 * `propertyId`. Функции без такого параметра в этом файле быть не должно.
 */

interface Grant {
  propertyId: string
  engagementId: string | null
  contractId: string | null
}

const RENT_TYPES = ['rent_apartment', 'rent_commercial']
const ACTIVE_CONTRACT_STATUSES = ['generated', 'signed', 'completed']

export interface OwnerView {
  property: { id: string; title: string; address: string | null }
  tenantName: string | null
  rentAmount: number | null
  rentEnd: string | null
  vacant: boolean
  scheme: string | null
  balance: number
  /** Отчёты за последние месяцы, от свежих к старым. */
  reports: MonthlyReport[]
  meters: { id: string; title: string; unit: string; readings: { reading_date: string; value: number; consumption: number | null }[] }[]
}

export async function loadOwnerView(grant: Grant): Promise<OwnerView | null> {
  const supabaseAdmin = getSupabaseAdmin()

  const [{ data: property }, { data: engagement }, { data: contracts }, { data: meters }] = await Promise.all([
    supabaseAdmin.from('properties').select('id, title, address').eq('id', grant.propertyId).maybeSingle(),
    grant.engagementId
      ? supabaseAdmin.from('management_engagements')
          .select('id, settlement_scheme, rate, owner_fixed_amount, owner_payout_day, started_at, ended_at')
          .eq('id', grant.engagementId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabaseAdmin.from('contracts')
      .select('id, amount, start_date, end_date, status, contract_type, client:contacts!contracts_client_contact_id_fkey(full_name, company_name)')
      .eq('property_id', grant.propertyId)
      .in('contract_type', RENT_TYPES)
      .order('start_date', { ascending: false, nullsFirst: false }),
    supabaseAdmin.from('utility_meters')
      .select('id, title, kind, unit, readings:meter_readings(reading_date, value, consumption)')
      .eq('property_id', grant.propertyId).eq('is_active', true),
  ])

  if (!property) return null

  const today = new Date().toISOString().slice(0, 10)
  const active = (contracts ?? []).find(c =>
    ACTIVE_CONTRACT_STATUSES.includes(c.status) &&
    (!c.start_date || c.start_date <= today) &&
    (!c.end_date || c.end_date >= today))

  const tenant = active ? (Array.isArray(active.client) ? active.client[0] : active.client) : null

  let balance = 0
  let reports: MonthlyReport[] = []
  const scheme = engagement?.settlement_scheme ?? null

  if (engagement && scheme) {
    const terms = {
      scheme: scheme as 'percent' | 'fixed',
      rate: engagement.rate,
      ownerFixedAmount: engagement.owner_fixed_amount,
      ownerPayoutDay: engagement.owner_payout_day,
      startedAt: engagement.started_at,
      endedAt: engagement.ended_at,
    }
    const operations = await loadSettlementOperations(supabaseAdmin, engagement.id)
    balance = calcSettlement(terms, operations).balance

    // Последние шесть месяцев: дальше собственник смотрит редко, а каждый
    // отчёт — это ещё один проход по операциям.
    const now = new Date()
    for (let i = 0; i < 6; i++) {
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
      const year = date.getUTCFullYear()
      const month = date.getUTCMonth() + 1
      const from = `${year}-${String(month).padStart(2, '0')}-01`
      const to = `${year}-${String(month).padStart(2, '0')}-31`
      const periodOps = operations.filter(o => o.date >= from && o.date <= to)
      if (periodOps.length === 0) continue
      reports.push(buildMonthlyReport(terms, year, month, periodOps, operations))
    }
  }

  return {
    property,
    tenantName: tenant ? (tenant.company_name || tenant.full_name) : null,
    rentAmount: active?.amount != null ? Number(active.amount) : null,
    rentEnd: active?.end_date ?? null,
    vacant: isVacantOn(contracts ?? [], today),
    scheme,
    balance,
    reports,
    meters: (meters ?? []).map(m => ({
      id: m.id,
      title: m.title || m.kind,
      unit: m.unit,
      readings: [...(Array.isArray(m.readings) ? m.readings : [])]
        .sort((a, b) => b.reading_date.localeCompare(a.reading_date))
        .slice(0, 6),
    })),
  }
}

export interface TenantView {
  property: { id: string; title: string; address: string | null }
  contract: { id: string; amount: number | null; startDate: string | null; endDate: string | null } | null
  /** Начисления по договору арендатора: и оплаченные, и предстоящие. */
  payments: { id: string; amount: number; date: string; dueDate: string | null; status: string; description: string | null }[]
  nextPaymentDate: string | null
  nextPaymentAmount: number | null
  debt: number
  meters: { id: string; title: string; unit: string; lastValue: number | null; lastDate: string | null }[]
}

export async function loadTenantView(grant: Grant): Promise<TenantView | null> {
  const supabaseAdmin = getSupabaseAdmin()

  const [{ data: property }, { data: contract }, { data: meters }] = await Promise.all([
    supabaseAdmin.from('properties').select('id, title, address').eq('id', grant.propertyId).maybeSingle(),
    grant.contractId
      ? supabaseAdmin.from('contracts').select('id, amount, start_date, end_date')
          .eq('id', grant.contractId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabaseAdmin.from('utility_meters')
      .select('id, title, kind, unit, readings:meter_readings(reading_date, value)')
      .eq('property_id', grant.propertyId).eq('is_active', true),
  ])

  if (!property) return null

  // Начисления строго по договору арендатора: операции объекта включают и
  // расчёты с собственником, которые его не касаются.
  const { data: txns } = grant.contractId
    ? await supabaseAdmin.from('accounting_transactions')
        .select('id, amount, date, due_date, status, description')
        .eq('contract_id', grant.contractId)
        .eq('type', 'income')
        .order('date', { ascending: false })
        .limit(24)
    : { data: [] }

  const today = new Date().toISOString().slice(0, 10)
  const planned = (txns ?? []).filter(t => t.status === 'planned' && t.due_date)
  const upcoming = planned
    .filter(t => (t.due_date as string) >= today)
    .sort((a, b) => (a.due_date as string).localeCompare(b.due_date as string))[0]
  const debt = planned
    .filter(t => (t.due_date as string) < today)
    .reduce((sum, t) => sum + Number(t.amount || 0), 0)

  return {
    property,
    contract: contract
      ? { id: contract.id, amount: contract.amount, startDate: contract.start_date, endDate: contract.end_date }
      : null,
    payments: (txns ?? []).map(t => ({
      id: t.id,
      amount: Number(t.amount || 0),
      date: t.date,
      dueDate: t.due_date,
      status: t.status,
      description: t.description,
    })),
    nextPaymentDate: upcoming?.due_date ?? null,
    nextPaymentAmount: upcoming ? Number(upcoming.amount) : null,
    debt,
    meters: (meters ?? []).map(m => {
      const readings = [...(Array.isArray(m.readings) ? m.readings : [])]
        .sort((a, b) => b.reading_date.localeCompare(a.reading_date))
      return {
        id: m.id,
        title: m.title || m.kind,
        unit: m.unit,
        lastValue: readings[0]?.value ?? null,
        lastDate: readings[0]?.reading_date ?? null,
      }
    }),
  }
}
