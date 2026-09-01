import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import {
  fetchAvitoAccessToken,
  fetchAvitoChats,
  fetchAvitoMessages,
  markAvitoChatRead,
  AvitoApiError,
} from '@/features/avito/services/avito-api.service'
import { logCommunication } from '@/lib/communications/log'

export const dynamic = 'force-dynamic'

// Забирает непрочитанные сообщения из мессенджера Авито и превращает их в лиды.
//
// Авито не шлёт вебхуки в общем случае, поэтому опрашиваем сами. Раз в 15 минут
// достаточно: клиент, написавший объявлению, ждёт ответ в течение часа, а более
// частый опрос упирается в лимиты API.
//
// Дедупликация двойная: сообщения — по (provider, external_id) в ленте
// коммуникаций, лиды — по внешнему идентификатору чата в comment. Без этого
// каждый прогон плодил бы новый лид на тот же диалог.

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

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  const querySecret = new URL(request.url).searchParams.get('secret')
  const ok =
    process.env.CRON_SECRET &&
    (auth === `Bearer ${process.env.CRON_SECRET}` || querySecret === process.env.CRON_SECRET)
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('avito_settings')
    .select('organization_id, client_id, client_secret, avito_user_id, access_token, token_expires_at, is_enabled')
    .eq('is_enabled', true)

  const accounts = (data ?? []) as AvitoSettingsRow[]
  let messagesLogged = 0
  let leadsCreated = 0
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
      // Лид на диалог: ищем по метке с id чата, чтобы не плодить дубли.
      const chatTag = `avito:${chat.id}`
      const { data: existingLead } = await supabase
        .from('leads')
        .select('id')
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
      }

      let messages
      try {
        messages = await fetchAvitoMessages(settings.avito_user_id, token, chat.id)
      } catch (e) {
        errors.push(`чат ${chat.id}: ${e instanceof Error ? e.message : String(e)}`)
        continue
      }

      for (const message of messages) {
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
    errors: errors.slice(0, 5),
  })
}
