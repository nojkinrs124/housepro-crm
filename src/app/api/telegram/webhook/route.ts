import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { randomUUID } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiKey } from '@/lib/api-auth'
import { rateLimitMutation } from '@/lib/rate-limit'
import {
  sendMessage,
  sendChatAction,
  sendDocument,
  answerCallbackQuery,
  editMessageReplyMarkup,
  downloadTelegramFile,
  type TelegramUpdate,
} from '@/lib/telegram/api'
import {
  showMenuScreen,
  addAllowedUser,
  removeAllowedUser,
  setAddUserAwaiting,
  type MenuScreen,
} from '@/lib/telegram/menu'
import { advanceLeadStatus, advanceDealStatus, markPaymentPaid, markTaskDone } from '@/lib/telegram/crm-menu'
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
  setAwaitingIntent,
  setSchedulePaused,
  publishPost,
  rejectPost,
  createDraftRow,
  sendDraftForReview,
  regenerateImage,
  getLiveStatsText,
  applyManualEdit,
  getPendingReviewByMessageId,
  updatePostReactionCount,
  getRubrics,
  getRubricById,
  getRubricByKey,
  updateRubricPrompt,
  updateRubricImageStyle,
  toggleRubricActive,
  addRubric,
  addScheduleSlot,
  deleteScheduleSlot,
  toggleScheduleSlot,
  type ChannelRubric,
} from '@/lib/telegram/channel'
import { generateRubricDraft } from '@/lib/telegram/channel-generate'

// Node runtime (по умолчанию) — ОБЯЗАТЕЛЬНО, не ставить `export const runtime = 'edge'`.
// pizzip/docxtemplater — Node-only, в Edge runtime не заработают.
export const dynamic = 'force-dynamic'
// По умолчанию Vercel режет serverless-функцию на 15с — этого уже впритык хватало на
// генерацию изображений/DOCX, а market_research (веб-поиск через OpenRouter ":online",
// см. market-research.ts) может занимать 20-40с. Поднимаем потолок явно, а не полагаемся
// на дефолт, который на Hobby-плане конфигурируется максимум до 60с.
export const maxDuration = 60

const SYSTEM_PROMPT = `Ты — ассистент внутри Telegram-бота HousePro CRM (агентство недвижимости).
Отвечай кратко, по-деловому, на русском. У тебя есть инструменты для чтения и изменения данных CRM.
Суммы — в рублях. Если пользователь не указал дату — используй сегодняшнюю.

Для ВСЕХ мутирующих действий (add_transaction, update_deal_status, generate_contract, create_lead,
create_property, update_property_status, create_contact, update_contact, import_rental_contract,
create_task, complete_task)
НЕ считай, что действие уже выполнено — система сама покажет пользователю подтверждение и выполнит
действие только после его согласия.

Read-only инструменты list_tasks и list_overdue_payments — используй их для вопросов "что горит",
"какие задачи на сегодня/просрочены", "какие оплаты ждут/просрочены", не только для явного "покажи список".
get_finance_chart сам отправляет картинку в чат — после его вызова НЕ пересказывай цифры текстом ещё раз,
просто коротко подтверди (график виден в сообщении выше). market_research — для составных вопросов
с веб-поиском по рынку недвижимости (сравнить цены, узнать новости/правила) — не изобретай цифры сам,
если вопрос требует актуальных внешних данных, вызови этот инструмент.

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

У ЭТОГО ЖЕ бота есть ВТОРОЙ модуль — контент-ассистент Telegram-канала @housepro24 (посты, картинки
к ним, статистика, CTA-ссылки). Это НЕ CRM-функции, но ты про них знаешь и можешь ими пользоваться:
- create_channel_post(topic) — сгенерировать разовый пост для канала по теме (с иллюстрацией и веб-поиском
  при необходимости), отправить тебе на утверждение кнопками. Используй, когда просят "сделай пост про...",
  "напиши в канал про...", "выложи в группу/канал что-то про...".
- get_channel_stats() — подписчики канала, посты/клики за 7 дней, сколько черновиков ждёт утверждения.
Того, что НЕ умеет ни один инструмент бота: строить графики/диаграммы с числами (только иллюстративные
картинки без цифр — так безопаснее, реальные цифры не выдумываются картинкой), редактировать уже
опубликованные посты, публиковать в другие каналы/группы кроме @housepro24. Если просят именно это —
честно скажи, что не умеешь, а не придумывай похожий ответ.
Полное расписание рубрик (пн/ср/пт), кейсы из надиктовки, кнопочное меню — доступны только напрямую
через /menu, /case, /post в этом же чате (не через тебя как диалог) — если пользователь спрашивает,
как этим пользоваться, подскажи именно эти команды.

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
• Сколько заработали в этом месяце? (можно попросить графиком)
• Какие объекты сдаются?
• Найди клиента по телефону
• Какие задачи горят / какие оплаты просрочены?
• Сравни наши цены с рынком в этом районе (веб-поиск)

<b>Можно попросить сделать</b> (спрошу подтверждение):
• Добавь расход 5000 на бензин
• Переведи сделку в статус завершена
• Поставь задачу позвонить клиенту завтра
• Создай трёх лидов: ... (несколько сразу — одним подтверждением)
• Пришли договор аренды PDF/DOCX — сам заведу собственника, арендатора, объект и сделку, всё связав

Просто напиши или пришли файл.

<b>Меню</b>
• /menu — главное меню с разделами: CRM, Канал, Мультиагент, Настройки.

<b>Канал (контент-ассистент)</b>
• По расписанию сам присылаю черновики постов на утверждение (пн — аналитика, ср — кейс, пт — оффер).
• /case &lt;текст&gt; или голосовое — надиктуй кейс, оформлю в пост.
• /post &lt;тема&gt; — разовый пост вне расписания.
• /pause /resume — приостановить/включить автопостинг по расписанию (отпуск и т.п.).
• Ответь текстом на черновик — заменю текст твоим вариантом (без модели, картинка останется).`

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

async function sendMainMenu(chatId: number) {
  const orgId = await resolveBotOrgId()
  if (!orgId) return
  await showMenuScreen(chatId, orgId, 'root', HELP_TEXT)
}

const NAV_SCREENS: MenuScreen[] = ['root', 'crm', 'crm_leads', 'crm_deals', 'crm_payments', 'crm_tasks', 'channel', 'channel_posts', 'channel_schedule', 'channel_rubrics', 'multiagent', 'settings', 'settings_users', 'help']

// Навигация верхнеуровневого меню: nav:<screen> — просто перерисовывает "экран" в том же сообщении.
async function handleNavCallback(screen: string, chatId: number, orgId: string, messageId: number | undefined, telegramUserId: string) {
  const settings = await getChannelSettings(orgId)
  if (!isFromAdmin(settings, telegramUserId)) return
  if (!NAV_SCREENS.includes(screen as MenuScreen)) return
  // Навигация по меню = отказ от любого незавершённого текстового ввода (добавление слота,
  // правка промпта/картинки и т.п.) — иначе застрявший awaiting_intent потом глотает команды.
  if (settings?.awaiting_intent) await setAwaitingIntent(orgId, null)
  await showMenuScreen(chatId, orgId, screen as MenuScreen, HELP_TEXT, messageId)
}

// Действия внутри раздела "Настройки": set:pause / set:resume / set:adduser, а также deluser:<id>.
async function handleSettingsAction(action: string, arg: string | undefined, chatId: number, orgId: string, messageId: number | undefined, telegramUserId: string) {
  const settings = await getChannelSettings(orgId)
  if (!isFromAdmin(settings, telegramUserId)) return

  if (action === 'set' && arg === 'pause') {
    await setSchedulePaused(orgId, true)
    await showMenuScreen(chatId, orgId, 'settings', HELP_TEXT, messageId)
    return
  }
  if (action === 'set' && arg === 'resume') {
    await setSchedulePaused(orgId, false)
    await showMenuScreen(chatId, orgId, 'settings', HELP_TEXT, messageId)
    return
  }
  if (action === 'set' && arg === 'adduser') {
    await setAddUserAwaiting(orgId, true)
    await sendMessage(
      chatId,
      '➕ Перешли мне любое сообщение от нужного человека (чтобы я узнал его Telegram ID), ' +
        'или пришли его ID числом — при желании через пробел подпись, например:\n<code>395803926 Ольга, риелтор</code>'
    )
    return
  }
  if (action === 'deluser' && arg) {
    await removeAllowedUser(orgId, arg)
    await showMenuScreen(chatId, orgId, 'settings_users', HELP_TEXT, messageId)
    return
  }
}

// Обрабатывает текст, который бот ждёт после "➕ Добавить пользователя": пересланное
// сообщение (forward_from) или "<telegram_id> [подпись]" текстом. Возвращает true, если
// ввод был перехвачен под эту нужду (и не должен уходить в обычный CRM-диалог).
async function tryHandleAddUserInput(chatId: number, orgId: string, text: string, forwardFromId?: number, forwardFromName?: string): Promise<boolean> {
  const settings = await getChannelSettings(orgId)
  if (settings?.awaiting_intent !== 'add_bot_user') return false

  let telegramUserId: string | undefined
  let label: string | undefined

  if (forwardFromId) {
    telegramUserId = String(forwardFromId)
    label = forwardFromName
  } else {
    const match = text.trim().match(/^(\d+)\s*(.*)$/)
    if (match) {
      telegramUserId = match[1]
      label = match[2]?.trim() || undefined
    }
  }

  if (!telegramUserId) {
    await sendMessage(chatId, '⚠️ Не распознал ID. Перешли сообщение от человека или пришли его числовой Telegram ID.')
    return true
  }

  const result = await addAllowedUser(orgId, telegramUserId, label)
  await setAddUserAwaiting(orgId, false)
  if (result.error) {
    await sendMessage(chatId, `⚠️ Не удалось добавить: ${result.error}`)
  } else {
    await sendMessage(chatId, `✅ Добавлено: ${label || telegramUserId} (${telegramUserId})`)
  }
  await showMenuScreen(chatId, orgId, 'settings_users', HELP_TEXT)
  return true
}

// Раздел "🤖 Мультиагент" — MVP делегированного исследования (см. src/lib/telegram/market-research.ts).
async function handleMultiagentAction(action: string, chatId: number, orgId: string, telegramUserId: string) {
  const settings = await getChannelSettings(orgId)
  if (!isFromAdmin(settings, telegramUserId)) return

  if (action === 'research') {
    await setAwaitingIntent(orgId, 'market_research')
    await sendMessage(chatId, '🔎 Опиши одним сообщением, что исследовать (можно с веб-поиском по рынку недвижимости).')
  }
}

async function handleMarketResearchInput(chatId: number, orgId: string, topic: string) {
  await sendChatAction(chatId, 'typing')
  try {
    const { runMarketResearch } = await import('@/lib/telegram/market-research')
    const text = await runMarketResearch(topic)
    await sendMessage(chatId, text)
  } catch (e) {
    await sendMessage(chatId, `⚠️ Не удалось выполнить исследование: ${e instanceof Error ? e.message : 'ошибка'}`)
  } finally {
    await setAwaitingIntent(orgId, null)
  }
}

const DAY_ALIASES: Record<string, string> = {
  пн: 'mon', вт: 'tue', ср: 'wed', чт: 'thu', пт: 'fri', сб: 'sat', вс: 'sun',
  mon: 'mon', tue: 'tue', wed: 'wed', thu: 'thu', fri: 'fri', sat: 'sat', sun: 'sun',
}

// Действия в разделе "⏰ Расписание": toggle/delete слота, + запрос на добавление нового.
async function handleScheduleAction(action: string, arg: string, chatId: number, orgId: string, messageId: number | undefined, telegramUserId: string) {
  const settings = await getChannelSettings(orgId)
  if (!isFromAdmin(settings, telegramUserId)) return

  if (action === 'chschedtoggle') {
    // текущее состояние неизвестно без чтения — просто читаем список заново после переключения,
    // проще прочитать текущий enabled прямо тут не нужно: toggle делает инверсию на уровне запроса.
    const { getScheduleWithRubrics } = await import('@/lib/telegram/channel')
    const slots = await getScheduleWithRubrics(orgId)
    const slot = slots.find((s) => s.id === arg)
    if (slot) await toggleScheduleSlot(arg, !slot.enabled)
    await showMenuScreen(chatId, orgId, 'channel_schedule', HELP_TEXT, messageId)
    return
  }
  if (action === 'chscheddel') {
    await deleteScheduleSlot(arg)
    await showMenuScreen(chatId, orgId, 'channel_schedule', HELP_TEXT, messageId)
    return
  }
  if (action === 'chschedadd') {
    await setAwaitingIntent(orgId, 'add_slot')
    const rubrics = await getRubrics(orgId)
    const rubricKeys = rubrics.map((r) => r.key).join(', ')
    await sendMessage(
      chatId,
      '➕ Пришли одной строкой: день, время (ЧЧ:ММ) и рубрику.\n' +
        `Дни: пн вт ср чт пт сб вс. Рубрики: ${rubricKeys}.\n` +
        'Например: <code>пн 08:00 cta</code>'
    )
    return
  }
}

// Действия в разделе "✍️ Рубрики": показать/начать правку промпта, вкл/выкл рубрику.
async function handleRubricAction(action: string, rubricId: string, chatId: number, orgId: string, messageId: number | undefined, telegramUserId: string) {
  const settings = await getChannelSettings(orgId)
  if (!isFromAdmin(settings, telegramUserId)) return

  if (action === 'chrubtoggle') {
    const rubric = await getRubricById(rubricId)
    if (rubric) await toggleRubricActive(rubricId, !rubric.active)
    await showMenuScreen(chatId, orgId, 'channel_rubrics', HELP_TEXT, messageId)
    return
  }
  if (action === 'chrubedit') {
    const rubric = await getRubricById(rubricId)
    if (!rubric) return
    await setAwaitingIntent(orgId, `edit_rubric:${rubricId}`)
    await sendMessage(
      chatId,
      `<b>${rubric.label}</b>\n\nТекущий промпт:\n<i>${rubric.prompt_template}</i>\n\n` +
        '✏️ Ответь на это сообщение новым текстом промпта, чтобы заменить его.'
    )
    return
  }
  if (action === 'chrubimg') {
    const rubric = await getRubricById(rubricId)
    if (!rubric) return
    await setAwaitingIntent(orgId, `edit_rubric_image:${rubricId}`)
    await sendMessage(
      chatId,
      `<b>${rubric.label}</b> — стиль картинки\n\n` +
        `Сейчас: <i>${rubric.image_style_override ?? 'не задан (общий фотореалистичный стиль)'}</i>\n\n` +
        '🖼 Ответь на это сообщение текстом стиля (например «в тёплых тонах, минимализм») или пришли «-», чтобы сбросить.'
    )
    return
  }
  if (action === 'chrubadd') {
    await setAwaitingIntent(orgId, 'add_rubric')
    await sendMessage(
      chatId,
      '➕ Пришли одной строкой: key | Название | текст промпта.\n' +
        'Например: <code>listing | 🏠 Объект дня | Расскажи об одном актуальном объекте из базы.</code>'
    )
    return
  }
}

// Перехватывает текст, если бот ждёт добавление слота ('add_slot') или новый промпт
// рубрики ('edit_rubric:<id>') — awaiting_intent выставляется в handleScheduleAction/
// handleRubricAction выше. Возвращает true, если ввод был перехвачен.
async function tryHandleScheduleOrRubricInput(chatId: number, orgId: string, text: string): Promise<boolean> {
  // Команды (/menu, /pause, /case и т.п.) не должны глотаться "застрявшим" awaiting_intent —
  // иначе после незавершённого добавления слота/правки промпта бот перестаёт реагировать
  // на команды, пока их случайно не распознает как невалидный ввод формы.
  if (text.startsWith('/')) return false

  const settings = await getChannelSettings(orgId)
  const intent = settings?.awaiting_intent
  if (!intent) return false

  if (intent === 'add_slot') {
    const match = text.trim().toLowerCase().match(/^(\S+)\s+(\d{1,2}:\d{2})\s+(\S+)$/)
    if (!match) {
      await sendMessage(chatId, '⚠️ Не разобрал формат. Пример: <code>пн 08:00 cta</code>')
      return true
    }
    const [, dayRaw, time, rubricKey] = match
    const dayKey = DAY_ALIASES[dayRaw]
    if (!dayKey) {
      await sendMessage(chatId, '⚠️ Не узнал день. Используй: пн вт ср чт пт сб вс.')
      return true
    }
    const rubrics = await getRubrics(orgId)
    const rubric = rubrics.find((r) => r.key === rubricKey)
    if (!rubric) {
      await sendMessage(chatId, `⚠️ Не знаю рубрику «${rubricKey}». Доступные: ${rubrics.map((r) => r.key).join(', ')}`)
      return true
    }
    const result = await addScheduleSlot(orgId, rubric.id, dayKey, time.padStart(5, '0'))
    await setAwaitingIntent(orgId, null)
    if (result.error) {
      await sendMessage(chatId, `⚠️ Не удалось добавить слот: ${result.error}`)
    } else {
      await sendMessage(chatId, `✅ Слот добавлен: ${dayRaw} ${time} — ${rubric.label}`)
    }
    await showMenuScreen(chatId, orgId, 'channel_schedule', HELP_TEXT)
    return true
  }

  if (intent === 'add_rubric') {
    const parts = text.split('|').map((p) => p.trim())
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
      await sendMessage(chatId, '⚠️ Формат: <code>key | Название | текст промпта</code>')
      return true
    }
    const [key, label, prompt] = parts
    if (!/^[a-z0-9_]+$/.test(key)) {
      await sendMessage(chatId, '⚠️ key — латиницей в нижнем регистре, без пробелов (например: listing).')
      return true
    }
    const result = await addRubric(orgId, key, label, prompt)
    await setAwaitingIntent(orgId, null)
    if (result.error) {
      await sendMessage(chatId, `⚠️ Не удалось добавить рубрику: ${result.error}`)
    } else {
      await sendMessage(chatId, `✅ Рубрика «${label}» добавлена.`)
    }
    await showMenuScreen(chatId, orgId, 'channel_rubrics', HELP_TEXT)
    return true
  }

  if (intent.startsWith('edit_rubric:')) {
    const rubricId = intent.slice('edit_rubric:'.length)
    const result = await updateRubricPrompt(rubricId, text.trim())
    await setAwaitingIntent(orgId, null)
    if (result.error) {
      await sendMessage(chatId, `⚠️ Не удалось сохранить промпт: ${result.error}`)
    } else {
      await sendMessage(chatId, '✅ Промпт рубрики обновлён.')
    }
    await showMenuScreen(chatId, orgId, 'channel_rubrics', HELP_TEXT)
    return true
  }

  if (intent.startsWith('edit_rubric_image:')) {
    const rubricId = intent.slice('edit_rubric_image:'.length)
    const trimmed = text.trim()
    const value = trimmed === '-' || trimmed === '' ? null : trimmed
    const result = await updateRubricImageStyle(rubricId, value)
    await setAwaitingIntent(orgId, null)
    if (result.error) {
      await sendMessage(chatId, `⚠️ Не удалось сохранить стиль картинки: ${result.error}`)
    } else {
      await sendMessage(chatId, value ? '✅ Стиль картинки для рубрики обновлён.' : '✅ Стиль картинки сброшен на общий.')
    }
    await showMenuScreen(chatId, orgId, 'channel_rubrics', HELP_TEXT)
    return true
  }

  if (intent === 'market_research') {
    await handleMarketResearchInput(chatId, orgId, text)
    return true
  }

  // Кастомные requires_input-рубрики (не 'case'/'post', у которых свой отдельный флоу выше
  // по файлу) — единая точка входа для генерации по тексту от админа, независимо от того,
  // сколько таких рубрик заведено через "➕ Новая рубрика".
  if (intent.startsWith('input_rubric:')) {
    const rubricId = intent.slice('input_rubric:'.length)
    await setAwaitingIntent(orgId, null)
    const rubric = await getRubricById(rubricId)
    if (!rubric) {
      await sendMessage(chatId, '⚠️ Рубрика не найдена (возможно, удалена).')
      return true
    }
    await sendChatAction(chatId, 'typing')
    const settings2 = await getChannelSettings(orgId)
    try {
      const draftText = await generateRubricDraft(settings2, rubric, text)
      const postId = await createDraftRow(orgId, rubric.key as ChannelRubric, null, { rubricId: rubric.id })
      await getSupabaseAdmin().from('channel_posts').update({ source_input: text }).eq('id', postId)
      await sendDraftForReview(orgId, postId, rubric.key as ChannelRubric, draftText, 'dm_admin')
    } catch (e) {
      await sendMessage(chatId, `⚠️ Не удалось сгенерировать черновик: ${e instanceof Error ? e.message : 'ошибка'}`)
    }
    return true
  }

  return false
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
      const rubric = await getRubricByKey(post.organization_id, post.rubric)
      if (!rubric) throw new Error(`рубрика «${post.rubric}» не найдена в БД`)
      let newText: string
      if (post.rubric === 'case') {
        newText = await generateRubricDraft(settings, rubric, post.source_input ?? '')
      } else if (rubric.requires_input) {
        // Для рубрик без сохранённой вводной (например adhoc — тема нигде не хранится на
        // посте) перегенерация не может восстановить исходную тему. Разумный дефолт —
        // рубрика CTA, как и было в старой хардкод-версии этой кнопки.
        const ctaRubric = await getRubricByKey(post.organization_id, 'cta')
        newText = await generateRubricDraft(settings, ctaRubric ?? rubric)
      } else {
        newText = await generateRubricDraft(settings, rubric)
      }
      const newPostId = await createDraftRow(post.organization_id, post.rubric, post.scheduled_for, { rubricId: rubric.id })
      const ctaType = post.rubric === 'adhoc' ? 'none' : 'dm_admin'
      await sendDraftForReview(post.organization_id, newPostId, post.rubric, newText, ctaType)
    } catch (e) {
      await sendMessage(chatId, `⚠️ Не удалось перегенерировать: ${e instanceof Error ? e.message : 'ошибка'}`)
    }
    return
  }

  if (action === 'chregenimg') {
    const result = await regenerateImage(postId)
    if (result.error) await sendMessage(chatId, `⚠️ Не удалось перегенерировать картинку: ${result.error}`)
    return
  }

  if (action === 'chpub') {
    const result = await publishPost(postId)
    await sendMessage(chatId, result.error ? `⚠️ Не удалось опубликовать: ${result.error}` : '✅ Опубликовано в канале.')
  }
}

// Быстрые действия внутри списков CRM (лиды/сделки/оплаты/задачи): выполняет мутацию
// и перерисовывает тот же экран-список, откуда пришло нажатие.
const CRM_ACTION_SCREEN: Record<string, MenuScreen> = {
  leadnext: 'crm_leads',
  dealnext: 'crm_deals',
  paypaid: 'crm_payments',
  taskdone: 'crm_tasks',
}

async function handleCrmQuickAction(action: string, entityId: string, chatId: number, orgId: string, messageId: number | undefined, telegramUserId: string) {
  const settings = await getChannelSettings(orgId)
  if (!isFromAdmin(settings, telegramUserId)) return

  let result: { error?: string } = {}
  if (action === 'leadnext') result = await advanceLeadStatus(orgId, entityId)
  else if (action === 'dealnext') result = await advanceDealStatus(orgId, entityId)
  else if (action === 'paypaid') result = await markPaymentPaid(orgId, entityId)
  else if (action === 'taskdone') result = await markTaskDone(orgId, entityId)

  if (result.error) await sendMessage(chatId, `⚠️ Не получилось: ${result.error}`)
  await showMenuScreen(chatId, orgId, CRM_ACTION_SCREEN[action], HELP_TEXT, messageId)
}

async function handleChannelListAction(action: string, postId: string, chatId: number, orgId: string, messageId: number | undefined, telegramUserId: string) {
  const settings = await getChannelSettings(orgId)
  if (!isFromAdmin(settings, telegramUserId)) return

  if (action === 'chlistpub') {
    const result = await publishPost(postId)
    if (result.error) await sendMessage(chatId, `⚠️ Не удалось опубликовать: ${result.error}`)
  } else if (action === 'chlistreject') {
    await rejectPost(postId)
  }
  await showMenuScreen(chatId, orgId, 'channel_posts', HELP_TEXT, messageId)
}

async function handleCallbackQuery(update: NonNullable<TelegramUpdate['callback_query']>) {
  await answerCallbackQuery(update.id)

  const chatId = update.message?.chat.id
  const messageId = update.message?.message_id
  if (!chatId || !update.data) return

  const [action, batchId] = update.data.split(':')
  if (!batchId) return

  if (action === 'chmenu') {
    const orgId = await resolveBotOrgId()
    if (!orgId) return
    const settings = await getChannelSettings(orgId)
    if (!isFromAdmin(settings, String(chatId))) return

    if (batchId === 'post') {
      await setAwaitingIntent(orgId, 'post')
      await sendMessage(chatId, '📝 Напиши тему одним сообщением — подготовлю черновик поста.')
    } else if (batchId === 'case') {
      await setAwaitingIntent(orgId, 'case')
      await sendMessage(chatId, '🎙 Надиктуй голосом или напиши текстом: с чем пришёл клиент, в чём была сложность, как решили, результат.')
    } else if (batchId === 'stats') {
      await sendChatAction(chatId, 'typing')
      await sendMessage(chatId, await getLiveStatsText(orgId, settings!))
    }
    return
  }

  if (action === 'nav') {
    const orgId = await resolveBotOrgId()
    if (!orgId) return
    await handleNavCallback(batchId, chatId, orgId, messageId, String(chatId))
    return
  }

  if (action === 'set' || action === 'deluser') {
    const orgId = await resolveBotOrgId()
    if (!orgId) return
    await handleSettingsAction(action, batchId, chatId, orgId, messageId, String(chatId))
    return
  }

  if (action === 'leadnext' || action === 'dealnext' || action === 'paypaid' || action === 'taskdone') {
    const orgId = await resolveBotOrgId()
    if (!orgId) return
    await handleCrmQuickAction(action, batchId, chatId, orgId, messageId, String(chatId))
    return
  }

  if (action === 'chlistpub' || action === 'chlistreject') {
    const orgId = await resolveBotOrgId()
    if (!orgId) return
    await handleChannelListAction(action, batchId, chatId, orgId, messageId, String(chatId))
    return
  }

  if (action === 'chpub' || action === 'chregen' || action === 'chreject' || action === 'chregenimg') {
    await handleChannelCallback(action, batchId, chatId, messageId)
    return
  }

  if (action === 'chschedtoggle' || action === 'chscheddel' || action === 'chschedadd') {
    const orgId = await resolveBotOrgId()
    if (!orgId) return
    await handleScheduleAction(action, batchId, chatId, orgId, messageId, String(chatId))
    return
  }

  if (action === 'chrubedit' || action === 'chrubtoggle' || action === 'chrubadd' || action === 'chrubimg') {
    const orgId = await resolveBotOrgId()
    if (!orgId) return
    await handleRubricAction(action, batchId, chatId, orgId, messageId, String(chatId))
    return
  }

  if (action === 'magent') {
    const orgId = await resolveBotOrgId()
    if (!orgId) return
    await handleMultiagentAction(batchId, chatId, orgId, String(chatId))
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
    const rubric = await getRubricByKey(orgId, 'case')
    if (!rubric) throw new Error('рубрика «case» не найдена в БД')
    const text = await generateRubricDraft(settings, rubric, rawInput)
    const postId = await createDraftRow(orgId, 'case', null, { rubricId: rubric.id })
    await getSupabaseAdmin().from('channel_posts').update({ source_input: rawInput }).eq('id', postId)
    await sendDraftForReview(orgId, postId, 'case', text, 'dm_admin')
  } catch (e) {
    await sendMessage(chatId, `⚠️ Не удалось оформить кейс: ${e instanceof Error ? e.message : 'ошибка'}`)
  } finally {
    await setAwaitingIntent(orgId, null)
  }
}

async function handleAdhocPostCommand(chatId: number, orgId: string, topic: string) {
  await sendChatAction(chatId, 'typing')
  const settings = await getChannelSettings(orgId)
  try {
    const rubric = await getRubricByKey(orgId, 'adhoc')
    if (!rubric) throw new Error('рубрика «adhoc» не найдена в БД')
    const text = await generateRubricDraft(settings, rubric, topic)
    const postId = await createDraftRow(orgId, 'adhoc', null, { rubricId: rubric.id })
    await sendDraftForReview(orgId, postId, 'adhoc', text, 'none')
  } catch (e) {
    await sendMessage(chatId, `⚠️ Не удалось сгенерировать пост: ${e instanceof Error ? e.message : 'ошибка'}`)
  } finally {
    await setAwaitingIntent(orgId, null)
  }
}

// Возвращает true, если сообщение было перехвачено под нужды канала (правка/меню/кейс/пост)
// и НЕ должно попадать в обычный CRM-диалог с моделью.
async function tryHandleChannelInput(
  chatId: number,
  telegramUserId: string,
  text: string,
  replyToMessageId?: number
): Promise<boolean> {
  const orgId = await resolveBotOrgId()
  if (!orgId) return false
  const settings = await getChannelSettings(orgId)
  if (!isFromAdmin(settings, telegramUserId)) return false

  // Ответ (reply) на сообщение с черновиком — прямая правка текста без обращения к модели,
  // либо (если начинается с "фото:"/"картинка:") — перегенерация картинки с конкретными пожеланиями.
  if (replyToMessageId) {
    const pendingPost = await getPendingReviewByMessageId(replyToMessageId)
    if (pendingPost) {
      await editMessageReplyMarkup(chatId, replyToMessageId, null)
      const imageNoteMatch = text.match(/^(?:фото|картинка|изображение)\s*:\s*([\s\S]+)/i)
      if (imageNoteMatch) {
        await sendChatAction(chatId, 'upload_photo')
        const result = await regenerateImage(pendingPost.id, imageNoteMatch[1])
        if (result.error) await sendMessage(chatId, `⚠️ Не удалось перегенерировать картинку: ${result.error}`)
      } else {
        const result = await applyManualEdit(pendingPost.id, text)
        if (result.error) await sendMessage(chatId, `⚠️ Не удалось применить правку: ${result.error}`)
      }
      return true
    }
  }

  if (text === '/menu') {
    await setAwaitingIntent(orgId, null)
    await sendMainMenu(chatId)
    return true
  }

  if (text === '/pause') {
    await setSchedulePaused(orgId, true)
    await sendMessage(chatId, '⏸ Автопостинг по расписанию приостановлен. Черновики по пн/ср/пт присылать не буду, пока не скажешь /resume.')
    return true
  }

  if (text === '/resume') {
    await setSchedulePaused(orgId, false)
    await sendMessage(chatId, '▶️ Автопостинг по расписанию снова включён.')
    return true
  }

  if (text.startsWith('/case')) {
    const rawInput = text.replace('/case', '').trim()
    if (!rawInput) {
      await sendMessage(chatId, 'Опиши кейс текстом после команды или просто надиктуй голосовым — я жду.')
      await setAwaitingIntent(orgId, 'case')
      return true
    }
    await handleCaseInput(chatId, orgId, rawInput)
    return true
  }

  if (text.startsWith('/post')) {
    const topic = text.replace('/post', '').trim()
    if (!topic) {
      await sendMessage(chatId, 'Укажи тему: /post «тема поста»')
      await setAwaitingIntent(orgId, 'post')
      return true
    }
    await handleAdhocPostCommand(chatId, orgId, topic)
    return true
  }

  if (settings?.awaiting_intent === 'case') {
    await handleCaseInput(chatId, orgId, text)
    return true
  }
  if (settings?.awaiting_intent === 'post') {
    await handleAdhocPostCommand(chatId, orgId, text)
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
    if (update.message_reaction_count) {
      const totalCount = update.message_reaction_count.reactions.reduce((sum, r) => sum + r.total_count, 0)
      await updatePostReactionCount(update.message_reaction_count.message_id, totalCount)
    } else if (update.callback_query) {
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

      const orgIdForAddUser = await resolveBotOrgId()
      const forwardFrom = update.message.forward_from

      if (text === '/start' || text === '/help') {
        await sendMessage(chatId, HELP_TEXT)
        await sendMainMenu(chatId)
      } else if (
        orgIdForAddUser &&
        (await tryHandleAddUserInput(chatId, orgIdForAddUser, text, forwardFrom?.id, forwardFrom?.first_name || forwardFrom?.username))
      ) {
        // перехвачено — ID добавлен в allowlist
      } else if (orgIdForAddUser && (await tryHandleScheduleOrRubricInput(chatId, orgIdForAddUser, text))) {
        // перехвачено — добавлен слот расписания или обновлён промпт рубрики
      } else if (!(await tryHandleChannelInput(chatId, userId, text, update.message.reply_to_message?.message_id))) {
        await handleUserTurn(chatId, userId, username, text)
      }
    }
  } catch (e) {
    console.error('[telegram webhook] error:', e)
    Sentry.captureException(e)
    const chatId = update.message?.chat.id ?? update.callback_query?.message?.chat.id
    if (chatId) {
      await sendMessage(chatId, '⚠️ Произошла ошибка при обработке запроса. Попробуй ещё раз.').catch(() => {})
    }
  }

  return NextResponse.json({ ok: true })
}
