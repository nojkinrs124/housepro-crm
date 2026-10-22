// Подтверждение/отмена батча мутирующих действий (кнопки confirm:<batchId> / cancel:<batchId>).
// Вынесено из webhook/route.ts фазой 2 аудита без изменения поведения.

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { sendMessage, sendChatAction, sendDocument, editMessageReplyMarkup } from '@/lib/telegram/api'
import { executeConfirmedMutation } from '@/lib/telegram/tools'
import type { BotActor } from '@/features/telegram/services/access'

export async function handleConfirmOrCancel(
  action: 'confirm' | 'cancel',
  batchId: string,
  actor: BotActor,
  messageId: number | undefined,
) {
  const { chatId } = actor
  const supabaseAdmin = getSupabaseAdmin()
  const { data: batch } = await supabaseAdmin
    .from('bot_pending_actions')
    .select('*')
    .eq('batch_id', batchId)
    .eq('organization_id', actor.orgId)
    .order('created_at', { ascending: true })

  if (messageId) await editMessageReplyMarkup(chatId, messageId, null)

  const pendingRows = (batch ?? []).filter((r) => r.status === 'pending')
  if (pendingRows.length === 0) {
    await sendMessage(chatId, 'Это действие уже недоступно (истекло или уже обработано).')
    return
  }

  // Подтверждает тот, кто запросил. Раньше батч искался по одному batch_id, а
  // сохранённые рядом telegram_user_id/chat_id не сверялись ни с кем — при том,
  // что подтверждение выполняет мутации в CRM.
  if (pendingRows.some((r) => r.telegram_user_id !== actor.telegramUserId)) {
    await sendMessage(chatId, '⛔ Это подтверждение запрашивал другой пользователь.')
    return
  }

  if (new Date(pendingRows[0].expires_at) < new Date()) {
    await supabaseAdmin.from('bot_pending_actions').update({ status: 'expired' }).eq('batch_id', batchId)
    await sendMessage(chatId, '⏱ Время подтверждения истекло, попробуй ещё раз.')
    return
  }

  if (action === 'cancel') {
    await supabaseAdmin.from('bot_pending_actions').update({ status: 'cancelled' }).eq('batch_id', batchId)
    await sendMessage(chatId, '❌ Отменено.')
    return
  }

  if (pendingRows.some((r) => r.action_type === 'generate_contract')) {
    await sendChatAction(chatId, 'upload_document')
  }

  // Атомарный захват батча ОДНИМ UPDATE по batch_id — раньше статус 'confirmed'
  // выставлялся отдельным update на каждую строку ПОСЛЕ её исполнения: двойное
  // нажатие «Подтвердить» (двойной тап или повтор доставки Telegram) успевало
  // прочитать тот же pendingRows ДО первой отметки и исполнить мутации дважды
  // (вторая сделка, второй расход). WHERE status='pending' — compare-and-set:
  // кто первый обновил строки, тот их и исполняет; остальным claimed.length === 0.
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from('bot_pending_actions')
    .update({ status: 'confirmed' })
    .eq('batch_id', batchId)
    .eq('status', 'pending')
    .select('*')

  if (claimError) {
    await sendMessage(chatId, '⚠️ Не удалось подтвердить действие, попробуй ещё раз.')
    return
  }
  if (!claimed || claimed.length === 0) {
    // Кто-то (другой тап, повтор апдейта) успел подтвердить раньше нас.
    return
  }

  const results: string[] = []
  for (const row of claimed.sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const result = await executeConfirmedMutation(row.action_type, row.payload)

    if (result?.error) {
      results.push(`⚠️ Не получилось (${row.action_type}): ${result.error}`)
    } else if (row.action_type === 'add_meter_readings' && result?.data) {
      // Расход и сумма считаются на сервере — показываем их, а не пересказ запроса.
      const d = result.data as { property: string; reading_date: string; saved: string[]; total_utilities: number; warnings: string[]; errors: string[] }
      results.push(
        `✅ Показания внесены: ${d.property} (${d.reading_date})\n` +
          d.saved.map(l => `• ${l}`).join('\n') +
          (d.total_utilities ? `\n<b>Коммуналка: ${d.total_utilities.toLocaleString('ru-RU')} ₽</b>` : '') +
          (d.errors.length ? `\n⚠️ ${d.errors.join('\n⚠️ ')}` : '') +
          (d.warnings.length ? `\nℹ️ ${d.warnings.join('\nℹ️ ')}` : ''),
      )
    } else if (row.action_type === 'generate_contract' && result?.data?.docxUrl) {
      await sendDocument(chatId, result.data.docxUrl, row.summary_text)
      results.push(`✅ ${row.summary_text}`)
    } else {
      results.push(`✅ ${row.summary_text}`)
    }
  }

  await sendMessage(chatId, results.join('\n\n'))
}
