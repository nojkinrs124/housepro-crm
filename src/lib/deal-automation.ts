import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import {
  STAGE_CANCELLED,
  stageForMilestone,
  stageIndex,
  terminalStageOf,
  type Milestone,
} from '@/features/directions/config/directions'

/**
 * Двигает сделку по вехе — но только вперёд и только если она ещё не закрыта.
 *
 * Автоматизации оперируют вехами («подписан договор», «прошла оплата»,
 * «сделка закрыта»), а не кодами стадий: у каждого из четырёх направлений своя
 * воронка, и стадия «Договор» в них называется по-разному — `agency_contract`
 * в аренде, `mgmt_contract` в управлении, `search_contract` в подборе,
 * `main_contract` в продаже. Раньше здесь был один жёсткий список из шести
 * стадий, общий на всё.
 *
 * Никогда не откатывает сделку назад и не трогает то, что закрыто руками.
 */
export async function advanceDealStage(
  // Подходит и обычному серверному клиенту, и service-role: обоим схема одна.
  supabase: SupabaseClient<Database>,
  dealId: string,
  milestone: Milestone
): Promise<void> {
  const { data: deal } = await supabase
    .from('deals')
    .select('status, deal_type')
    .eq('id', dealId)
    .single()
  if (!deal) return

  const direction = deal.deal_type
  const current = deal.status

  // Терминальная стадия направления и отмена — дальше решает только человек.
  if (current === STAGE_CANCELLED.value || current === terminalStageOf(direction)) return

  const target = stageForMilestone(direction, milestone)
  if (!target) return

  const currentIndex = stageIndex(direction, current)
  const targetIndex = stageIndex(direction, target)
  if (targetIndex === -1 || targetIndex <= currentIndex) return

  await supabase.from('deals').update({ status: target }).eq('id', dealId)
}

export type { Milestone }
/** @deprecated Прежнее имя типа вехи. Оставлено, чтобы не переписывать импорты разом. */
export type DealStage = Milestone
