'use server'

import { revalidatePath } from 'next/cache'
import { getSessionContext } from '@/lib/org'
import { requirePermission } from '@/lib/permissions'
import { checklistFor } from '@/features/directions/config/stage-checklists'
import { isStageOf } from '@/features/directions/config/directions'

/**
 * Отметка пункта чек-листа стадии.
 *
 * Хранится в `deals.stage_progress`: код стадии → список закрытых пунктов.
 * Ключом служит стадия, а не только пункт, потому что коды пунктов внутри
 * разных стадий совпадают («signed», «photos») и без стадии перемешались бы.
 */
export async function toggleChecklistItemAction(
  dealId: string,
  stage: string,
  item: string,
  done: boolean,
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionContext()
  if (!session.ok) return { error: session.error }
  const { supabase, user } = session

  const permError = await requirePermission(user.id, 'deals', 'update')
  if (permError) return permError

  const { data: deal } = await supabase
    .from('deals')
    .select('deal_type, stage_progress')
    .eq('id', dealId)
    .maybeSingle()
  if (!deal) return { error: 'Сделка не найдена' }

  if (!isStageOf(deal.deal_type, stage)) {
    return { error: `Стадия «${stage}» не применяется в этом направлении` }
  }
  if (!checklistFor(deal.deal_type, stage).some(i => i.code === item)) {
    return { error: `Пункт «${item}» не описан в чек-листе этой стадии` }
  }

  const progress = { ...((deal.stage_progress ?? {}) as Record<string, string[]>) }
  const current = new Set(progress[stage] ?? [])
  if (done) current.add(item)
  else current.delete(item)
  progress[stage] = [...current]

  const { error } = await supabase
    .from('deals')
    .update({ stage_progress: progress })
    .eq('id', dealId)

  if (error) return { error: error.message }

  revalidatePath(`/deals/${dealId}`)
  return { success: true }
}
