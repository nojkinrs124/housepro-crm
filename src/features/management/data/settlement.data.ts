import type { createClient } from '@/lib/supabase/server'
import type { SettlementOperation } from '@/features/management/services/settlement.service'

type Client = Awaited<ReturnType<typeof createClient>>

export interface EngagementTerms {
  id: string
  property_id: string
  owner_contact_id: string | null
  settlement_scheme: string | null
  rate: number | null
  owner_fixed_amount: number | null
  owner_payout_day: number | null
  repair_limit: number | null
  started_at: string
  ended_at: string | null
}

/**
 * Загрузчики данных взаиморасчёта.
 *
 * Отдельно от Server Actions намеренно: в файле с 'use server' каждый экспорт
 * становится вызываемым извне эндпоинтом, а это обычные функции чтения, которые
 * нужны и экшенам, и страницам.
 */
export async function loadEngagementTerms(supabase: Client, engagementId: string): Promise<EngagementTerms | null> {
  const { data } = await supabase
    .from('management_engagements')
    .select('id, property_id, owner_contact_id, settlement_scheme, rate, owner_fixed_amount, owner_payout_day, repair_limit, started_at, ended_at')
    .eq('id', engagementId)
    .maybeSingle()
  return data ?? null
}

/** Операции обслуживания в форме, которую понимает расчёт. */
export async function loadSettlementOperations(
  supabase: Client,
  engagementId: string,
  from?: string,
  to?: string,
): Promise<SettlementOperation[]> {
  let query = supabase
    .from('accounting_transactions')
    .select('type, status, amount, date, borne_by, category:accounting_categories(code)')
    .eq('engagement_id', engagementId)
  if (from) query = query.gte('date', from)
  if (to) query = query.lte('date', to)

  const { data } = await query
  return (data ?? []).map(t => {
    const category = Array.isArray(t.category) ? t.category[0] : t.category
    return {
      type: t.type as 'income' | 'expense',
      status: t.status,
      categoryCode: category?.code ?? null,
      amount: Number(t.amount || 0),
      date: t.date,
      borneBy: (t.borne_by as 'agency' | 'owner' | null) ?? null,
    }
  })
}

/** Категория по стабильному коду. Название пользователь правит, код — нет. */
export async function categoryIdByCode(supabase: Client, code: string): Promise<string | null> {
  const { data } = await supabase
    .from('accounting_categories')
    .select('id')
    .eq('code', code)
    .maybeSingle()
  return data?.id ?? null
}
