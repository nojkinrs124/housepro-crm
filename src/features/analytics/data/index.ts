import { formatMoney } from '@/lib/utils'
import { unstable_cache } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnalyticsRawData {
  deals: Array<{ status: string; deal_type: string; amount: number | null; commission: number | null; created_at: string | null }>
  payments: Array<{ payment_status: string; amount: number | null; payment_date: string | null; due_date: string | null; created_at: string | null }>
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

// ─── Cached fetcher ───────────────────────────────────────────────────────────

async function fetchAnalyticsData(): Promise<AnalyticsRawData> {
  const supabase = await createClient()
  const last12 = getLast12Months()
  const fromDate = `${last12[0]}-01`

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
      .select('status, deal_type, amount, commission, created_at')
      .gte('created_at', fromDate),

    supabase
      .from('payments')
      .select('payment_status, amount, payment_date, due_date, created_at')
      .gte('created_at', fromDate),

    supabase
      .from('leads')
      .select('status, created_at')
      .gte('created_at', fromDate),

    supabase
      .from('leads')
      .select('status, created_at')
      .eq('status', 'closed')
      .gte('created_at', fromDate),

    supabase.from('properties').select('status'),

    supabase
      .from('payments')
      .select('id, amount, due_date, contract:contracts(contract_number)')
      .eq('payment_status', 'overdue')
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
    payments: (paymentsResult.data ?? []) as AnalyticsRawData['payments'],
    leads: leadsResult.data ?? [],
    leadsConverted: leadsConvertedResult.data ?? [],
    properties: propertiesResult.data ?? [],
    overduePayments: (overduePaymentsResult.data ?? []) as AnalyticsRawData['overduePayments'],
    overdueTasks: (overdueTasksResult.data ?? []) as AnalyticsRawData['overdueTasks'],
    contracts: contractsResult.data ?? [],
  }
}

// ─── Public cached export ─────────────────────────────────────────────────────
// Кэш на 5 минут, инвалидируется через revalidatePath('/analytics', 'page') при мутациях

export const getAnalyticsData = unstable_cache(
  fetchAnalyticsData,
  ['analytics-data'],
  {
    revalidate: 300, // 5 минут
  }
)

