/**
 * Уведомления о лидах и эскалациях Авито — тонкая обёртка над реестром
 * `notify.ts`, чтобы существующие места вызова не менялись.
 *
 * Реализация и список всех уведомлений живут в `notify.ts` (аудит 28.10.2026:
 * раньше каждое уведомление было отдельной функцией с собственной копией
 * «взять chat_id в channel_bot_settings → отправить → погасить исключение»).
 * Новое уведомление добавляется в реестр, а не сюда.
 *
 * Чат — `admin_telegram_user_id` из `channel_bot_settings`, тот же, что у
 * дайджеста и кронов. Если бот для организации не настроен — тихо ничего не
 * делаем, это не ошибка.
 */

import { notify, type AvitoEscalationPayload, type NewLeadPayload } from './notify'

export type NewLeadNotification = NewLeadPayload
export type AvitoEscalationNotification = AvitoEscalationPayload

/** Новый лид: с публичного сайта или созданный вручную в CRM. */
export async function notifyNewLead(orgId: string, lead: NewLeadNotification): Promise<void> {
  await notify('new_lead', orgId, lead)
}

/** Авито-бот передал диалог человеку (`escalate_to_human`). */
export async function notifyAvitoEscalation(orgId: string, info: AvitoEscalationNotification): Promise<void> {
  await notify('avito_escalation', orgId, info)
}
