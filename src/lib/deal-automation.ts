import type { SupabaseClient } from '@supabase/supabase-js'

// Порядок стадий воронки сделки — см. DealsKanban.tsx (те же 6 колонок).
const STAGE_ORDER = ['new', 'showing', 'negotiation', 'contract', 'payment', 'completed'] as const
export type DealStage = (typeof STAGE_ORDER)[number]

// Терминальные статусы — автоматизация их никогда не трогает: сделка либо уже
// доведена до конца, либо руками помечена отменённой, дальше решает только человек.
const TERMINAL_STATUSES = new Set<string>(['completed', 'cancelled'])

/**
 * Двигает сделку на указанную стадию воронки — но только вперёд и только если сделка
 * ещё не в терминальном статусе (завершена/отменена). Используется автоматизациями
 * (создание договора → «Договор», формирование DOCX → «Оплата», отметка платежа →
 * «Завершено»): никогда не откатывает сделку назад и не перезаписывает то, что уже
 * закрыто руками.
 */
export async function advanceDealStage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  dealId: string,
  targetStage: DealStage
): Promise<void> {
  const { data: deal } = await supabase.from('deals').select('status').eq('id', dealId).single()
  if (!deal) return

  const currentStatus = deal.status as string
  if (TERMINAL_STATUSES.has(currentStatus)) return

  const currentIndex = STAGE_ORDER.indexOf(currentStatus as DealStage)
  const targetIndex = STAGE_ORDER.indexOf(targetStage)
  if (targetIndex === -1 || targetIndex <= currentIndex) return

  await supabase.from('deals').update({ status: targetStage }).eq('id', dealId)
}
