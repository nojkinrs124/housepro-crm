import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import {
  STAGE_CANCELLED,
  stageForMilestone,
  stageIndex,
  terminalStageOf,
  type Milestone,
} from '@/features/directions/config/directions'
import { canMoveStage, collectDealFacts } from '@/features/directions/services/transitions'

/**
 * Двигает сделку по вехе — но только вперёд, только если она ещё не закрыта и
 * только если переход прошёл бы и руками.
 *
 * Автоматизации оперируют вехами («подписан договор», «прошла оплата»,
 * «сделка закрыта»), а не кодами стадий: у каждого из четырёх направлений своя
 * воронка, и стадия «Договор» в них называется по-разному — `agency_contract`
 * в аренде, `mgmt_contract` в управлении, `search_contract` в подборе,
 * `main_contract` в продаже.
 *
 * Переход проходит через те же `canMoveStage`/предусловия, что и ручной:
 * раньше черновик договора или сформированный DOCX перебрасывали сделку через
 * чек-листы и проверки данных (сквозной проход 17.09.2026, RA-9/MG-2/MG-6).
 * Если предусловия не выполнены — автоматизация молчит, человек двинет сам.
 *
 * Никогда не откатывает сделку назад и не трогает то, что закрыто руками.
 */
export async function advanceDealStage(
  // Подходит и обычному серверному клиенту, и service-role: обоим схема одна.
  supabase: SupabaseClient<Database>,
  dealId: string,
  milestone: Milestone
): Promise<void> {
  const facts = await collectDealFacts(supabase, dealId)
  if (!facts) return

  const direction = facts.deal_type
  const current = facts.status

  // Терминальная стадия направления и отмена — дальше решает только человек.
  if (current === STAGE_CANCELLED.value || current === terminalStageOf(direction)) return

  const target = stageForMilestone(direction, milestone)
  if (!target) return

  const currentIndex = stageIndex(direction, current)
  const targetIndex = stageIndex(direction, target)
  if (targetIndex === -1 || targetIndex <= currentIndex) return

  if (!canMoveStage(facts, target).allowed) return

  // Ошибку записи нельзя проглатывать молча (аудит 26.10.2026, P1-1): раньше
  // при сбое (RLS, ограничение, сетевая ошибка) сделка оставалась на прежней
  // стадии, а вызывающий код — подписание договора, оплата, завершение — не
  // узнавал об этом и сообщал пользователю об успехе. Автоматика остаётся
  // «мягкой» (не бросаем исключение, чтобы не ломать основной сценарий), но
  // провал больше не исчезает бесследно — он попадает в серверный лог.
  const { error } = await supabase.from('deals').update({ status: target }).eq('id', dealId)

  if (error) {
    console.error(
      '[deal-automation] не удалось продвинуть сделку',
      dealId, current, '→', target, error.code ?? '-', error.message ?? ''
    )
  }
}

export type { Milestone }
/** @deprecated Прежнее имя типа вехи. Оставлено, чтобы не переписывать импорты разом. */
export type DealStage = Milestone
