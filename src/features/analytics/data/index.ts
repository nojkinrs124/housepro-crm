import { createClient } from '@/lib/supabase/server'
import { todayIso } from '@/lib/timezone'
import { toPaymentStatus } from '@/features/accounting/utils/money-classification'
import { transactionDirection, type AccountingFilters } from '@/features/accounting/utils/direction'
import { getContractTypeConfig } from '@/features/contracts/config/contract-types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnalyticsRawData {
  deals: Array<{ status: string; deal_type: string; amount: number | null; commission: number | null; created_at: string | null; source: string | null }>
  payments: Array<{ payment_status: string; amount: number | null; payment_date: string | null; due_date: string | null; created_at: string | null; category_code: string | null }>
  leads: Array<{ status: string; created_at: string | null }>
  leadsConverted: Array<{ status: string; created_at: string | null }>
  properties: Array<{ status: string }>
  overdueTasks: Array<{ id: string; title: string; priority: string | null; deadline: string | null; assignee: { full_name?: string } | null }>
  contracts: Array<{ status: string; contract_type: string }>
}

export type AnalyticsFilters = AccountingFilters

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getLast12Months(): string[] {
  const months: string[] = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

export function monthLabel(isoMonth: string) {
  const d = new Date(isoMonth)
  return d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' })
}

/**
 * Операция учёта → форма «платежа», которую ждёт страница аналитики:
 * выполненный доход = оплачен, запланированный до срока = ожидает, после срока =
 * просрочен. Так страница не зависит от того, из какой таблицы пришли данные.
 */
function toPaymentShape(rows: Array<{ status: string; amount: number | null; paid_at: string | null; due_date: string | null; created_at: string | null; category?: { code: string | null } | { code: string | null }[] | null }>): AnalyticsRawData['payments'] {
  const today = todayIso()
  return rows.map(r => ({
    category_code: (Array.isArray(r.category) ? r.category[0]?.code : r.category?.code) ?? null,
    payment_status: toPaymentStatus(r.status, r.due_date, today),
    amount: r.amount,
    payment_date: r.paid_at,
    due_date: r.due_date,
    created_at: r.created_at,
  }))
}

// ─── Cached fetcher ───────────────────────────────────────────────────────────

async function fetchAnalyticsData(from?: string, to?: string, filters?: AnalyticsFilters): Promise<AnalyticsRawData> {
  const supabase = await createClient()
  const last12 = getLast12Months()
  const fromDate = from ?? `${last12[0]}-01`
  const toDate   = to   ? `${to}T23:59:59` : undefined

  let dealsQuery = supabase
    .from('deals')
    .select('status, deal_type, amount, commission, created_at, source')
    .gte('created_at', fromDate)
    .lte('created_at', toDate ?? new Date().toISOString())
  if (filters?.employeeId) dealsQuery = dealsQuery.eq('manager_id', filters.employeeId)
  if (filters?.propertyId) dealsQuery = dealsQuery.eq('property_id', filters.propertyId)
  if (filters?.direction)  dealsQuery = dealsQuery.eq('deal_type', filters.direction)

  // Платежи — из accounting_transactions: таблица payments заморожена с июня
  // 2026 (7 строк, открытых 0), аналитика по ней показывала застывшую картину.
  // Направление здесь не колонка — довыбираем связи и фильтруем в JS тем же
  // transactionDirection(), что и Бухгалтерия (money-classification.ts).
  let paymentsQuery = supabase
    .from('accounting_transactions')
    .select('status, amount, paid_at, due_date, created_at, employee_id, property_id, engagement_id, category:accounting_categories(code), contract:contracts(contract_type), deal:deals(deal_type)')
    .eq('type', 'income')
    .gte('created_at', fromDate)
    .lte('created_at', toDate ?? new Date().toISOString())
  if (filters?.employeeId) paymentsQuery = paymentsQuery.eq('employee_id', filters.employeeId)
  if (filters?.propertyId) paymentsQuery = paymentsQuery.eq('property_id', filters.propertyId)

  let leadsQuery = supabase
    .from('leads')
    .select('status, created_at')
    .gte('created_at', fromDate)
    .lte('created_at', toDate ?? new Date().toISOString())
  if (filters?.employeeId) leadsQuery = leadsQuery.eq('assigned_to', filters.employeeId)
  if (filters?.propertyId) leadsQuery = leadsQuery.eq('property_id', filters.propertyId)
  if (filters?.direction)  leadsQuery = leadsQuery.eq('deal_type', filters.direction)

  let leadsConvertedQuery = supabase
    .from('leads')
    .select('status, created_at')
    .eq('status', 'closed')
    .gte('created_at', fromDate)
    .lte('created_at', toDate ?? new Date().toISOString())
  if (filters?.employeeId) leadsConvertedQuery = leadsConvertedQuery.eq('assigned_to', filters.employeeId)
  if (filters?.propertyId) leadsConvertedQuery = leadsConvertedQuery.eq('property_id', filters.propertyId)
  if (filters?.direction)  leadsConvertedQuery = leadsConvertedQuery.eq('deal_type', filters.direction)

  let propertiesQuery = supabase.from('properties').select('status')
  if (filters?.propertyId) propertiesQuery = propertiesQuery.eq('id', filters.propertyId)

  let contractsQuery = supabase.from('contracts').select('status, contract_type, property_id, manager_id')
  if (filters?.employeeId) contractsQuery = contractsQuery.eq('manager_id', filters.employeeId)
  if (filters?.propertyId) contractsQuery = contractsQuery.eq('property_id', filters.propertyId)

  const [
    dealsResult,
    paymentsResult,
    leadsResult,
    leadsConvertedResult,
    propertiesResult,
    overdueTasksResult,
    contractsResult,
  ] = await Promise.all([
    dealsQuery,
    paymentsQuery,
    leadsQuery,
    leadsConvertedQuery,
    propertiesQuery,

    supabase
      .from('tasks')
      .select('id, title, priority, deadline, assignee:users!tasks_assigned_to_fkey(full_name)')
      .lt('deadline', new Date().toISOString())
      .not('status', 'in', '(done,cancelled)')
      .order('deadline', { ascending: true })
      .limit(6),

    contractsQuery,
  ])

  type PaymentRow = {
    status: string; amount: number | null; paid_at: string | null; due_date: string | null; created_at: string | null
    engagement_id: string | null
    category?: { code: string | null } | { code: string | null }[] | null
    contract?: { contract_type: string | null } | { contract_type: string | null }[] | null
    deal?: { deal_type: string | null } | { deal_type: string | null }[] | null
  }
  const oneOf = <T,>(v: T | T[] | null | undefined): T | null => Array.isArray(v) ? v[0] ?? null : v ?? null
  const paymentRows = ((paymentsResult.data ?? []) as unknown as PaymentRow[]).filter(r => {
    if (!filters?.direction) return true
    return transactionDirection({
      contractType: oneOf(r.contract)?.contract_type ?? null,
      engagementId: r.engagement_id,
      dealType: oneOf(r.deal)?.deal_type ?? null,
    }) === filters.direction
  })

  type ContractRow = { status: string; contract_type: string; property_id: string | null; manager_id: string | null }
  const contractRows = ((contractsResult.data ?? []) as ContractRow[]).filter(r => {
    if (!filters?.direction) return true
    return getContractTypeConfig(r.contract_type)?.direction === filters.direction
  })

  return {
    deals: (dealsResult.data ?? []) as AnalyticsRawData['deals'],
    payments: toPaymentShape(paymentRows),
    leads: leadsResult.data ?? [],
    leadsConverted: leadsConvertedResult.data ?? [],
    properties: propertiesResult.data ?? [],
    overdueTasks: (overdueTasksResult.data ?? []) as AnalyticsRawData['overdueTasks'],
    contracts: contractRows,
  }
}

// ─── Public export ────────────────────────────────────────────────────────────

export const getAnalyticsData = fetchAnalyticsData

