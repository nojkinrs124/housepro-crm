import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type { DealPlanOption } from '@/features/directions/components/DirectionStagePicker'

/**
 * Активные тарифы для выбора в форме сделки. Ставка в сделку не копируется —
 * она фиксируется в договоре при его сохранении (FR-007).
 */
export async function loadDealPlans(supabase: SupabaseClient<Database>): Promise<DealPlanOption[]> {
  const { data } = await supabase
    .from('service_plans')
    .select('id, title, charge_type, rate, directions')
    .eq('is_active', true)
    .order('sort_order')
  return (data ?? []).map(p => ({
    id: p.id,
    title: p.title,
    chargeType: p.charge_type,
    rate: p.rate,
    directions: p.directions ?? [],
  }))
}

/**
 * Тариф по умолчанию для направления: единственный активный. Когда их несколько
 * или нет ни одного, выбирать должен человек.
 */
export async function defaultPlanFor(supabase: SupabaseClient<Database>, direction: string): Promise<string | null> {
  const { data } = await supabase
    .from('service_plans')
    .select('id')
    .eq('is_active', true)
    .contains('directions', [direction])
    .limit(2)
  return data && data.length === 1 ? data[0].id : null
}
