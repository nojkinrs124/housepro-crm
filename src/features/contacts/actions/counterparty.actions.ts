'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireOrgId } from '@/lib/org'
import { requirePermission } from '@/lib/permissions'
import { rateLimitMutation } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'
import { isDadataConfigured, suggestParty, DadataError } from '@/lib/dadata/client'
import {
  describeCounterpartyStatus,
  type CounterpartySnapshot,
} from '@/features/contacts/config/counterparty'
import { toJson } from '@/lib/json'

export interface CounterpartyCheckResult {
  error?: string
  success?: boolean
  snapshot?: CounterpartySnapshot
  /** Замечания, на которые стоит посмотреть до подписания. */
  warnings?: string[]
}

/**
 * Проверяет контрагента-юрлицо по ЕГРЮЛ и сохраняет снимок в карточке.
 *
 * Источник — те же подсказки DaData, что заполняют реквизиты: отдельного
 * платного сервиса проверки не нужно, а статус, руководитель и адрес — это
 * ровно то, что смотрят перед подписанием.
 *
 * Снимок сохраняется целиком: если контрагент позже ликвидируется, должно
 * остаться видно, что на дату сделки он был действующим.
 */
export async function checkCounterpartyAction(contactId: string): Promise<CounterpartyCheckResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const rl = await rateLimitMutation(user.id, 'counterparty_check')
  if (!rl.success) return { error: 'Слишком много запросов. Подождите минуту.' }

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const permError = await requirePermission(user.id, 'contacts', 'read')
  if (permError) return { error: permError.error }

  if (!isDadataConfigured()) {
    return { error: 'Проверка недоступна: не задан DADATA_API_KEY в окружении' }
  }

  const { data: contact, error } = await supabase
    .from('contacts')
    .select('id, full_name, company_name, inn, client_type')
    .eq('id', contactId)
    .single()

  if (error || !contact) return { error: 'Контакт не найден' }

  const query = contact.inn?.trim() || contact.company_name?.trim()
  if (!query) {
    return { error: 'У контакта не заполнены ИНН и название организации — проверять нечего' }
  }

  let suggestions
  try {
    suggestions = await suggestParty(query, 1)
  } catch (e) {
    const message = e instanceof DadataError ? e.message : 'Сервис проверки недоступен'
    return { error: message }
  }

  const found = suggestions[0]
  if (!found) {
    return { error: `В ЕГРЮЛ ничего не найдено по запросу «${query}» — проверьте ИНН` }
  }

  const snapshot: CounterpartySnapshot = {
    name: found.fullName || found.name,
    inn: found.inn,
    kpp: found.kpp,
    ogrn: found.ogrn,
    legalAddress: found.legalAddress,
    managerName: found.managerName,
    managerPost: found.managerPost,
    status: found.status,
    type: found.type,
    checkedAt: new Date().toISOString(),
  }

  const warnings: string[] = []
  if (found.status && found.status !== 'ACTIVE') {
    warnings.push(`Организация ${describeCounterpartyStatus(found.status)} — подписывать договор рискованно`)
  }
  if (contact.inn && found.inn && contact.inn.trim() !== found.inn) {
    warnings.push(`ИНН в карточке (${contact.inn}) не совпадает с найденным (${found.inn})`)
  }
  if (!found.managerName) {
    warnings.push('В ЕГРЮЛ не указан руководитель — уточните основание полномочий подписанта')
  }

  const { error: saveError } = await supabase
    .from('contacts')
    .update({
      counterparty_check: toJson(snapshot),
      counterparty_checked_at: snapshot.checkedAt,
    })
    .eq('id', contactId)

  if (saveError) return { error: saveError.message }

  await writeAuditLog({
    userId: user.id,
    orgId,
    action: 'update',
    entityType: 'contact',
    entityId: contactId,
    entityLabel: contact.company_name || contact.full_name || 'Контакт',
    changes: {
      counterparty_check: {
        old: null,
        new: `${snapshot.name} — ${describeCounterpartyStatus(snapshot.status)}`,
      },
    },
  })

  revalidatePath(`/contacts/${contactId}`)
  return { success: true, snapshot, warnings }
}
