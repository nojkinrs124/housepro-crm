import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiKey } from '@/lib/api-auth'
import {
  sendMessage,
  answerCallbackQuery,
  editMessageReplyMarkup,
  type TelegramUpdate,
} from '@/lib/telegram/api'
import {
  TOOL_DEFINITIONS,
  MUTATING_TOOLS,
  dispatchReadOnlyTool,
  executeConfirmedMutation,
  describeMutation,
} from '@/lib/telegram/tools'

// Node runtime (по умолчанию) — ОБЯЗАТЕЛЬНО, не ставить `export const runtime = 'edge'`.
// Дальше по проекту этот роут может подключать генерацию договоров (docxtemplater,
// Buffer) — это Node-only, в Edge runtime не заработает.
export const dynamic = 'force-dynamic'

const SYSTEM_PROMPT = `Ты — ассистент внутри Telegram-бота HousePro CRM (агентство недвижимости).
Отвечай кратко, по-деловому, на русском. У тебя есть инструменты для чтения и изменения данных CRM.
Суммы — в рублях. Если пользователь не указал дату — используй сегодняшнюю.
Для мутирующих действий (add_transaction, update_deal_status) НЕ считай, что действие уже выполнено —
система сама покажет пользователю подтверждение и выполнит действие только после его согласия.
Если не хватает данных для вызова инструмента (например, не найден deal_id) — сначала используй
read-only инструмент, чтобы его найти, и только потом предлагай мутацию.`

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { global: { fetch: (url, options = {}) => fetch(url, { ...options, cache: 'no-store' }) } }
  )
}

async function resolveBotOrgId(): Promise<string | null> {
  const key = process.env.HOUSEPRO_BOT_API_KEY
  if (!key) return null
  const fakeReq = new Request('http://internal.local/', { headers: { Authorization: `Bearer ${key}` } })
  const auth = await authenticateApiKey(fakeReq)
  return auth.orgId ?? null
}

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string | null
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>
  tool_call_id?: string
}

async function callOpenRouter(messages: OpenRouterMessage[]) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? 'anthropic/claude-sonnet-5',
      messages,
      tools: TOOL_DEFINITIONS,
      tool_choice: 'auto',
    }),
  })
  if (!res.ok) {
    throw new Error(`OpenRouter error ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

async function handleTextMessage(chatId: number, telegramUserId: string, text: string) {
  const orgId = await resolveBotOrgId()
  if (!orgId) {
    await sendMessage(chatId, '⚠️ Бот не настроен: не найден рабочий API-ключ (HOUSEPRO_BOT_API_KEY).')
    return
  }

  const messages: OpenRouterMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: text },
  ]

  // До 4 раундов tool-calling — этого достаточно для наших сценариев и защищает от зацикливания
  for (let round = 0; round < 4; round++) {
    const completion = await callOpenRouter(messages)
    const choice = completion.choices?.[0]
    const message: OpenRouterMessage | undefined = choice?.message

    if (!message) {
      await sendMessage(chatId, 'Не удалось получить ответ от модели, попробуй ещё раз.')
      return
    }

    if (!message.tool_calls || message.tool_calls.length === 0) {
      await sendMessage(chatId, message.content?.trim() || 'Готово.')
      return
    }

    messages.push(message)

    // Мутирующий tool call — перехватываем ПЕРВЫЙ такой вызов, заводим подтверждение и
    // останавливаем цикл (не даём модели считать действие выполненным).
    const mutatingCall = message.tool_calls.find((tc) =>
      (MUTATING_TOOLS as readonly string[]).includes(tc.function.name)
    )

    if (mutatingCall) {
      let args: Record<string, unknown> = {}
      try {
        args = JSON.parse(mutatingCall.function.arguments)
      } catch {
        await sendMessage(chatId, 'Не смог разобрать параметры действия, попробуй переформулировать.')
        return
      }

      const summary = describeMutation(mutatingCall.function.name, args)
      const supabaseAdmin = getSupabaseAdmin()
      const { data: pending, error } = await supabaseAdmin
        .from('bot_pending_actions')
        .insert({
          organization_id: orgId,
          telegram_chat_id: String(chatId),
          telegram_user_id: telegramUserId,
          action_type: mutatingCall.function.name,
          payload: args,
          summary_text: summary,
        })
        .select('id')
        .single()

      if (error || !pending) {
        await sendMessage(chatId, '⚠️ Не смог сохранить действие для подтверждения. Попробуй ещё раз.')
        return
      }

      await sendMessage(chatId, `Подтверди действие:\n\n${summary}`, {
        inlineKeyboard: [
          [
            { text: '✅ Подтвердить', callback_data: `confirm:${pending.id}` },
            { text: '❌ Отменить', callback_data: `cancel:${pending.id}` },
          ],
        ],
      })
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
      const result = await dispatchReadOnlyTool(call.function.name, args)
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) })
    }
  }

  await sendMessage(chatId, 'Слишком много шагов для одного запроса — попробуй сформулировать проще.')
}

async function handleCallbackQuery(update: NonNullable<TelegramUpdate['callback_query']>) {
  await answerCallbackQuery(update.id)

  const chatId = update.message?.chat.id
  const messageId = update.message?.message_id
  if (!chatId || !update.data) return

  const [action, pendingId] = update.data.split(':')
  if (!pendingId) return

  const supabaseAdmin = getSupabaseAdmin()
  const { data: pending } = await supabaseAdmin
    .from('bot_pending_actions')
    .select('*')
    .eq('id', pendingId)
    .maybeSingle()

  if (messageId) await editMessageReplyMarkup(chatId, messageId, null)

  if (!pending || pending.status !== 'pending') {
    await sendMessage(chatId, 'Это действие уже недоступно (истекло или уже обработано).')
    return
  }
  if (new Date(pending.expires_at) < new Date()) {
    await supabaseAdmin.from('bot_pending_actions').update({ status: 'expired' }).eq('id', pendingId)
    await sendMessage(chatId, '⏱ Время подтверждения истекло, попробуй ещё раз.')
    return
  }

  if (action === 'cancel') {
    await supabaseAdmin.from('bot_pending_actions').update({ status: 'cancelled' }).eq('id', pendingId)
    await sendMessage(chatId, '❌ Отменено.')
    return
  }

  if (action === 'confirm') {
    const result = await executeConfirmedMutation(pending.action_type, pending.payload)
    await supabaseAdmin.from('bot_pending_actions').update({ status: 'confirmed' }).eq('id', pendingId)

    if (result?.error) {
      await sendMessage(chatId, `⚠️ Не получилось выполнить: ${result.error}`)
    } else {
      await sendMessage(chatId, `✅ Выполнено:\n\n${pending.summary_text}`)
    }
  }
}

export async function POST(request: Request) {
  const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token')
  if (!process.env.TELEGRAM_BOT_SECRET || secret !== process.env.TELEGRAM_BOT_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let update: TelegramUpdate
  try {
    update = await request.json()
  } catch {
    return NextResponse.json({ ok: true }) // молча игнорируем мусор, Telegram не должен ретраить
  }

  // Отвечаем Telegram сразу после обработки — синхронно в рамках одного вызова функции,
  // но не держим соединение открытым дольше необходимого: вся работа ниже — awaited,
  // без отложенных фоновых задач, чтобы не потерять результат при обрыве функции.
  try {
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query)
    } else if (update.message?.text) {
      const chatId = update.message.chat.id
      const userId = String(update.message.from?.id ?? chatId)
      await handleTextMessage(chatId, userId, update.message.text)
    }
  } catch (e) {
    console.error('[telegram webhook] error:', e)
    const chatId = update.message?.chat.id ?? update.callback_query?.message?.chat.id
    if (chatId) {
      await sendMessage(chatId, '⚠️ Произошла ошибка при обработке запроса. Попробуй ещё раз.').catch(() => {})
    }
  }

  return NextResponse.json({ ok: true })
}
