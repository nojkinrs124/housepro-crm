// Идемпотентность входящих апдейтов Telegram: update_id помечается claimed → done/failed,
// а не вечной меткой «обработано». До 22.10.2026 строка вставлялась как «обработано» ДО
// работы — воркер, убитый по maxDuration без доступа к finally, навечно запирал update_id,
// повторная доставка получала duplicate:true, и ответ пользователю не приходил никогда
// (аудит P0-7). Вынесено из webhook/route.ts фазой 2 аудита без изменения поведения.

import { getSupabaseAdmin } from '@/lib/supabase/admin'

// Reclaim-окно идемпотентности апдейтов: maxDuration = 60с, то есть ровно столько
// может протянуться воркер, которого Vercel убил без finally. Чуть больше запаса (90с),
// чтобы не перехватить тот же update у ещё живого воркера.
const UPDATE_CLAIM_TTL_MS = 90_000

export type ClaimStatus = 'claimed' | 'duplicate'

/**
 * Пытается захватить update_id под обработку.
 *
 * 'duplicate' — кто-то другой уже обрабатывает (или уже обработал) этот апдейт,
 * и срок захвата (claimed_at) не истёк. 'claimed' — можно обрабатывать: это
 * либо первый захват, либо reclaim чужого claimed/failed сверх TTL.
 */
export async function claimUpdate(updateId: number): Promise<ClaimStatus> {
  const supabaseAdmin = getSupabaseAdmin()
  const nowIso = new Date().toISOString()
  const { error: insertError } = await supabaseAdmin
    .from('bot_processed_updates')
    .insert({ update_id: updateId, status: 'claimed', claimed_at: nowIso })

  if (insertError) {
    if (insertError.code === '23505') {
      const reclaimBefore = new Date(Date.now() - UPDATE_CLAIM_TTL_MS).toISOString()
      const { data: reclaimed } = await supabaseAdmin
        .from('bot_processed_updates')
        .update({ status: 'claimed', claimed_at: nowIso })
        .eq('update_id', updateId)
        .or(`status.eq.failed,and(status.eq.claimed,claimed_at.lt.${reclaimBefore})`)
        .select('update_id')
        .maybeSingle()
      if (!reclaimed) return 'duplicate'
      // reclaimed: другой воркер либо упал (failed), либо завис дольше TTL — обрабатываем заново.
    } else {
      console.error('[telegram webhook] processed_updates insert:', insertError.message)
    }
  }

  // Хвост чистим здесь же, редко: раз в ~100 update, старше суток.
  if (updateId % 100 === 0) {
    await supabaseAdmin.from('bot_processed_updates').delete().lt('created_at', new Date(Date.now() - 86_400_000).toISOString())
  }

  return 'claimed'
}

/**
 * failed — не claimed: следующая доставка того же update_id от Telegram (или наш
 * собственный повтор) не ждёт TTL, а забирает его немедленно через reclaim в claimUpdate.
 */
export async function markUpdateFailed(updateId: number): Promise<void> {
  const { error } = await getSupabaseAdmin().from('bot_processed_updates').update({ status: 'failed' }).eq('update_id', updateId)
  if (error) console.error('[telegram webhook] processed_updates mark failed:', error.message)
}

/**
 * Все пути обработки (включая ранние return внутри роутинга по типу сообщения) должны
 * доходить до вызова этой функции — вызывающая сторона кладёт её в finally, чтобы
 * несколько `return` внутри обработки не пропустили отметку 'done'.
 */
export async function markUpdateDone(updateId: number): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from('bot_processed_updates')
    .update({ status: 'done' })
    .eq('update_id', updateId)
    .eq('status', 'claimed')
  if (error) console.error('[telegram webhook] processed_updates mark done:', error.message)
}
