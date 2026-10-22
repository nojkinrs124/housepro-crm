// Основной цикл диалога с моделью: история → tool loop (до 4 раундов) → подтверждение
// мутаций батчем → ответ пользователю. Вынесено из webhook/route.ts фазой 2 аудита
// без изменения поведения.

import { randomUUID } from 'crypto'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { sendMessage, sendChatAction } from '@/lib/telegram/api'
import { rateLimitMutation } from '@/lib/rate-limit'
import { TOOL_DEFINITIONS, MUTATING_TOOLS, dispatchReadOnlyTool, describeMutation } from '@/lib/telegram/tools'
import { chatCompletion } from '@/lib/telegram/llm'
import type { BotActor } from '@/features/telegram/services/access'
import { systemPrompt } from './prompts'
import { loadConversation, saveConversation, type MessageContent, type OpenRouterMessage } from './history'

export async function handleUserTurn(actor: BotActor, content: MessageContent) {
  const { chatId, telegramUserId, orgId } = actor

  // Каждое обращение сюда — минимум один платный вызов OpenRouter (модель + tool loop до 4
  // раундов) — без лимита allowed-пользователь (или скомпрометированный аккаунт) может залить
  // счёт запросами. 20/мин с запасом на нормальный диалог, но режет спам/цикл ошибок.
  const rl = await rateLimitMutation(telegramUserId, 'bot_turn')
  if (!rl.success) {
    await sendMessage(chatId, '⏳ Слишком много сообщений подряд, подожди минуту и попробуй ещё раз.')
    return
  }

  const chatIdStr = String(chatId)
  await sendChatAction(chatId, 'typing')
  const history = await loadConversation(chatIdStr)
  const messages: OpenRouterMessage[] = [...history, { role: 'user', content }]

  try {
    for (let round = 0; round < 4; round++) {
      if (round > 0) await sendChatAction(chatId, 'typing')
      const completion = await chatCompletion({
        system: systemPrompt(actor.role),
        messages,
        tools: TOOL_DEFINITIONS,
        toolChoice: 'auto',
        // Несколько tool_calls в одном ответе — то, что делает пакетные запросы возможными.
        parallelToolCalls: true,
      })
      const choice = completion.choices?.[0]
      const message: OpenRouterMessage | undefined = choice?.message

      if (!message) {
        await sendMessage(chatId, 'Не удалось получить ответ от модели, попробуй ещё раз.')
        return
      }

      if (!message.tool_calls || message.tool_calls.length === 0) {
        messages.push(message)
        const replyText = typeof message.content === 'string' ? message.content.trim() : ''
        await sendMessage(chatId, replyText || 'Готово.')
        return
      }

      messages.push(message)

      // ВСЕ мутирующие tool_calls этого раунда — собираем в ОДИН батч с общим подтверждением,
      // а не только первый (иначе "сделай троих клиентов" реально создавало бы только одного,
      // молча пропуская остальных — это и была жалоба на "пишет что сделал, по факту нет").
      const mutatingCalls = message.tool_calls.filter((tc) =>
        (MUTATING_TOOLS as readonly string[]).includes(tc.function.name)
      )

      if (mutatingCalls.length > 0) {
        const batchId = randomUUID()
        const supabaseAdmin = getSupabaseAdmin()
        const summaries: string[] = []
        let parseFailed = false

        for (const call of mutatingCalls) {
          let args: Record<string, unknown> = {}
          try {
            args = JSON.parse(call.function.arguments)
          } catch {
            parseFailed = true
            continue
          }
          const summary = describeMutation(call.function.name, args)
          summaries.push(summary)
          await supabaseAdmin.from('bot_pending_actions').insert({
            organization_id: orgId,
            telegram_chat_id: chatIdStr,
            telegram_user_id: telegramUserId,
            action_type: call.function.name,
            payload: args,
            summary_text: summary,
            batch_id: batchId,
          })
        }

        if (summaries.length === 0) {
          await sendMessage(chatId, 'Не смог разобрать параметры действия, попробуй переформулировать.')
          return
        }

        const combinedSummary =
          summaries.length === 1
            ? summaries[0]
            : summaries.map((s, i) => `${i + 1}. ${s}`).join('\n\n')

        await sendMessage(
          chatId,
          `Подтверди ${summaries.length > 1 ? `действия (${summaries.length})` : 'действие'}:\n\n${combinedSummary}` +
            (parseFailed ? '\n\n⚠️ Часть действий не удалось разобрать и они пропущены.' : ''),
          {
            inlineKeyboard: [
              [
                { text: '✅ Подтвердить всё', callback_data: `confirm:${batchId}` },
                { text: '❌ Отменить', callback_data: `cancel:${batchId}` },
              ],
            ],
          }
        )
        return
      }

      // Все tool calls в этом раунде — read-only, выполняем и продолжаем диалог с моделью
      for (const call of message.tool_calls) {
        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(call.function.arguments)
        } catch {
          // оставляем args пустым — dispatchReadOnlyTool сам вернёт осмысленную ошибку/пустой результат
        }
        const result = await dispatchReadOnlyTool(call.function.name, args, { chatId })
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) })
      }
    }

    await sendMessage(chatId, 'Слишком много шагов для одного запроса — попробуй сформулировать проще.')
  } finally {
    await saveConversation(chatIdStr, orgId, messages).catch((e) =>
      console.error('[telegram webhook] saveConversation error:', e)
    )
  }
}
