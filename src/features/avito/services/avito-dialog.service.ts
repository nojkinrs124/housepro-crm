// Автоматический диалог LLM-бота с клиентом в чате мессенджера Авито.
//
// В отличие от Telegram-бота (src/lib/telegram/webhook/dialog/turn.ts), здесь
// нет подтверждения пользователем: бот сам ведёт диалог от имени агентства и
// сам назначает показ — так решил владелец (единственный агент, редкие
// конфликты расписания не критичны). Поэтому инструментов меньше и все —
// действия самого бота, без ветки MUTATING_TOOLS/bot_pending_actions.
//
// Каждый вызов — один круг диалога на одно новое сообщение клиента: история
// хранится в avito_conversations (аналог bot_conversations у Telegram, но
// индексирована по avito_chat_id).

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { chatCompletion, type LlmMessage } from '@/lib/telegram/llm'
import { localDateTimeToIso, formatDateTime } from '@/lib/timezone'
import { normalizePhone } from '@/lib/utils'
import { markChecklistItems } from '@/features/directions/services/checklist-sync'
import { notifyAvitoEscalation } from '@/lib/telegram/notify-lead'

const MAX_HISTORY_MESSAGES = 20
const MAX_ROUNDS = 4

export interface AvitoDialogContext {
  orgId: string
  avitoChatId: string
  leadId: string
  propertyId: string | null
}

const SYSTEM_PROMPT = `Ты — ассистент агентства недвижимости HousePro, отвечаешь клиенту в мессенджере Авито
от имени агентства. Пиши по-русски, кратко и по-деловому, как живой сотрудник, без приветствий
в каждом сообщении и без эмодзи сверх меры.

Твоя задача: ответить на вопросы про объект (если он известен — он передан в контексте), узнать,
актуален ли интерес, и договориться о показе. Если клиент называет телефон — текст ответа можно
не менять, система сама сохранит номер.

Когда клиент называет удобный день/время для показа (или соглашается на предложенный тобой
вариант) — вызови create_showing с этим временем. Не спрашивай подтверждения у человека из
агентства, созданный показ не нужно согласовывать — просто сообщи клиенту, что показ назначен,
и когда.

Если не можешь ответить по существу (вопрос про юридические детали, скидку, требует решения
человека) — вызови escalate_to_human и сообщи клиенту, что сотрудник подключится сам.

Если клиент явно не заинтересован («не актуально», «уже нашли», «не то») — вежливо попрощайся
без вызова инструментов.

Формат: только текст сообщения в Авито-чат, без markdown и HTML-тегов.`

interface AvitoToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'create_showing',
      description:
        'Назначить показ объекта клиенту на названное время. Вызывай сразу, как клиент называет ' +
        'удобные день и время (или соглашается на предложенный тобой вариант) — без подтверждения ' +
        'человеком, система создаёт показ сама.',
      parameters: {
        type: 'object',
        properties: {
          scheduled_at: {
            type: 'string',
            description: 'Дата и время показа в формате YYYY-MM-DDTHH:mm по местному времени агентства (Europe/Moscow)',
          },
        },
        required: ['scheduled_at'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'escalate_to_human',
      description: 'Передать диалог человеку — вопрос не по силам боту (юридические детали, скидка, спор).',
      parameters: {
        type: 'object',
        properties: { reason: { type: 'string', description: 'Короткая причина, видна только внутри CRM' } },
        required: ['reason'],
      },
    },
  },
] as const

/** Загружает историю диалога конкретного чата Авито. */
async function loadHistory(avitoChatId: string): Promise<LlmMessage[]> {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('avito_conversations')
    .select('messages')
    .eq('avito_chat_id', avitoChatId)
    .maybeSingle()
  return (data?.messages as LlmMessage[] | undefined) ?? []
}

async function saveHistory(avitoChatId: string, orgId: string, messages: LlmMessage[]): Promise<void> {
  const supabase = getSupabaseAdmin()
  await supabase.from('avito_conversations').upsert({
    avito_chat_id: avitoChatId,
    organization_id: orgId,
    messages: messages.slice(-MAX_HISTORY_MESSAGES),
    updated_at: new Date().toISOString(),
  })
}

/** Если в тексте клиента похож на телефон — сохраняет его в лид (как по звонкам). */
async function maybeSavePhoneFromText(leadId: string, text: string): Promise<void> {
  // Не любые 10-11-значные числа — сумма бюджета («30000») не телефон.
  // Берём только последовательности с характерными признаками номера: «+7»,
  // «8-9хх», скобки/дефисы между группами цифр.
  const candidate = text.match(/(?:\+7|8)[\s(-]?\d{3}[\s)-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/)
  if (!candidate) return
  const phone = normalizePhone(candidate[0])
  if (!phone) return

  const supabase = getSupabaseAdmin()
  await supabase.from('leads').update({ phone, updated_at: new Date().toISOString() }).eq('id', leadId)
}

/** Создаёт показ от имени бота — без подтверждения, сразу активный. */
async function createShowingFromBot(
  ctx: AvitoDialogContext,
  args: { scheduled_at?: string }
): Promise<{ ok: boolean; message: string }> {
  const scheduledAt = localDateTimeToIso(args.scheduled_at)
  if (!scheduledAt) {
    return { ok: false, message: 'Не удалось разобрать дату/время — уточни у клиента формат.' }
  }

  const supabase = getSupabaseAdmin()
  const { data: settings } = await supabase
    .from('avito_settings')
    .select('contact_phone')
    .eq('organization_id', ctx.orgId)
    .maybeSingle()

  const { data: admin } = await supabase
    .from('users')
    .select('id')
    .eq('organization_id', ctx.orgId)
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabase
    .from('showings')
    .insert({
      organization_id: ctx.orgId,
      scheduled_at: scheduledAt,
      agent_id: admin?.id ?? null,
      property_id: ctx.propertyId,
      lead_id: ctx.leadId,
      duration_min: 30,
      status: 'planned',
      feedback: 'Назначено автоматически ботом Авито-чата',
      created_by: admin?.id ?? null,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[avito-dialog] не удалось создать показ:', error)
    return { ok: false, message: 'Не получилось записать показ в систему — передай человеку.' }
  }

  // Показ по сделке закрывает чек-лист «назначены просмотры», как и ручное создание.
  const { data: activeDeal } = await supabase
    .from('deals')
    .select('id')
    .eq('organization_id', ctx.orgId)
    .eq('lead_id', ctx.leadId)
    .not('status', 'in', '("completed","cancelled")')
    .limit(1)
    .maybeSingle()
  if (activeDeal?.id) {
    await markChecklistItems(supabase, activeDeal.id, [{ stage: 'viewings', item: 'scheduled' }])
  }

  void settings
  return { ok: true, message: `Показ назначен на ${formatDateTime(scheduledAt)}. id=${data.id}` }
}

async function escalate(ctx: AvitoDialogContext, args: { reason?: string }): Promise<{ ok: true }> {
  const supabase = getSupabaseAdmin()
  const reason = args.reason ?? 'не указано'
  await supabase
    .from('leads')
    .update({ comment: `Бот передал диалог человеку: ${reason}`, updated_at: new Date().toISOString() })
    .eq('id', ctx.leadId)

  // Уведомление владельцу в Telegram — без него о передаче диалога узнать можно
  // было только зайдя в карточку лида (см. notify-lead.ts).
  const [{ data: lead }, { data: property }] = await Promise.all([
    supabase.from('leads').select('full_name').eq('id', ctx.leadId).maybeSingle(),
    ctx.propertyId
      ? supabase.from('properties').select('title').eq('id', ctx.propertyId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  await notifyAvitoEscalation(ctx.orgId, {
    leadId: ctx.leadId,
    reason,
    clientName: lead?.full_name ?? null,
    propertyTitle: property?.title ?? null,
  })

  return { ok: true }
}

export interface AvitoDialogResult {
  /** Текст для отправки клиенту в Авито-чат — null, если бот решил не отвечать (попрощались). */
  replyText: string | null
  escalated: boolean
  showingCreated: boolean
}

/**
 * Один круг диалога: берёт историю, добавляет новое сообщение клиента,
 * прогоняет tool-loop (до MAX_ROUNDS), сохраняет историю, возвращает ответ.
 */
export async function runAvitoDialogTurn(
  ctx: AvitoDialogContext,
  userText: string,
  contextNote: string
): Promise<AvitoDialogResult> {
  await maybeSavePhoneFromText(ctx.leadId, userText)

  const history = await loadHistory(ctx.avitoChatId)
  const messages: LlmMessage[] = [
    ...history,
    { role: 'system', content: contextNote },
    { role: 'user', content: userText },
  ]

  let escalated = false
  let showingCreated = false
  let replyText: string | null = null

  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const completion = await chatCompletion({
        system: SYSTEM_PROMPT,
        messages,
        tools: TOOLS,
        toolChoice: 'auto',
        parallelToolCalls: false,
      })
      const choice = completion.choices?.[0]
      const message = choice?.message
      if (!message) break

      messages.push(message)

      const toolCalls = (message.tool_calls ?? []) as AvitoToolCall[]
      if (toolCalls.length === 0) {
        replyText = typeof message.content === 'string' ? message.content.trim() : null
        break
      }

      for (const call of toolCalls) {
        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(call.function.arguments)
        } catch {
          // оставляем пустым — обработчик вернёт понятную ошибку модели
        }

        let result: unknown
        if (call.function.name === 'create_showing') {
          const r = await createShowingFromBot(ctx, args)
          if (r.ok) showingCreated = true
          result = r
        } else if (call.function.name === 'escalate_to_human') {
          result = await escalate(ctx, args)
          escalated = true
        } else {
          result = { error: `Неизвестный инструмент ${call.function.name}` }
        }

        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) })
      }
    }
  } finally {
    // system-сообщение с контекстом объекта не нужно хранить долго — следующий
    // круг добавит своё актуальное; срез по MAX_HISTORY_MESSAGES в saveHistory.
    await saveHistory(ctx.avitoChatId, ctx.orgId, messages).catch((e) =>
      console.error('[avito-dialog] saveHistory error:', e)
    )
  }

  return { replyText, escalated, showingCreated }
}
