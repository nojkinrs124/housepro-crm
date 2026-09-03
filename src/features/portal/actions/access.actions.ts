'use server'

import { revalidatePath } from 'next/cache'
import { getSessionContext } from '@/lib/org'
import { requirePermission } from '@/lib/permissions'
import { writeAuditLog } from '@/lib/audit'
import { normalizePhone } from '@/lib/utils'
import {
  generateSignToken,
  generateSignCode,
  hashSignCode,
  CODE_TTL_MINUTES,
} from '@/lib/signing'

type Result = { error?: string; success?: boolean }
type IssueResult = Result & { code?: string; expiresInMinutes?: number }

function str(v: FormDataEntryValue | null): string {
  return typeof v === 'string' ? v.trim() : ''
}

/**
 * Выдача доступа в личный кабинет.
 *
 * Доступ всегда привязан к конкретному объекту и роли: кабинет показывает
 * объект, а не «всё, что связано с контактом». Телефон берётся из карточки
 * контакта — по нему идёт вход, и вводить его отдельно значило бы завести
 * второй источник правды.
 */
export async function grantPortalAccessAction(formData: FormData): Promise<Result> {
  const ctx = await getSessionContext()
  if (!ctx.ok) return { error: ctx.error }
  const { supabase, user, orgId } = ctx

  const permError = await requirePermission(user.id, 'contacts', 'update')
  if (permError) return permError

  const contactId = str(formData.get('contact_id'))
  const propertyId = str(formData.get('property_id'))
  const role = str(formData.get('role')) === 'tenant' ? 'tenant' : 'owner'
  const engagementId = str(formData.get('engagement_id')) || null
  const contractId = str(formData.get('contract_id')) || null

  if (!contactId) return { error: 'Не выбран контакт' }
  if (!propertyId) return { error: 'Не выбран объект' }

  const { data: contact } = await supabase
    .from('contacts')
    .select('phone, full_name, company_name')
    .eq('id', contactId)
    .maybeSingle()
  if (!contact) return { error: 'Контакт не найден' }

  const phone = normalizePhone(contact.phone)
  if (!phone) {
    return {
      error: 'У контакта не заполнен телефон — вход в кабинет идёт по номеру, без него доступ не выдать',
    }
  }

  const { error } = await supabase.from('portal_access').insert({
    organization_id: orgId,
    contact_id: contactId,
    property_id: propertyId,
    engagement_id: engagementId,
    contract_id: contractId,
    role,
    phone,
    granted_by: user.id,
  })

  if (error) {
    return {
      error: error.code === '23505'
        ? 'Доступ этому контакту на этот объект уже выдан'
        : error.message,
    }
  }

  await writeAuditLog({
    userId: user.id, orgId,
    action: 'create', entityType: 'portal_access',
    entityId: contactId,
    entityLabel: `Доступ в кабинет: ${contact.company_name || contact.full_name} (${role === 'owner' ? 'собственник' : 'арендатор'})`,
  })

  revalidatePath(`/management/${propertyId}`)
  revalidatePath(`/contacts/${contactId}`)
  return { success: true }
}

/**
 * Отзыв доступа.
 *
 * Действует немедленно: кабинет перечитывает `portal_access` на каждом запросе,
 * а не полагается на срок жизни сессии (FR-039).
 */
export async function revokePortalAccessAction(accessId: string): Promise<Result> {
  const ctx = await getSessionContext()
  if (!ctx.ok) return { error: ctx.error }
  const { supabase, user, orgId } = ctx

  const permError = await requirePermission(user.id, 'contacts', 'update')
  if (permError) return permError

  const { data: access, error } = await supabase
    .from('portal_access')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', accessId)
    .is('revoked_at', null)
    .select('property_id, contact_id')
    .maybeSingle()

  if (error) return { error: error.message }
  if (!access) return { error: 'Доступ не найден или уже отозван' }

  await writeAuditLog({
    userId: user.id, orgId,
    action: 'update', entityType: 'portal_access',
    entityId: accessId, entityLabel: 'Доступ в кабинет отозван',
  })

  if (access.property_id) revalidatePath(`/management/${access.property_id}`)
  return { success: true }
}

/**
 * Выдать код входа вручную.
 *
 * Рабочий путь на сегодня: автоматической доставки нет ни по одному каналу —
 * contacts.telegram хранит @username, а по нему Telegram личное сообщение не
 * отправляет (нужен chat_id, которого в базе нет), SMS-провайдер не подключён.
 * Поэтому менеджер получает код один раз и передаёт его тем каналом, которым
 * уже общается с клиентом.
 *
 * Код при этом живёт по обычным правилам: минуты, только хеш в базе, пять
 * попыток. Возвращается ровно один раз и нигде не сохраняется в открытом виде.
 */
export async function issuePortalCodeAction(accessId: string): Promise<IssueResult> {
  const ctx = await getSessionContext()
  if (!ctx.ok) return { error: ctx.error }
  const { supabase, user, orgId } = ctx

  const permError = await requirePermission(user.id, 'contacts', 'update')
  if (permError) return permError

  const { data: access } = await supabase
    .from('portal_access')
    .select('phone, revoked_at')
    .eq('id', accessId)
    .maybeSingle()

  if (!access) return { error: 'Доступ не найден' }
  if (access.revoked_at) return { error: 'Доступ отозван — сначала выдайте его заново' }

  const token = generateSignToken()
  const code = generateSignCode()

  const { error } = await supabase.from('portal_otp').insert({
    organization_id: orgId,
    phone: access.phone,
    token,
    code_hash: hashSignCode(code, token),
    channel: 'manual',
    issued_by: user.id,
    expires_at: new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString(),
  })
  if (error) return { error: error.message }

  await writeAuditLog({
    userId: user.id, orgId,
    action: 'create', entityType: 'portal_otp',
    entityId: accessId, entityLabel: 'Выдан код входа в кабинет',
  })

  return { success: true, code, expiresInMinutes: CODE_TTL_MINUTES }
}
