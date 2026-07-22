import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiKey } from '@/lib/api-auth'
import {
  sendMessage,
  sendChatAction,
  sendDocument,
  answerCallbackQuery,
  editMessageReplyMarkup,
  downloadTelegramFile,
  type TelegramUpdate,
} from '@/lib/telegram/api'
import { transcribeAudio } from '@/lib/telegram/stt'
import { extractTextFromDocx } from '@/lib/telegram/docx-reader'
import {
  TOOL_DEFINITIONS,
  MUTATING_TOOLS,
  dispatchReadOnlyTool,
  executeConfirmedMutation,
  describeMutation,
} from '@/lib/telegram/tools'
import {
  getChannelSettings,
  isFromAdmin,
  setAwaitingCase,
  publishPost,
  rejectPost,
  createDraftRow,
  sendDraftForReview,
} from '@/lib/telegram/channel'
import { generateCaseDraft, generateAnalyticsDraft, generateCtaDraft } from '@/lib/telegram/channel-generate'

// Node runtime (по умолчанию) — ОБЯЗАТЕЛЬНО, не ставить `export const runtime = 'edge'`.
// pizzip/docxtemplater — Node-only, в Edge runtime не заработают.
export const dynamic = 'force-dynamic'

const SYSTEM_PROMPT = `Ты — ассистент внутри Telegram-бота HousePro CRM (агентство недвижимости).
Отвечай кратко, по-деловому, на русском. У тебя есть инструменты для чтения и изменения данных CRM.
Суммы — в рублях. Если пользователь не указал дату — используй сегодняшнюю.

Для ВСЕХ мутирующих действий (add_transaction, update_deal_status, generate_contract, create_lead,
create_property, update_property_status, create_contact, update_contact, import_rental_contract)
НЕ считай, что действие уже выполнено — система сама покажет пользователю подтверждение и выполнит
действие только после его согласия.

Если не хватает данных для вызова инструмента (например, не найден deal_id или contact_id) —
сначала используй read-only инструмент (get_deals, get_client, list_properties), чтобы его найти,
и только потом предлагай мутацию. Если нашлось несколько похожих совпадений — уточни у пользователя,
какое имелось в виду, вместо того чтобы гадать.

ПАКЕТНЫЕ запросы: если пользователь просит несколько независимых действий за раз
("добавь трёх лидов: ...", "создай два объекта: ...") — вызови СООТВЕТСТВУЮЩИЙ инструмент
НЕСКОЛЬКО РАЗ за один ответ (несколько tool_calls в одном сообщении), не по одному за раз —
система сама соберёт их в одно общее подтверждение.

СВЯЗАННЫЕ сущности из одного документа: если нужно создать НЕСКОЛЬКО СВЯЗАННЫХ между собой
записей одновременно (например, из договора аренды — собственник + арендатор + объект + сделка,
где сделка должна ссылаться на только что созданных собственника и арендатора) — НЕ используй
create_contact/create_property по отдельности, потому что их ID заранее неизвестны и связь не
получится. Вместо этого используй import_rental_contract — он создаёт и связывает всё правильно
за один атомарный вызов. Если в документе не хватает каких-то полей — передай только то, что есть,
остальное можно дополнить позже через update_contact/update_property_status.

Пользователь может прислать фото, голосовое, PDF или DOCX документ:
- Фото чека/квитанции — определи сумму, дату, назначение, предложи add_transaction.
- PDF/DOCX (договор аренды, выписка ЕГРН и т.п.) — внимательно прочитай содержимое, определи,
  какие сущности там описаны (стороны договора, объект, условия), и предложи подходящее действие —
  чаще всего import_rental_contract, если документ описывает сделку между двумя сторонами по объекту.
  Если документ не про сделку (например, просто выписка ЕГРН на один объект без сторон) —
  предложи create_property и/или update_property_status по ситуации.
- Всегда явно проговаривай в подтверждении, что именно нашёл в документе, прежде чем создавать.

У тебя есть история последних сообщений в этом чате — используй её для контекста
(например, если пользователь пишет "а по нему" — посмотри, о ком речь, в предыдущих сообщениях).

Форматирование ответа (важно, Telegram, НЕ обычный markdown):
- Разрешены только HTML-теги: <b>жирный</b>, <i>курсив</i>, <code>код</code>. Заголовки через ###
  НЕ поддерживаются — вместо них используй <b>жирный текст</b> на отдельной строке.
- Никаких markdown-таблиц (| --- |) — Telegram их не рендерит. Для списков с несколькими полями
  используй такой вид, по одной записи на абзац:
  <b>Иванов, аренда 2к, Ленина 10</b>
  Статус: показы · Бюджет: 45 000 ₽/мес
- Списки — через "•" в начале строки, не через "-" или "*".
  Никогда не используй '<', '>', '&' в свободном тексте вне HTML-тегов (ломает разметку) —
  если нужно сравнение чисел, пиши словами ("больше", "меньше"), а амперсанд заменяй на "и".
- Не отвечай "простыней" на 15 строк, если пользователь спросил что-то простое — 2-4 строки.
  Для списков сделок/транзакций — не больше 5-7 записей в одном ответе, дальше предложи уточнить период/фильтр.`

const HELP_TEXT = `<b>HousePro CRM — бот-ассистент</b>

Пиши обычным текстом, голосом, присылай фото чеков или PDF/DOCX документы — понимаю без специальных команд.

<b>Можно спросить</b> (ответит сразу):
• Какие сделки в работе?
• Сколько заработали в этом месяце?
• Какие объекты сдаются?
• Найди клиента по телефону

<b>Можно попросить сделать</b> (спрошу подтверждение):
• Добавь расход 5000 на бензин
• Переведи сделку в статус завершена
• Создай трёх лидов: ... (несколько сразу — одним подтверждением)
• Пришли договор аренды PDF/DOCX — сам заведу собственника, арендатора, объект и сделку, всё связав

Просто напиши или пришли файл.

<b>Канал (контент-ассистент)</b>
• По расписанию сам присылаю черновики постов на утверждение (пн — аналитика, ср — кейс, пт — оффер).
• /case &lt;текст&gt; или голосовое — надиктуй кейс, оформлю в пост.
• /post &lt;тема&gt; — разовый пост вне расписания.`

// Сколько последних сообщений диалога храним и передаём модели (не считая system prompt).
const MAX_HISTORY_MESSAGES = 20

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

async function isUserAllowed(orgId: string, telegramUserId: string, username?: string): Promise<boolean> {
  const supabaseAdmin = getSupabaseAdmin()

  const { count } = await supabaseAdmin
    .from('bot_allowed_users')
    .select('telegram_user_id', { count: 'exact', head: true })
    .eq('organization_id', orgId)

  if (!count || count === 0) {
    await supabaseAdmin.from('bot_allowed_users').insert({
      telegram_user_id: telegramUserId,
      organization_id: orgId,
      label: username ? `@${username} (первый пользователь, авто)` : 'первый пользователь (авто)',
    })
    return true
  }

  const { data } = await supabaseAdmin
    .from('bot_allowed_users')
    .select('telegram_user_id')
    .eq('organization_id', orgId)
    .eq('telegram_user_id', telegramUserId)
    .maybeSingle()

  return !!data
}

type MessageContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
      | { type: 'file'; file: { filename: string; file_data: string } }
    >

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: MessageContent | null
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>
  tool_call_id?: string
}

async function loadConversation(chatId: string): Promise<OpenRouterMessage[]> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data } = await supabaseAdmin
    .from('bot_conversations')
    .select('messages')
    .eq('telegram_chat_id', chatId)
    .maybeSingle()
  return (data?.messages as OpenRouterMessage[] | undefined) ?? []
}

async function saveConversation(chatId: string, orgId: string, messages: OpenRouterMessage[]): Promise<void> {
  const trimmed = messages.slice(-MAX_HISTORY_MESSAGES)
  const supabaseAdmin = getSupabaseAdmin()
  await supabaseAdmin.from('bot_conversations').upsert({
    telegram_chat_id: chatId,
    organization_id: orgId,
    messages: trimmed,
    updated_at: new Date().toISOString(),
  })
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
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      tools: TOOL_DEFINITIONS,
      tool_choice: 'auto',
      // Разрешаем модели одновременно вызывать несколько tool_calls в одном ответе —
      // это то, что делает пакетные запросы ("добавь трёх лидов") возможными.
      parallel_tool_calls: true,
    }),
  })
  if (!res.ok) {
    throw new Error(`OpenRouter error ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

async function handleUserTurn(
  chatId: number,
  telegramUserId: string,
  username: string | undefined,
  content: MessageContent
) {
  const orgId = await resolveBotOrgId()
  if (!orgId) {
    await sendMessage(chatId, '⚠️ Бот не настроен: не найден рабочий API-ключ (HOUSEPRO_BOT_API_KEY).')
    return
  }

  const allowed = await isUserAllowed(orgId, telegramUserId, username)
  if (!allowed) {
    await sendMessage(chatId, '⛔ Этот аккаунт не имеет доступа к боту.')
    return
  }

  const chatIdStr = String(chatId)
  await sendChatAction(chatId, 'typing')
  const history = await loadConversation(chatIdStr)
  const messages: OpenRouterMessage[] = [...history, { role: 'user', content }]

  try {
    for (let round = 0; round < 4; round++) {
      if (round > 0) await sendChatAction(chatId, 'typing')
      const completion = await callOpenRouter(messages)
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
        const result = await dispatchReadOnlyTool(call.function.name, args)
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

async function handleChannelCallback(action: string, postId: string, chatId: number, messageId: number | undefined) {
  if (messageId) await editMessageReplyMarkup(chatId, messageId, null)

  if (action === 'chreject') {
    await rejectPost(postId)
    await sendMessage(chatId, '❌ Черновик отклонён.')
    return
  }

  if (action === 'chregen') {
    const supabaseAdmin = getSupabaseAdmin()
    const { data: post } = await supabaseAdmin.from('channel_posts').select('*').eq('id', postId).maybeSingle()
    if (!post) {
      await sendMessage(chatId, 'Черновик не найден (возможно, уже обработан).')
      return
    }
    const settings = await getChannelSettings(post.organization_id)
    try {
      const newText =
        post.rubric === 'analytics'
          ? await generateAnalyticsDraft(settings)
          : post.rubric === 'cta'
            ? await generateCtaDraft(settings)
            : post.rubric === 'case'
              ? await generateCaseDraft(settings, post.source_input ?? '')
              : await generateCtaDraft(settings, 'разовый пост по теме из истории переписки')
      const newPostId = await createDraftRow(post.organization_id, post.rubric, post.scheduled_for)
      const ctaType = post.rubric === 'cta' ? 'dm_admin' : post.rubric === 'adhoc' ? 'none' : 'bot_qualifier'
      await sendDraftForReview(post.organization_id, newPostId, post.rubric, newText, ctaType)
    } catch (e) {
      await sendMessage(chatId, `⚠️ Не удалось перегенерировать: ${e instanceof Error ? e.message : 'ошибка'}`)
    }
    return
  }

  if (action === 'chpub') {
    const result = await publishPost(postId)
    await sendMessage(chatId, result.error ? `⚠️ Не удалось опубликовать: ${result.error}` : '✅ Опубликовано в канале.')
  }
}

async function handleCallbackQuery(update: NonNullable<TelegramUpdate['callback_query']>) {
  await answerCallbackQuery(update.id)

  const chatId = update.message?.chat.id
  const messageId = update.message?.message_id
  if (!chatId || !update.data) return

  const [action, batchId] = update.data.split(':')
  if (!batchId) return

  if (action === 'chpub' || action === 'chregen' || action === 'chreject') {
    await handleChannelCallback(action, batchId, chatId, messageId)
    return
  }

  const supabaseAdmin = getSupabaseAdmin()
  const { data: batch } = await supabaseAdmin
    .from('bot_pending_actions')
    .select('*')
    .eq('batch_id', batchId)
    .order('created_at', { ascending: true })

  if (messageId) await editMessageReplyMarkup(chatId, messageId, null)

  const pendingRows = (batch ?? []).filter((r) => r.status === 'pending')
  if (pendingRows.length === 0) {
    await sendMessage(chatId, 'Это действие уже недоступно (истекло или уже обработано).')
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

  if (action === 'confirm') {
    if (pendingRows.some((r) => r.action_type === 'generate_contract')) {
      await sendChatAction(chatId, 'upload_document')
    }

    const results: string[] = []
    for (const row of pendingRows) {
      const result = await executeConfirmedMutation(row.action_type, row.payload)
      await supabaseAdmin.from('bot_pending_actions').update({ status: 'confirmed' }).eq('id', row.id)

      if (result?.error) {
        results.push(`⚠️ Не получилось (${row.action_type}): ${result.error}`)
      } else if (row.action_type === 'generate_contract' && result?.data?.docxUrl) {
        await sendDocument(chatId, result.data.docxUrl, row.summary_text)
        results.push(`✅ ${row.summary_text}`)
      } else {
        results.push(`✅ ${row.summary_text}`)
      }
    }

    await sendMessage(chatId, results.join('\n\n'))
  }
}

async function handleCaseInput(chatId: number, orgId: string, rawInput: string) {
  await sendChatAction(chatId, 'typing')
  const settings = await getChannelSettings(orgId)
  try {
    const text = await generateCaseDraft(settings, rawInput)
    const postId = await createDraftRow(orgId, 'case', null)
    await getSupabaseAdmin().from('channel_posts').update({ source_input: rawInput }).eq('id', postId)
    await sendDraftForReview(orgId, postId, 'case', text, 'bot_qualifier')
    await setAwaitingCase(orgId, false)
  } catch (e) {
    await sendMessage(chatId, `⚠️ Не удалось оформить кейс: ${e instanceof Error ? e.message : 'ошибка'}`)
  }
}

async function handleAdhocPostCommand(chatId: number, orgId: string, topic: string) {
  await sendChatAction(chatId, 'typing')
  const settings = await getChannelSettings(orgId)
  try {
    const { generateAdhocDraft } = await import('@/lib/telegram/channel-generate')
    const text = await generateAdhocDraft(settings, topic)
    const postId = await createDraftRow(orgId, 'adhoc', null)
    await sendDraftForReview(orgId, postId, 'adhoc', text, 'none')
  } catch (e) {
    await sendMessage(chatId, `⚠️ Не удалось сгенерировать пост: ${e instanceof Error ? e.message : 'ошибка'}`)
  }
}

// Возвращает true, если сообщение было перехвачено под нужды канала (кейс/разовый пост)
// и НЕ должно попадать в обычный CRM-диалог с моделью.
async function tryHandleChannelInput(chatId: number, telegramUserId: string, text: string): Promise<boolean> {
  const orgId = await resolveBotOrgId()
  if (!orgId) return false
  const settings = await getChannelSettings(orgId)
  if (!isFromAdmin(settings, telegramUserId)) return false

  if (text.startsWith('/case')) {
    const rawInput = text.replace('/case', '').trim()
    if (!rawInput) {
      await sendMessage(chatId, 'Опиши кейс текстом после команды или просто надиктуй голосовым — я жду.')
      await setAwaitingCase(orgId, true)
      return true
    }
    await handleCaseInput(chatId, orgId, rawInput)
    return true
  }

  if (text.startsWith('/post')) {
    const topic = text.replace('/post', '').trim()
    if (!topic) {
      await sendMessage(chatId, 'Укажи тему: /post <тема поста>')
      return true
    }
    await handleAdhocPostCommand(chatId, orgId, topic)
    return true
  }

  if (settings?.awaiting_case) {
    await handleCaseInput(chatId, orgId, text)
    return true
  }

  return false
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
    return NextResponse.json({ ok: true })
  }

  try {
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query)
    } else if (update.message?.voice) {
      const chatId = update.message.chat.id
      const userId = String(update.message.from?.id ?? chatId)
      const username = update.message.from?.username
      const { base64 } = await downloadTelegramFile(update.message.voice.file_id)
      const transcript = await transcribeAudio(base64, 'ogg')
      await sendMessage(chatId, `🎤 <i>${transcript}</i>`)
      if (!(await tryHandleChannelInput(chatId, userId, transcript))) {
        await handleUserTurn(chatId, userId, username, transcript)
      }
    } else if (update.message?.photo && update.message.photo.length > 0) {
      const chatId = update.message.chat.id
      const userId = String(update.message.from?.id ?? chatId)
      const username = update.message.from?.username
      const largestPhoto = update.message.photo[update.message.photo.length - 1]
      const { base64, mimeType } = await downloadTelegramFile(largestPhoto.file_id)
      const caption = update.message.caption?.trim()
      await handleUserTurn(chatId, userId, username, [
        {
          type: 'text',
          text:
            caption ||
            'На фото чек, квитанция или расписка. Определи сумму, дату и назначение платежа, ' +
              'предложи добавить как транзакцию (доход или расход — по смыслу).',
        },
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
      ])
    } else if (update.message?.document) {
      const chatId = update.message.chat.id
      const userId = String(update.message.from?.id ?? chatId)
      const username = update.message.from?.username
      const doc = update.message.document
      const fileName = doc.file_name ?? 'document'
      const caption = update.message.caption?.trim()
      const prompt =
        caption ||
        'Это документ (договор, выписка ЕГРН и т.п.). Внимательно прочитай и определи, какие ' +
          'сущности он описывает, предложи подходящее действие в CRM.'

      await sendChatAction(chatId, 'typing')

      if (doc.mime_type === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
        const { base64 } = await downloadTelegramFile(doc.file_id)
        await handleUserTurn(chatId, userId, username, [
          { type: 'text', text: prompt },
          { type: 'file', file: { filename: fileName, file_data: `data:application/pdf;base64,${base64}` } },
        ])
      } else if (fileName.toLowerCase().endsWith('.docx')) {
        const { base64 } = await downloadTelegramFile(doc.file_id)
        try {
          const text = extractTextFromDocx(Buffer.from(base64, 'base64'))
          await handleUserTurn(chatId, userId, username, `${prompt}\n\n--- Текст документа "${fileName}" ---\n${text}`)
        } catch (e) {
          await sendMessage(chatId, `⚠️ Не смог прочитать DOCX: ${e instanceof Error ? e.message : 'ошибка'}`)
        }
      } else {
        await sendMessage(chatId, '⚠️ Понимаю пока только PDF и DOCX документы.')
      }
    } else if (update.message?.text) {
      const chatId = update.message.chat.id
      const userId = String(update.message.from?.id ?? chatId)
      const username = update.message.from?.username
      const text = update.message.text.trim()

      if (text === '/start' || text === '/help') {
        await sendMessage(chatId, HELP_TEXT)
      } else if (!(await tryHandleChannelInput(chatId, userId, text))) {
        await handleUserTurn(chatId, userId, username, text)
      }
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
