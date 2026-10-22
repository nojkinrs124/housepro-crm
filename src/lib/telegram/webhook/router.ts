// Диспетчер одного входящего Telegram-апдейта: идемпотентность, разбор типа
// апдейта (реакция/callback_query/message), обработка ошибок. route.ts — тонкая
// обёртка над этой функцией, читающая секрет и тело запроса.
// Вынесено из webhook/route.ts фазой 2 аудита без изменения поведения.

import * as Sentry from '@sentry/nextjs'
import { sendMessage, type TelegramUpdate } from '@/lib/telegram/api'
import { claimUpdate, markUpdateDone, markUpdateFailed } from '@/lib/telegram/webhook/idempotency'
import { handleChannelReactionUpdate } from '@/lib/telegram/webhook/handlers/channel-content'
import { handleCallbackQuery } from '@/lib/telegram/webhook/handlers/callback'
import { handleMessage } from '@/lib/telegram/webhook/handlers/message'

export type RouteResult = { ok: true; duplicate?: true }

/**
 * Обрабатывает один TelegramUpdate целиком: идемпотентность → роутинг по типу →
 * обработка ошибок → финальная отметка claimed-строки.
 *
 * Идемпотентность реализована как claimed→done/failed, а не вечная метка
 * «обработано»: до 22.10.2026 строка вставлялась как «обработано» ДО работы —
 * воркер, убитый по maxDuration без доступа к finally, навечно запирал
 * update_id, повторная доставка получала duplicate:true, и ответ пользователю
 * не приходил никогда (аудит P0-7).
 */
export async function routeTelegramUpdate(update: TelegramUpdate): Promise<RouteResult> {
  let updateHandled = false
  if (typeof update.update_id === 'number') {
    const claim = await claimUpdate(update.update_id)
    if (claim === 'duplicate') return { ok: true, duplicate: true }
    updateHandled = true
  }

  try {
    // Реакции на посты приходят без автора-собеседника — это просто счётчик,
    // ничего не читает и не пишет в CRM.
    if (await handleChannelReactionUpdate(update)) {
      return { ok: true }
    }

    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query)
      return { ok: true }
    }

    const message = update.message
    if (!message) return { ok: true }

    await handleMessage(message)
  } catch (e) {
    console.error('[telegram webhook] error:', e)
    Sentry.captureException(e)
    const chatId = update.message?.chat.id ?? update.callback_query?.message?.chat.id
    if (chatId) {
      await sendMessage(chatId, '⚠️ Произошла ошибка при обработке запроса. Попробуй ещё раз.').catch(() => {})
    }
    if (updateHandled && typeof update.update_id === 'number') {
      await markUpdateFailed(update.update_id)
    }
    return { ok: true }
  } finally {
    // Все пути try (включая ранние return внутри handleMessage) доходят сюда —
    // finally гарантирует отметку 'done', даже когда внутри несколько `return`.
    if (updateHandled && typeof update.update_id === 'number') {
      await markUpdateDone(update.update_id)
    }
  }

  return { ok: true }
}
