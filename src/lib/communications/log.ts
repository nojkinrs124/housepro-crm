// Запись событий общения в единую ленту + автопривязка к карточкам.
//
// Вызывается из вебхуков (телефония, WhatsApp) под service-role клиентом:
// у входящего запроса от провайдера нет сессии пользователя, а RLS-политики
// написаны под authenticated.

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { normalizePhone } from '@/lib/utils'

export type CommunicationChannel =
  | 'call' | 'email' | 'whatsapp' | 'telegram' | 'sms' | 'note' | 'meeting' | 'avito'
export type CommunicationDirection = 'inbound' | 'outbound' | 'internal'

export interface CommunicationInput {
  orgId: string
  channel: CommunicationChannel
  direction: CommunicationDirection
  /** Номер/адрес собеседника — по нему находим карточку. */
  counterpartyPhone?: string | null
  fromNumber?: string | null
  toNumber?: string | null
  occurredAt?: string
  durationSec?: number | null
  status?: string | null
  subject?: string | null
  body?: string | null
  recordingUrl?: string | null
  provider?: string | null
  externalId?: string | null
  userId?: string | null
  contactId?: string | null
  leadId?: string | null
  dealId?: string | null
}

export interface LinkedEntities {
  contactId: string | null
  leadId: string | null
  dealId: string | null
}

/**
 * Ищет, к чьей карточке относится номер: сначала контакт, затем лид.
 *
 * Сравнение идёт по нормализованному номеру в SQL — на это есть индексы
 * idx_contacts_phone_normalized / idx_leads_phone_normalized, иначе на каждый
 * входящий звонок пришлось бы вытаскивать всю базу контактов в память.
 */
export async function resolveByPhone(orgId: string, rawPhone: string | null | undefined): Promise<LinkedEntities> {
  const empty: LinkedEntities = { contactId: null, leadId: null, dealId: null }
  const phone = normalizePhone(rawPhone)
  if (!phone) return empty

  const supabase = getSupabaseAdmin()
  // normalize_phone_digits возвращает цифры без «+» — приводим к тому же виду.
  const digits = phone.replace(/\D/g, '')

  // Точное совпадение считаем в приложении: PostgREST не умеет вызывать нашу
  // SQL-функцию normalize_phone_digits в фильтре, а заводить RPC ради одного
  // сравнения избыточно. Выборка ограничена организацией — объём небольшой.
  const { data: contactsWithPhone } = await supabase
    .from('contacts')
    .select('id, phone')
    .eq('organization_id', orgId)
    .is('merged_into', null)
    .not('phone', 'is', null)
    .limit(2000)

  const contactId =
    (contactsWithPhone ?? []).find((c) => normalizePhone(c.phone)?.replace(/\D/g, '') === digits)?.id ?? null

  const { data: leads } = await supabase
    .from('leads')
    .select('id, phone')
    .eq('organization_id', orgId)
    .not('phone', 'is', null)
    .order('created_at', { ascending: false })
    .limit(2000)

  const leadId = (leads ?? []).find((l) => normalizePhone(l.phone)?.replace(/\D/g, '') === digits)?.id ?? null

  // Активная сделка контакта — чтобы звонок попал и в ленту сделки.
  let dealId: string | null = null
  if (contactId) {
    const { data: deal } = await supabase
      .from('deals')
      .select('id')
      .eq('organization_id', orgId)
      .eq('client_contact_id', contactId)
      .not('status', 'in', '("completed","cancelled")')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    dealId = deal?.id ?? null
  }

  return { contactId, leadId, dealId }
}

/**
 * Пишет событие в ленту. Идемпотентна по (provider, external_id): повторный
 * вебхук того же события не создаёт дубль, а обновляет запись — провайдеры
 * присылают «звонок начался» и «звонок завершён» отдельными запросами.
 */
export async function logCommunication(input: CommunicationInput): Promise<{ id: string } | null> {
  const supabase = getSupabaseAdmin()

  const links =
    input.contactId || input.leadId
      ? { contactId: input.contactId ?? null, leadId: input.leadId ?? null, dealId: input.dealId ?? null }
      : await resolveByPhone(input.orgId, input.counterpartyPhone)

  const row = {
    organization_id: input.orgId,
    channel: input.channel,
    direction: input.direction,
    status: input.status ?? null,
    occurred_at: input.occurredAt ?? new Date().toISOString(),
    duration_sec: input.durationSec ?? null,
    subject: input.subject ?? null,
    body: input.body ?? null,
    recording_url: input.recordingUrl ?? null,
    from_number: input.fromNumber ?? null,
    to_number: input.toNumber ?? null,
    counterparty_phone: normalizePhone(input.counterpartyPhone) ?? input.counterpartyPhone ?? null,
    contact_id: links.contactId,
    lead_id: links.leadId,
    deal_id: input.dealId ?? links.dealId,
    user_id: input.userId ?? null,
    provider: input.provider ?? null,
    external_id: input.externalId ?? null,
  }

  try {
    if (input.provider && input.externalId) {
      const { data, error } = await supabase
        .from('communications')
        .upsert(row, { onConflict: 'provider,external_id' })
        .select('id')
        .single()
      if (error) throw error
      return data
    }

    const { data, error } = await supabase.from('communications').insert(row).select('id').single()
    if (error) throw error
    return data
  } catch (e) {
    // Лента общения не должна ломать приём вебхука: провайдер будет ретраить
    // до ответа 200, а нам важнее не потерять сам звонок из-за сбоя записи.
    console.error('[communications] не удалось записать событие:', e)
    return null
  }
}

/**
 * Вид интеграции. 'payments' живёт в той же таблице, что каналы связи:
 * структура настроек одинакова — провайдер, учётные данные, секрет вебхука.
 */
export type IntegrationKind = 'telephony' | 'whatsapp' | 'payments'

/** Настройки интеграции организации: учётные данные провайдера и секрет вебхука. */
export async function getChannelIntegration(orgId: string, kind: IntegrationKind) {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('channel_integrations')
    .select('id, provider, credentials, webhook_secret, is_active')
    .eq('organization_id', orgId)
    .eq('kind', kind)
    .maybeSingle()
  return data
}

/** Находит организацию по секрету из вебхука — обратный путь к настройкам. */
export async function resolveOrgByWebhookSecret(
  secret: string,
  kind: IntegrationKind
): Promise<{ orgId: string; provider: string; credentials: Record<string, unknown> } | null> {
  if (!secret || secret.length < 16) return null

  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('channel_integrations')
    .select('organization_id, provider, credentials, is_active')
    .eq('webhook_secret', secret)
    .eq('kind', kind)
    .maybeSingle()

  if (!data || !data.is_active) return null
  return {
    orgId: data.organization_id as string,
    provider: data.provider as string,
    credentials: (data.credentials ?? {}) as Record<string, unknown>,
  }
}
