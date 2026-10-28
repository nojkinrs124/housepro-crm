/**
 * Уведомления бота владельцу — ОДИН реестр вместо коллекции точечных функций.
 *
 * Было (находка аудита бота 28.10.2026): каждое «бот должен сообщить о X»
 * добавлялось отдельной функцией в `notify-lead.ts` плюс отдельным вызовом в
 * месте события. Список уведомлений существовал только в голове того, кто их
 * добавлял: увидеть его целиком, включить/выключить без деплоя или проверить,
 * что два события не шлют одно и то же, было нельзя. При росте числа
 * уведомлений это гарантирует дубли и забытые вызовы.
 *
 * Теперь: событие + его шаблон объявлены ЗДЕСЬ (`NOTIFICATIONS`), отправка —
 * одна (`notify(event, orgId, payload)`), чат — по-прежнему
 * `channel_bot_settings.admin_telegram_user_id`. Новое уведомление = запись в
 * реестр + один вызов `notify(...)` в месте события; никакой новой интеграции
 * и никакого второго бота.
 *
 * Отправка никогда не бросает исключение наружу: сбой Telegram не должен
 * ронять основной сценарий (создание лида, диалог с клиентом, публикацию).
 */

import { sendMessage } from './api'
import { getChannelSettings } from './channel'
import { getSiteUrl } from './site-url'
import { LEAD_SOURCE_LABELS } from '@/features/leads/config/lead-sources'

export interface NewLeadPayload {
  id: string
  full_name?: string | null
  phone?: string | null
  source?: string | null
}

export interface AvitoEscalationPayload {
  leadId: string
  reason: string
  clientName?: string | null
  propertyTitle?: string | null
}

/** Событие → тип полезной нагрузки. Новое событие добавляется сюда же. */
export interface NotificationPayloads {
  new_lead: NewLeadPayload
  avito_escalation: AvitoEscalationPayload
}

export type NotificationEvent = keyof NotificationPayloads

type Line = string | null

/** Строки без пустых — единое правило для всех шаблонов. */
function compact(lines: Line[]): string {
  return lines.filter((line): line is string => Boolean(line)).join('\n')
}

export function leadUrl(id: string): string {
  return `${getSiteUrl()}/leads/${id}`
}

/**
 * Реестр уведомлений: что это за событие и как выглядит сообщение.
 *
 * `build` — чистая функция от полезной нагрузки: её можно и протестировать без
 * Telegram, и переиспользовать (например в дайджесте), не дублируя текст.
 */
export const NOTIFICATIONS: {
  [E in NotificationEvent]: {
    /** Человеческое название — для настроек/логов, не для текста сообщения. */
    label: string
    build: (payload: NotificationPayloads[E]) => string
  }
} = {
  new_lead: {
    label: 'Новый лид',
    build: (lead) => compact([
      '🧲 <b>Новый лид</b>',
      lead.full_name ? `Имя: ${lead.full_name}` : null,
      lead.phone ? `Телефон: ${lead.phone}` : null,
      lead.source ? `Источник: ${LEAD_SOURCE_LABELS[lead.source] ?? lead.source}` : null,
      leadUrl(lead.id),
    ]),
  },
  avito_escalation: {
    label: 'Авито-бот передал диалог сотруднику',
    build: (info) => compact([
      '🤖➡️👤 <b>Авито-бот передал диалог сотруднику</b>',
      info.clientName ? `Клиент: ${info.clientName}` : null,
      info.propertyTitle ? `Объект: ${info.propertyTitle}` : null,
      `Причина: ${info.reason}`,
      leadUrl(info.leadId),
    ]),
  },
}

/** Текст уведомления — без сети, для тестов и повторного использования. */
export function buildNotification<E extends NotificationEvent>(
  event: E,
  payload: NotificationPayloads[E],
): string {
  return NOTIFICATIONS[event].build(payload)
}

/** Шлёт уведомление владельцу. Молча выходит, если бот для организации не настроен. */
export async function notify<E extends NotificationEvent>(
  event: E,
  orgId: string,
  payload: NotificationPayloads[E],
): Promise<void> {
  try {
    const settings = await getChannelSettings(orgId)
    const chatId = settings?.admin_telegram_user_id
    if (!chatId) return
    await sendMessage(chatId, buildNotification(event, payload))
  } catch (err) {
    console.error(`[telegram] notify ${event} failed:`, err)
  }
}
