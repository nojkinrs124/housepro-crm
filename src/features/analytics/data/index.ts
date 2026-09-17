import { createClient } from '@/lib/supabase/server'
import { todayIso } from '@/lib/timezone'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnalyticsRawData {
  deals: Array<{ status: string; deal_type: string; amount: number | null; commission: number | null; created_at: string | null; source: string | null }>
  payments: Array<{ payment_status: string; amount: number | null; payment_date: string | null; due_date: string | null; created_at: string | null; category_code: string | null }>
  leads: Array<{ status: string; created_at: string | null }>
  leadsConverted: Array<{ status: string; created_at: string | null }>
  properties: Array<{ status: string }>
  overduePayments: Array<{ id: string; amount: number | null; due_date: string | null; contract: { contract_number?: string } | null }>
  overdueTasks: Array<{ id: string; title: string; priority: string | null; deadline: string | null; assignee: { full_name?: string } | null }>
  contracts: Array<{ status: string; contract_type: string }>
}

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
    payment_status: r.status === 'completed'
      ? 'paid'
      : r.status === 'planned'
        ? (r.due_date && r.due_date < today ? 'overdue' : 'pending')
        : 'cancelled',
    amount: r.amount,
    payment_date: r.paid_at,
    due_date: r.due_date,
    created_at: r.created_at,
  }))
}

// ─── Cached fetcher ───────────────────────────────────────────────────────────

async function fetchAnalyticsData(from?: string, to?: string): Promise<AnalyticsRawData> {
  const supabase = await createClient()
  const last12 = getLast12Months()
  const fromDate = from ?? `${last12[0]}-01`
  const toDate   = to   ? `${to}T23:59:59` : undefined

  const [
    dealsResult,
    paymentsResult,
    leadsResult,
    leadsConvertedResult,
    propertiesResult,
    overduePaymentsResult,
    overdueTasksResult,
    contractsResult,
  ] = await Promise.all([
    supabase
      .from('deals')
      .select('status, deal_type, amount, commission, created_at, source')
      .gte('created_at', fromDate)
      .lte('created_at', toDate ?? new Date().toISOString()),

    // Платежи — из accounting_transactions: таблица payments заморожена с июня
    // 2026 (7 строк, открытых 0), аналитика по ней показывала застывшую картину.
    supabase
      .from('accounting_transactions')
      .select('status, amount, paid_at, due_date, created_at, category:accounting_categories(code)')
      .eq('type', 'income')
      .gte('created_at', fromDate)
      .lte('created_at', toDate ?? new Date().toISOString()),

    supabase
      .from('leads')
      .select('status, created_at')
      .gte('created_at', fromDate)
      .lte('created_at', toDate ?? new Date().toISOString()),

    supabase
      .from('leads')
      .select('status, created_at')
      .eq('status', 'closed')
      .gte('created_at', fromDate)
      .lte('created_at', toDate ?? new Date().toISOString()),

    supabase.from('properties').select('status'),

    supabase
      .from('accounting_transactions')
      .select('id, amount, due_date, contract:contracts(contract_number)')
      .eq('type', 'income')
      .eq('status', 'planned')
      .lt('due_date', todayIso())
      .order('due_date', { ascending: true })
      .limit(6),

    supabase
      .from('tasks')
      .select('id, title, priority, deadline, assignee:users!tasks_assigned_to_fkey(full_name)')
      .lt('deadline', new Date().toISOString())
      .not('status', 'in', '(done,cancelled)')
      .order('deadline', { ascending: true })
      .limit(6),

    supabase.from('contracts').select('status, contract_type'),
  ])

  return {
    deals: (dealsResult.data ?? []) as AnalyticsRawData['deals'],
    payments: toPaymentShape(paymentsResult.data ?? []),
    leads: leadsResult.data ?? [],
    leadsConverted: leadsConvertedResult.data ?? [],
    properties: propertiesResult.data ?? [],
    overduePayments: (overduePaymentsResult.data ?? []) as AnalyticsRawData['overduePayments'],
    overdueTasks: (overdueTasksResult.data ?? []) as AnalyticsRawData['overdueTasks'],
    contracts: contractsResult.data ?? [],
  }
}

// ─── Public export ────────────────────────────────────────────────────────────

export const getAnalyticsData = fetchAnalyticsData

