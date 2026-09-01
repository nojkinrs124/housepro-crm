'use server'

import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireOrgId } from '@/lib/org'
import { requirePermission } from '@/lib/permissions'
import { rateLimitMutation } from '@/lib/rate-limit'
import { normalizePhone } from '@/lib/utils'
import { getChannelIntegration, type IntegrationKind } from '@/lib/communications/log'
import {
  sendWhatsappMessage,
  WHATSAPP_PROVIDERS,
  type WhatsappProvider,
} from '@/lib/communications/whatsapp'
import { TELEPHONY_PROVIDERS } from '@/lib/communications/telephony'

/** Эквайринг: пока поддержана только ЮKassa, список — точка расширения. */
const PAYMENT_PROVIDERS = ['yookassa'] as const

const MANUAL_CHANNELS = ['call', 'note', 'meeting', 'sms', 'telegram', 'email'] as const
type ManualChannel = (typeof MANUAL_CHANNELS)[number]

interface LinkFields {
  contactId?: string | null
  leadId?: string | null
  dealId?: string | null
}

/**
 * Ручная запись в ленту: состоявшийся звонок, встреча, заметка.
 *
 * Нужна и при подключённой телефонии: агент звонит с личного мобильного,
 * встречается на объекте — эти касания АТС не видит, а история должна быть полной.
 */
export async function logManualCommunicationAction(links: LinkFields, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const rl = await rateLimitMutation(user.id, 'communication_log')
  if (!rl.success) return { error: 'Слишком много запросов. Подождите минуту.' }

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const channel = (formData.get('channel') as ManualChannel) || 'note'
  if (!MANUAL_CHANNELS.includes(channel)) return { error: 'Недопустимый канал' }

  const body = (formData.get('body') as string)?.trim()
  if (!body) return { error: 'Напишите, о чём было общение' }

  const direction = (formData.get('direction') as string) === 'inbound' ? 'inbound' : 'outbound'
  const durationRaw = formData.get('duration_min')
  const durationSec = durationRaw ? Math.round(Number(durationRaw) * 60) : null

  const { error } = await supabase.from('communications').insert({
    organization_id: orgId,
    channel,
    direction: channel === 'note' ? 'internal' : direction,
    body,
    occurred_at: (formData.get('occurred_at') as string) || new Date().toISOString(),
    duration_sec: Number.isFinite(durationSec) ? durationSec : null,
    status: channel === 'call' ? 'answered' : null,
    contact_id: links.contactId ?? null,
    lead_id: links.leadId ?? null,
    deal_id: links.dealId ?? null,
    user_id: user.id,
  })

  if (error) return { error: error.message }

  if (links.contactId) revalidatePath(`/contacts/${links.contactId}`)
  if (links.leadId) revalidatePath(`/leads/${links.leadId}`)
  if (links.dealId) revalidatePath(`/deals/${links.dealId}`)

  return { success: true }
}

/** Отправляет WhatsApp-сообщение через шлюз организации и пишет его в ленту. */
export async function sendWhatsappAction(links: LinkFields, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const rl = await rateLimitMutation(user.id, 'whatsapp_send')
  if (!rl.success) return { error: 'Слишком много запросов. Подождите минуту.' }

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const phone = normalizePhone(formData.get('phone') as string)
  const text = (formData.get('text') as string)?.trim()
  if (!phone) return { error: 'Не указан корректный номер получателя' }
  if (!text) return { error: 'Напишите текст сообщения' }

  const integration = await getChannelIntegration(orgId, 'whatsapp')
  if (!integration || !integration.is_active) {
    return { error: 'WhatsApp не подключён — настройте канал в разделе «Настройки → Каналы связи»' }
  }

  const provider = integration.provider as WhatsappProvider
  if (!WHATSAPP_PROVIDERS.includes(provider)) return { error: 'Неизвестный провайдер WhatsApp' }

  const result = await sendWhatsappMessage(
    provider,
    (integration.credentials ?? {}) as Record<string, unknown>,
    phone,
    text
  )

  if (!result.ok) return { error: result.error ?? 'Не удалось отправить сообщение' }

  await supabase.from('communications').insert({
    organization_id: orgId,
    channel: 'whatsapp',
    direction: 'outbound',
    body: text,
    counterparty_phone: phone,
    to_number: phone,
    status: 'sent',
    provider,
    external_id: result.externalId ?? null,
    contact_id: links.contactId ?? null,
    lead_id: links.leadId ?? null,
    deal_id: links.dealId ?? null,
    user_id: user.id,
  })

  if (links.contactId) revalidatePath(`/contacts/${links.contactId}`)
  if (links.leadId) revalidatePath(`/leads/${links.leadId}`)
  if (links.dealId) revalidatePath(`/deals/${links.dealId}`)

  return { success: true, message: 'Сообщение отправлено' }
}

/**
 * Сохраняет настройки канала (телефония / WhatsApp) и при первом сохранении
 * выдаёт секрет вебхука — по нему провайдер потом узнаёт организацию.
 */
export async function saveChannelIntegrationAction(
  kind: IntegrationKind,
  _prevState: unknown,
  formData: FormData
): Promise<ChannelActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const permError = await requirePermission(user.id, 'settings', 'update')
  if (permError) return permError

  const provider = (formData.get('provider') as string)?.trim()
  const allowed =
    kind === 'telephony' ? TELEPHONY_PROVIDERS : kind === 'whatsapp' ? WHATSAPP_PROVIDERS : PAYMENT_PROVIDERS
  if (!allowed.includes(provider as never)) return { error: 'Выберите провайдера' }

  // Каждое поле учётных данных приходит под префиксом cred_ — так набор полей
  // задаётся формой под конкретного провайдера, а экшен остаётся общим.
  const credentials: Record<string, string> = {}
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('cred_') && typeof value === 'string' && value.trim() !== '') {
      credentials[key.slice(5)] = value.trim()
    }
  }

  const { data: existing } = await supabase
    .from('channel_integrations')
    .select('id, webhook_secret, credentials')
    .eq('organization_id', orgId)
    .eq('kind', kind)
    .maybeSingle()

  // Пустое поле секрета в форме означает «оставить прежнее значение»:
  // на странице настроек ключи показываются замаскированными.
  const mergedCredentials = { ...((existing?.credentials ?? {}) as Record<string, string>), ...credentials }

  const payload = {
    organization_id: orgId,
    kind,
    provider,
    credentials: mergedCredentials,
    is_active: formData.get('is_active') !== 'off',
    webhook_secret: existing?.webhook_secret ?? randomBytes(24).toString('hex'),
    updated_at: new Date().toISOString(),
  }

  const { error } = existing
    ? await supabase.from('channel_integrations').update(payload).eq('id', existing.id)
    : await supabase.from('channel_integrations').insert(payload)

  if (error) return { error: error.message }

  revalidatePath('/settings/channels')
  return { success: true }
}

export interface ChannelActionResult {
  error?: string
  success?: boolean
}

/** Перевыпускает секрет вебхука — старый адрес сразу перестаёт приниматься. */
export async function regenerateWebhookSecretAction(
  kind: IntegrationKind
): Promise<ChannelActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const permError = await requirePermission(user.id, 'settings', 'update')
  if (permError) return permError

  const { error } = await supabase
    .from('channel_integrations')
    .update({ webhook_secret: randomBytes(24).toString('hex'), updated_at: new Date().toISOString() })
    .eq('organization_id', orgId)
    .eq('kind', kind)

  if (error) return { error: error.message }

  revalidatePath('/settings/channels')
  revalidatePath('/settings/payments')
  return { success: true }
}
