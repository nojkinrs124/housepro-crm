import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import {
  fetchAvitoAccessToken,
  fetchAvitoChats,
  fetchAvitoMessages,
  sendAvitoMessage,
  markAvitoChatRead,
  AvitoApiError,
} from '@/features/avito/services/avito-api.service'
import { runAvitoDialogTurn } from '@/features/avito/services/avito-dialog.service'
import { logCommunication } from '@/lib/communications/log'
import { isCronAuthorized } from '@/lib/cron-auth'

export const dynamic = 'force-dynamic'
// LLM-диалог (несколько раундов tool-loop) может занять дольше 10с дефолта Hobby —
// как у telegram/webhook/route.ts и ai/listing. 60 — максимум для Hobby-функций.
export const maxDuration = 60

// Забирает непрочитанные сообщения из мессенджера Авито, превращает их в лиды,
// ведёт автоматический диалог с клиентом и сам назначает показы.
//
// Авито не шлёт вебхуки в общем случае, поэтому опрашиваем сами. Расписание —
// pg_cron (миграция 20260915080224), частота задаётся там же, не здесь.
//
// Дедупликация двойная: сообщения — по (provider, external_id) в ленте
// коммуникаций, лиды — по внешнему идентификатору чата в comment. Без этого
// каждый прогон плодил бы новый лид на тот же диалог.
//
// Диалог ведёт бот сам, без подтверждения человеком (решение владельца:
// единственный агент, редкие конфликты расписания не критичны) — в отличие
// от Telegram-бота для сотрудников, где мутации всегда через подтверждение.

const MAX_CHATS_PER_RUN = 30

interface AvitoSettingsRow {
  organization_id: string
  client_id: string | null
  client_secret: string | null
  avito_user_id: string | null
  access_token: string | null
  token_expires_at: string | null
  is_enabled: boolean
}

/** Отдаёт живой токен, обновляя его при необходимости (живёт 24 часа). */
async function ensureToken(settings: AvitoSettingsRow): Promise<string | null> {
  const valid =
    settings.access_token && settings.token_expires_at && new Date(settings.token_expires_at) > new Date()
  if (valid) return settings.access_token

  if (!settings.client_id || !settings.client_secret) return null

  try {
    const token = await fetchAvitoAccessToken(settings.client_id, settings.client_secret)
    const supabase = getSupabaseAdmin()
    await supabase
      .from('avito_settings')
      .update({
        access_token: token.accessToken,
        token_expires_at: new Date(Date.now() + token.expiresInSeconds * 1000).toISOString(),
      })
      .eq('organization_id', settings.organization_id)
    return token.accessToken
  } catch (e) {
    console.error('[cron:avito-messenger] не удалось получить токен:', e)
    return null
  }
}

/** Находит объект CRM по id объявления Авито (itemId чата = avito_ad_id объекта). */
async function findPropertyByItemId(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  orgId: string,
  itemId: string | null
): Promise<{ id: string; title: string; address: string } | null> {
  if (!itemId) return null
  const { data } = await supabase
    .from('properties')
    .select('id, title, address')
    .eq('organization_id', orgId)
    .eq('avito_ad_id', itemId)
    .maybeSingle()
  return data ?? null
}

export async function GET(request: Request) {
  if (!(await isCronAuthorized(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('avito_settings')
    .select('organization_id, client_id, client_secret, avito_user_id, access_token, token_expires_at, is_enabled')
    .eq('is_enabled', true)

  const accounts = (data ?? []) as AvitoSettingsRow[]
  let messagesLogged = 0
  let leadsCreated = 0
  let repliesSent = 0
  let showingsCreated = 0
  const errors: string[] = []

  for (const settings of accounts) {
    if (!settings.avito_user_id) continue

    const token = await ensureToken(settings)
    if (!token) {
      errors.push(`${settings.organization_id}: нет токена`)
      continue
    }

    let chats
    try {
      chats = await fetchAvitoChats(settings.avito_user_id, token, {
        unreadOnly: true,
        limit: MAX_CHATS_PER_RUN,
      })
    } catch (e) {
      const message = e instanceof AvitoApiError ? e.message : String(e)
      errors.push(`${settings.organization_id}: ${message}`)
      await supabase
        .from('avito_settings')
        .update({ last_sync_error: message })
        .eq('organization_id', settings.organization_id)
      continue
    }

    for (const chat of chats) {
      const property = await findPropertyByItemId(supabase, settings.organization_id, chat.itemId)

      // Лид на диалог: ищем по метке с id чата, чтобы не плодить дубли.
      const chatTag = `avito:${chat.id}`
      const { data: existingLead } = await supabase
        .from('leads')
        .select('id, property_id')
        .eq('organization_id', settings.organization_id)
        .ilike('comment', `%${chatTag}%`)
        .limit(1)
        .maybeSingle()

      let leadId = existingLead?.id ?? null

      if (!leadId) {
        // Телефона у Авито в мессенджере нет — клиент скрыт за чатом, пока
        // сам его не назовёт. Заводим лид с именем и ссылкой на объявление.
        const { data: created } = await supabase
          .from('leads')
          .insert({
            organization_id: settings.organization_id,
            full_name: chat.userName || 'Клиент с Авито',
            source: 'avito',
            status: 'new',
            property_id: property?.id ?? null,
            comment: [
              chat.itemTitle ? `Объявление: ${chat.itemTitle}` : null,
              chat.itemUrl,
              chat.lastMessageText,
              chatTag,
            ]
              .filter(Boolean)
              .join('\n'),
          })
          .select('id')
          .single()

        leadId = created?.id ?? null
        if (leadId) leadsCreated += 1
      } else if (property?.id && !existingLead?.property_id) {
        // Лид уже был, но без привязки к объекту (чат завёлся раньше, чем
        // объект нашёлся по itemId, либо объект опубликовали позже).
        await supabase.from('leads').update({ property_id: property.id }).eq('id', leadId)
      }

      let messages
      try {
        messages = await fetchAvitoMessages(settings.avito_user_id, token, chat.id)
      } catch (e) {
        errors.push(`чат ${chat.id}: ${e instanceof Error ? e.message : String(e)}`)
        continue
      }

      // Сообщения приходят свежие сверху — для диалога нужен порядок "старое → новое",
      // а в диалог модели отдаём только последнее входящее клиента (остальное уже в истории).
      const chronological = [...messages].reverse()
      let lastIncomingText: string | null = null

      for (const message of chronological) {
        if (!message.text) continue
        await logCommunication({
          orgId: settings.organization_id,
          channel: 'avito',
          direction: message.isOutgoing ? 'outbound' : 'inbound',
          body: message.text,
          subject: chat.itemTitle ? `Авито: ${chat.itemTitle}` : 'Сообщение с Авито',
          occurredAt: message.createdAt,
          provider: 'avito',
          externalId: message.id,
          leadId,
        })
        messagesLogged += 1
        if (!message.isOutgoing) lastIncomingText = message.text
      }

      // Отвечаем только если в этой пачке было хотя бы одно новое входящее
      // сообщение клиента — иначе бот отвечал бы повторно на уже обработанное.
      if (lastIncomingText && leadId) {
        const contextNote = property
          ? `Объект, по которому обращается клиент: «${property.title}», ${property.address}.`
          : 'Объект по этому чату не определён — объявление либо снято, либо не из автозагрузки CRM.'

        try {
          const result = await runAvitoDialogTurn(
            { orgId: settings.organization_id, avitoChatId: chat.id, leadId, propertyId: property?.id ?? null },
            lastIncomingText,
            contextNote
          )

          if (result.showingCreated) showingsCreated += 1

          if (result.replyText) {
            await sendAvitoMessage(settings.avito_user_id, token, chat.id, result.replyText)
            await logCommunication({
              orgId: settings.organization_id,
              channel: 'avito',
              direction: 'outbound',
              body: result.replyText,
              subject: chat.itemTitle ? `Авито: ${chat.itemTitle}` : 'Сообщение с Авито',
              provider: 'avito',
              externalId: `bot-${chat.id}-${Date.now()}`,
              leadId,
            })
            repliesSent += 1
          }
        } catch (e) {
          errors.push(`диалог ${chat.id}: ${e instanceof Error ? e.message : String(e)}`)
        }
      }

      await markAvitoChatRead(settings.avito_user_id, token, chat.id)
    }

    await supabase
      .from('avito_settings')
      .update({ last_synced_at: new Date().toISOString(), last_sync_error: null })
      .eq('organization_id', settings.organization_id)
  }

  return NextResponse.json({
    ok: true,
    accounts: accounts.length,
    leadsCreated,
    messagesLogged,
    repliesSent,
    showingsCreated,
    errors: errors.slice(0, 5),
  })
}
