'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  ContractSchema,
  RentApartmentDataSchema,
  CommercialRentDataSchema,
  SaleDataSchema,
  AgencyServiceDataSchema,
  PropertyManagementDataSchema,
  SubleaseDataSchema,
} from '@/lib/schemas'
import { getSessionContext, requireOrgId } from '@/lib/org'
import { writeAuditLog } from '@/lib/audit'
import { requirePermission } from '@/lib/permissions'
import { dispatchWebhook } from '@/lib/webhooks'
import { advanceDealStage } from '@/lib/deal-automation'
import { CONTRACT_TYPES } from '@/features/contracts/config/contract-types'
import type { Update } from '@/types/database'
import {
  validateSchemeFields,
  schemeFields,
  shouldRefetchRate,
  type PlanTermsInput,
  type ExistingTerms,
} from '@/features/plans/services/plan-terms'
import { toJson } from '@/lib/json'

// Схема contract_type_data по каждому типу договора (см. config/contract-types.ts).
const CONTRACT_TYPE_DATA_SCHEMAS: Record<string, z.ZodTypeAny> = {
  rent_apartment: RentApartmentDataSchema,
  rent_commercial: CommercialRentDataSchema,
  sale: SaleDataSchema,
  agency_owner: AgencyServiceDataSchema,
  agency_client: AgencyServiceDataSchema,
  agency_legal_entity: AgencyServiceDataSchema,
  property_management: PropertyManagementDataSchema,
  sublease: SubleaseDataSchema,
}

// Собирает и валидирует contract_type_data из формы.
// Поле contract_type_data_json — hidden input с JSON-строкой (см. *ExtraFields.tsx компоненты).
function parseContractTypeData(contractType: string, formData: FormData): Record<string, unknown> {
  const schema = CONTRACT_TYPE_DATA_SCHEMAS[contractType]
  if (!schema) return {}

  const raw = formData.get('contract_type_data_json')
  let parsed: unknown = {}
  if (typeof raw === 'string' && raw.trim()) {
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = {}
    }
  }

  const result = schema.safeParse(parsed)
  return result.success ? (result.data as Record<string, unknown>) : {}
}


/**
 * Тип договора должен соответствовать тому, кем на самом деле является заказчик.
 *
 * Форма фильтрует список контактов по типу договора, но тип можно переключить
 * уже после выбора стороны — и тогда физлицо оказалось бы в договоре с юрлицом.
 * Ошибка тихая и дорогая: документ уходит клиенту с чужой шапкой и без реквизитов
 * организации. Проверка серверная, потому что форму можно обойти.
 */
async function validateClientEntityType(
  supabase: Awaited<ReturnType<typeof createClient>>,
  contractType: string,
  clientContactId: string | null | undefined,
): Promise<string | null> {
  const config = CONTRACT_TYPES.find(t => t.value === contractType)
  if (!config || !clientContactId) return null
  if (config.party2Role !== 'client') return null

  const { data: contact } = await supabase
    .from('contacts')
    .select('client_type, full_name, company_name')
    .eq('id', clientContactId)
    .maybeSingle()
  if (!contact) return null

  const isLegalEntity = contact.client_type === 'legal_entity'
  const name = contact.company_name || contact.full_name

  if (config.requiresLegalEntity && !isLegalEntity) {
    return `«${name}» — физическое лицо, а тип договора рассчитан на организацию. Выберите «Агентский договор с заказчиком» или заполните реквизиты юрлица в карточке контакта`
  }
  if (!config.requiresLegalEntity && isLegalEntity && config.direction === 'tenant_search') {
    return `«${name}» — юридическое лицо. Для него нужен «Агентский договор с юр. лицом»: там подставляются реквизиты организации и её представитель`
  }
  return null
}

/**
 * Достраивает условия договора: ставку тарифа и согласованность схемы расчёта.
 *
 * Ставка берётся из справочника СЕРВЕРОМ, а не из формы: значение из браузера
 * можно поправить в инструментах разработчика, а по нему считаются деньги.
 * Правила фиксации — в features/plans/services/plan-terms.ts, там же их тесты.
 */
async function resolvePlanTerms(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: PlanTermsInput,
  existing?: ExistingTerms | null,
): Promise<{ error: string } | { terms: Record<string, unknown> }> {
  const invalid = validateSchemeFields(input)
  if (invalid) return { error: invalid }

  const terms: Record<string, unknown> = { ...schemeFields(input), plan_rate: null }

  if (input.plan_id) {
    if (!shouldRefetchRate(input.plan_id, existing)) {
      // Тариф тот же — сохраняем зафиксированную ставку как есть.
      terms.plan_rate = existing?.plan_rate ?? null
    } else {
      const { data: plan } = await supabase
        .from('service_plans')
        .select('rate, charge_type, is_active')
        .eq('id', input.plan_id)
        .maybeSingle()
      if (!plan) return { error: 'Выбранный тариф не найден' }
      if (!plan.is_active) return { error: 'Выбранный тариф скрыт — включите его или выберите другой' }
      terms.plan_rate = plan.rate
    }
  }

  return { terms }
}

/** Предыдущее состояние из useActionState — обработчику не нужно. */
type PrevState = unknown

export async function createContractAction(_prevState: PrevState, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const parsed = ContractSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first.message, fields: parsed.error.flatten().fieldErrors }
  }

  const contractTypeData = parseContractTypeData(parsed.data.contract_type, formData)

  const permError = await requirePermission(user.id, 'contracts', 'create')
  if (permError) return permError

  const entityError = await validateClientEntityType(supabase, parsed.data.contract_type, parsed.data.client_contact_id)
  if (entityError) return { error: entityError }

  const resolved = await resolvePlanTerms(supabase, parsed.data)
  if ('error' in resolved) return { error: resolved.error }

  const { data: contract, error } = await supabase
    .from('contracts')
    .insert({
      ...parsed.data,
      ...resolved.terms,
      contract_type_data: toJson(contractTypeData),
      status: 'draft',
      manager_id: user.id,
      organization_id: orgId,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  // Автоматизация: договор создан из карточки сделки — двигаем сделку на стадию «Договор».
  if (parsed.data.deal_id) {
    await advanceDealStage(supabase, parsed.data.deal_id, 'contract')
    revalidatePath('/deals')
    revalidatePath(`/deals/${parsed.data.deal_id}`)
  }

  dispatchWebhook(orgId, 'contract.created', {
    id: contract.id, contract_type: parsed.data.contract_type, amount: parsed.data.amount,
  })

  revalidatePath('/contracts')
  revalidatePath('/analytics', 'page')
  redirect(`/contracts/${contract.id}`)
}

export async function updateContractAction(id: string, _prevState: PrevState, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const parsed = ContractSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first.message, fields: parsed.error.flatten().fieldErrors }
  }

  const permError = await requirePermission(user.id, 'contracts', 'update')
  if (permError) return permError

  // Сохраняем текущую версию перед обновлением
  const { data: current } = await supabase
    .from('contracts').select('*').eq('id', id).single()

  if (current) {
    const { data: versions } = await supabase
      .from('contract_versions')
      .select('version')
      .eq('contract_id', id)
      .order('version', { ascending: false })
      .limit(1)

    const nextVersion = versions?.[0]?.version ? versions[0].version + 1 : 1

    // organization_id в contract_versions нет — изоляция идёт через contract_id.
    // Раньше он тут передавался, PostgREST отклонял вставку, а ошибку никто не
    // смотрел: история версий при редактировании не сохранялась вообще.
    const { error: versionError } = await supabase.from('contract_versions').insert({
      contract_id:  id,
      version:      nextVersion,
      version_data: current,
      created_by:   user.id,
    })
    if (versionError) return { error: `Не удалось сохранить версию: ${versionError.message}` }
  }

  const contractTypeData = parseContractTypeData(parsed.data.contract_type, formData)

  const entityErrorUpdate = await validateClientEntityType(supabase, parsed.data.contract_type, parsed.data.client_contact_id)
  if (entityErrorUpdate) return { error: entityErrorUpdate }

  const resolvedUpdate = await resolvePlanTerms(supabase, parsed.data, current
    ? { plan_id: current.plan_id ?? null, plan_rate: current.plan_rate ?? null }
    : null)
  if ('error' in resolvedUpdate) return { error: resolvedUpdate.error }

  const { error } = await supabase
    .from('contracts')
    .update({ ...parsed.data, ...resolvedUpdate.terms, contract_type_data: toJson(contractTypeData) })
    .eq('id', id)
  if (error) return { error: error.message }

  await writeAuditLog({
    userId: user.id, orgId,
    action: 'update', entityType: 'contract',
    entityId: id, entityLabel: current?.contract_number ?? 'Договор',
  })

  revalidatePath('/contracts')
  revalidatePath('/analytics', 'page')
  revalidatePath(`/contracts/${id}`)
  redirect(`/contracts/${id}`)
}

export async function deleteContractAction(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const orgId = await requireOrgId().catch(() => null)

  const permError = await requirePermission(user.id, 'contracts', 'delete')
  if (permError) return permError

  const { error } = await supabase.from('contracts').delete().eq('id', id)
  if (error) return { error: error.message }

  if (orgId) {
    await writeAuditLog({
      userId: user.id, orgId,
      action: 'delete', entityType: 'contract',
      entityId: id, entityLabel: 'Договор',
    })
  }

  revalidatePath('/contracts')
  revalidatePath('/analytics', 'page')
  redirect('/contracts')
}

export async function updateContractStatusAction(id: string, status: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const valid = ['draft', 'generated', 'signed', 'completed', 'cancelled']
  if (!valid.includes(status)) return { error: 'Недопустимый статус' }

  const permError = await requirePermission(user.id, 'contracts', 'update')
  if (permError) return permError

  const { error } = await supabase.from('contracts').update({ status }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/contracts')
  revalidatePath('/analytics', 'page')
  revalidatePath(`/contracts/${id}`)
  return { success: true }
}

export async function restoreContractVersionAction(contractId: string, versionId: string) {
  const ctx = await getSessionContext()
  if (!ctx.ok) return { error: ctx.error }
  const { supabase, user, orgId } = ctx

  const { data: version } = await supabase
    .from('contract_versions')
    .select('version_data, version')
    .eq('id', versionId)
    .eq('contract_id', contractId)
    .single()

  if (!version?.version_data) return { error: 'Версия не найдена или не содержит данных' }

  const permError = await requirePermission(user.id, 'contracts', 'update')
  if (permError) return permError

  // Сохранить текущую перед восстановлением
  const { data: current } = await supabase
    .from('contracts').select('*').eq('id', contractId).single()

  if (current) {
    const { data: versions } = await supabase
      .from('contract_versions')
      .select('version')
      .eq('contract_id', contractId)
      .order('version', { ascending: false })
      .limit(1)

    const nextVersion = versions?.[0]?.version ? versions[0].version + 1 : 1
    const { error: versionError } = await supabase.from('contract_versions').insert({
      contract_id: contractId,
      version: nextVersion, version_data: current,
      created_by: user.id,
      note: `Автосохранение перед восстановлением версии ${version.version}`,
    })
    if (versionError) return { error: `Не удалось сохранить версию: ${versionError.message}` }
  }

  // version_data — снимок строки договора в jsonb. Служебные поля из него
  // исключаем: восстанавливаем содержимое, а не тождество записи.
  const snapshot = (version.version_data ?? {}) as Record<string, unknown>
  const { id: _id, created_at: _ca, updated_at: _ua, organization_id: _oid, ...rest } = snapshot
  // Снимок пришёл из jsonb, и его форма компилятору неизвестна. Сужаем к типу
  // строки договора одним осознанным приведением вместо каста всего к any:
  // так лишние ключи хотя бы не расползаются по коду.
  const restoreData = rest as Update<'contracts'>

  // Без updated_at: такой колонки у contracts нет. Раньше она сюда писалась,
  // PostgREST отвергал запрос, и восстановление версии договора не работало
  // вовсе — компилятор этого не видел из-за каста снимка к any.
  const restorePayload: Update<'contracts'> = restoreData

  const { error } = await supabase
    .from('contracts')
    .update(restorePayload)
    .eq('id', contractId)

  if (error) return { error: error.message }

  await writeAuditLog({
    userId: user.id, orgId,
    action: 'update', entityType: 'contract',
    entityId: contractId, entityLabel: 'Восстановление версии',
  })

  revalidatePath(`/contracts/${contractId}`)
  return { success: true }
}
