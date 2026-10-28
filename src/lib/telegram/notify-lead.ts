import { sendMessage } from './api'
import { getChannelSettings } from './channel'
import { getSiteUrl } from './site-url'
import { LEAD_SOURCE_LABELS } from '@/features/leads/config/lead-sources'

// Уведомление админу в Telegram о новом лиде — и с публичного сайта, и созданном
// вручную в CRM (см. вызовы в src/app/api/public/leads/route.ts и
// src/features/leads/actions/leads.actions.ts). Чат берётся из того же
// admin_telegram_user_id, что уже настроен для утреннего дайджеста
// (channel_bot_settings) — если для организации бот не настроен, тихо ничего не
// делаем, это не ошибка. Отправка никогда не бросает исключение наружу: создание
// лида не должно падать из-за недоступности Telegram.


export interface NewLeadNotification {
  id: string
  full_name?: string | null
  phone?: string | null
  source?: string | null
}

export async function notifyNewLead(orgId: string, lead: NewLeadNotification): Promise<void> {
  try {
    const settings = await getChannelSettings(orgId)
    const chatId = settings?.admin_telegram_user_id
    if (!chatId) return

    const sourceLabel = lead.source ? LEAD_SOURCE_LABELS[lead.source] ?? lead.source : null

    const lines = [
      '🧲 <b>Новый лид</b>',
      lead.full_name ? `Имя: ${lead.full_name}` : null,
      lead.phone ? `Телефон: ${lead.phone}` : null,
      sourceLabel ? `Источник: ${sourceLabel}` : null,
      `${getSiteUrl()}/leads/${lead.id}`,
    ].filter((line): line is string => Boolean(line))

    await sendMessage(chatId, lines.join('\n'))
  } catch (err) {
    console.error('[telegram] notifyNewLead failed:', err)
  }
}

export interface AvitoEscalationNotification {
  leadId: string
  reason: string
  clientName?: string | null
  propertyTitle?: string | null
}

// Уведомление админу в Telegram о том, что Авито-бот передал диалог человеку
// (escalate_to_human в avito-dialog.service.ts) — сейчас бот только помечает это
// в комментарии лида, никто не узнаёт об этом сразу. Чат — тот же
// admin_telegram_user_id, что и у notifyNewLead/дайджеста. Отправка никогда не
// бросает исключение наружу: сбой Telegram не должен ронять диалог с клиентом.
export async function notifyAvitoEscalation(orgId: string, info: AvitoEscalationNotification): Promise<void> {
  try {
    const settings = await getChannelSettings(orgId)
    const chatId = settings?.admin_telegram_user_id
    if (!chatId) return

    const lines = [
      '🤖➡️👤 <b>Авито-бот передал диалог сотруднику</b>',
      info.clientName ? `Клиент: ${info.clientName}` : null,
      info.propertyTitle ? `Объект: ${info.propertyTitle}` : null,
      `Причина: ${info.reason}`,
      `${getSiteUrl()}/leads/${info.leadId}`,
    ].filter((line): line is string => Boolean(line))

    await sendMessage(chatId, lines.join('\n'))
  } catch (err) {
    console.error('[telegram] notifyAvitoEscalation failed:', err)
  }
}
