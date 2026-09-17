import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { checklistFor } from '@/features/directions/config/stage-checklists'

type Client = SupabaseClient<Database>

/**
 * Автоотметка пунктов чек-листа по факту в данных.
 *
 * Показ проведён, объявление опубликовано, фото загружены — система это
 * знает, и просить риелтора ставить галочку «Проведён хотя бы один показ»
 * руками — лишний шаг (сквозной проход 17.09.2026, RA-6/MG-6/TS-5).
 * Пункт отмечается только там, где он описан в чек-листе направления;
 * снятие отметок автоматика не делает — это решение человека.
 *
 * Файл без 'use server': вызывается из экшенов, а не с клиента.
 */
export async function markChecklistItems(
  supabase: Client,
  dealId: string,
  marks: Array<{ stage: string; item: string }>,
): Promise<void> {
  const { data: deal } = await supabase
    .from('deals')
    .select('deal_type, stage_progress')
    .eq('id', dealId)
    .maybeSingle()
  if (!deal) return

  const progress = { ...((deal.stage_progress ?? {}) as Record<string, string[]>) }
  let changed = false
  for (const { stage, item } of marks) {
    if (!checklistFor(deal.deal_type, stage).some(i => i.code === item)) continue
    const current = new Set(progress[stage] ?? [])
    if (current.has(item)) continue
    current.add(item)
    progress[stage] = [...current]
    changed = true
  }
  if (!changed) return

  await supabase.from('deals').update({ stage_progress: progress }).eq('id', dealId)
}

/** Активные сделки по объекту — для отметок, которые приходят с карточки объекта. */
export async function activeDealIdsForProperty(supabase: Client, propertyId: string): Promise<string[]> {
  const { data } = await supabase
    .from('deals')
    .select('id')
    .eq('property_id', propertyId)
    .not('status', 'in', '(completed,in_service,cancelled)')
  return (data ?? []).map(d => d.id)
}
