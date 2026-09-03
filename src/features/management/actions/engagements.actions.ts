'use server'

import { revalidatePath } from 'next/cache'
import { getSessionContext } from '@/lib/org'
import { requirePermission } from '@/lib/permissions'
import { rateLimitMutation } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'
import { validateEngagementTerms } from '@/features/plans/services/plan-terms'
import { advanceDealStage } from '@/lib/deal-automation'

type Result = { error?: string; success?: boolean; id?: string }

function str(v: FormDataEntryValue | null): string {
  return typeof v === 'string' ? v.trim() : ''
}

function num(v: FormDataEntryValue | null): number | null {
  const s = str(v)
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** Типы договоров, которыми оформляется управление объектом. */
const MANAGEMENT_CONTRACT_TYPES = ['property_management', 'sublease']
const SIGNED_STATUSES = ['generated', 'signed', 'completed']

/**
 * Заведение объекта в управлении после подписания договора.
 *
 * Обслуживание стартует в статусе `onboarding`: до закрытия акта приёма нет ни
 * начальных показаний, ни описи, а значит нельзя ни посчитать расход, ни
 * предъявить претензию по имуществу. Пустой акт создаётся сразу — чтобы его
 * было куда заполнять.
 */
export async function startEngagementAction(formData: FormData): Promise<Result> {
  const ctx = await getSessionContext()
  if (!ctx.ok) return { error: ctx.error }
  const { supabase, user, orgId } = ctx

  const rl = await rateLimitMutation(user.id, 'engagement')
  if (!rl.success) return { error: 'Слишком много запросов' }

  const permError = await requirePermission(user.id, 'contracts', 'create')
  if (permError) return permError

  const propertyId = str(formData.get('property_id'))
  const contractId = str(formData.get('contract_id'))
  const ownerContactId = str(formData.get('owner_contact_id'))
  const planId = str(formData.get('plan_id'))
  const dealId = str(formData.get('deal_id'))
  const startedAt = str(formData.get('started_at')) || new Date().toISOString().slice(0, 10)

  const terms = {
    settlement_scheme: str(formData.get('settlement_scheme')) || null,
    rate: num(formData.get('rate')),
    owner_fixed_amount: num(formData.get('owner_fixed_amount')),
    owner_payout_day: num(formData.get('owner_payout_day')),
  }

  if (!propertyId) return { error: 'Не выбран объект' }
  if (!ownerContactId) {
    return { error: 'Не указан собственник — без него не с кем вести взаиморасчёт' }
  }

  const invalid = validateEngagementTerms(terms)
  if (invalid) return { error: invalid }

  // Договор обязателен: управление без подписанного договора — это работа без
  // основания, а от договора берутся сроки и обязательства.
  if (!contractId) return { error: 'Не выбран договор управления' }

  const { data: contract } = await supabase
    .from('contracts')
    .select('id, contract_type, status, plan_id, plan_rate')
    .eq('id', contractId)
    .maybeSingle()

  if (!contract) return { error: 'Договор не найден' }
  if (!MANAGEMENT_CONTRACT_TYPES.includes(contract.contract_type)) {
    return { error: 'Выбранный договор не является договором управления или субаренды' }
  }
  if (!SIGNED_STATUSES.includes(contract.status)) {
    return { error: 'Договор управления ещё не подписан — принимать объект рано' }
  }

  // Уже действующее обслуживание по объекту означало бы два взаиморасчёта по
  // одной квартире. Уникальный индекс это тоже не пустит, но сообщение оттуда
  // человеку ничего не объясняет.
  const { data: existing } = await supabase
    .from('management_engagements')
    .select('id')
    .eq('property_id', propertyId)
    .is('ended_at', null)
    .maybeSingle()
  if (existing) {
    return { error: 'По этому объекту уже есть действующее обслуживание — завершите его или правьте существующее' }
  }

  // Лимит мелкого ремонта копируется из тарифа на момент старта: тариф могут
  // поправить, а условия действующего обслуживания меняться не должны.
  const effectivePlanId = planId || contract.plan_id || null
  let repairLimit: number | null = null
  if (effectivePlanId) {
    const { data: plan } = await supabase
      .from('service_plans')
      .select('repair_limit')
      .eq('id', effectivePlanId)
      .maybeSingle()
    repairLimit = plan?.repair_limit ?? null
  }

  const { data: engagement, error } = await supabase
    .from('management_engagements')
    .insert({
      organization_id: orgId,
      property_id: propertyId,
      owner_contact_id: ownerContactId,
      contract_id: contractId,
      plan_id: effectivePlanId,
      deal_id: dealId || null,
      started_at: startedAt,
      status: 'onboarding',
      repair_limit: repairLimit,
      ...terms,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  const { error: handoverError } = await supabase.from('property_handovers').insert({
    organization_id: orgId,
    engagement_id: engagement.id,
    created_by: user.id,
  })
  if (handoverError) return { error: `Обслуживание заведено, но акт приёма создать не удалось: ${handoverError.message}` }

  // Сделка, которая привела к управлению, переходит на стадию приёмки.
  if (dealId) await advanceDealStage(supabase, dealId, 'contract')

  await writeAuditLog({
    userId: user.id, orgId,
    action: 'create', entityType: 'management_engagement',
    entityId: engagement.id, entityLabel: 'Объект принят в управление',
  })

  revalidatePath('/management')
  revalidatePath(`/management/${propertyId}`)
  return { success: true, id: engagement.id }
}

/**
 * Дозаполнение или правка условий расчёта.
 *
 * Нужно не только для правок: два объекта, перенесённые при переходе на новую
 * модель, приехали без собственника и схемы — иначе их пришлось бы либо
 * выдумать, либо выбросить записи.
 */
export async function updateEngagementTermsAction(formData: FormData): Promise<Result> {
  const ctx = await getSessionContext()
  if (!ctx.ok) return { error: ctx.error }
  const { supabase, user, orgId } = ctx

  const permError = await requirePermission(user.id, 'contracts', 'update')
  if (permError) return permError

  const id = str(formData.get('id'))
  if (!id) return { error: 'Обслуживание не найдено' }

  const ownerContactId = str(formData.get('owner_contact_id'))
  if (!ownerContactId) {
    return { error: 'Не указан собственник — без него не с кем вести взаиморасчёт' }
  }

  const terms = {
    settlement_scheme: str(formData.get('settlement_scheme')) || null,
    rate: num(formData.get('rate')),
    owner_fixed_amount: num(formData.get('owner_fixed_amount')),
    owner_payout_day: num(formData.get('owner_payout_day')),
  }

  const invalid = validateEngagementTerms(terms)
  if (invalid) return { error: invalid }

  const planId = str(formData.get('plan_id'))
  let repairLimit: number | null = num(formData.get('repair_limit'))
  if (planId && repairLimit === null) {
    const { data: plan } = await supabase
      .from('service_plans').select('repair_limit').eq('id', planId).maybeSingle()
    repairLimit = plan?.repair_limit ?? null
  }

  const { data: engagement, error } = await supabase
    .from('management_engagements')
    .update({
      owner_contact_id: ownerContactId,
      plan_id: planId || null,
      contract_id: str(formData.get('contract_id')) || null,
      repair_limit: repairLimit,
      started_at: str(formData.get('started_at')) || undefined,
      notes: str(formData.get('notes')) || null,
      ...terms,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('property_id')
    .single()

  if (error) return { error: error.message }

  await writeAuditLog({
    userId: user.id, orgId,
    action: 'update', entityType: 'management_engagement',
    entityId: id, entityLabel: 'Условия обслуживания изменены',
  })

  revalidatePath('/management')
  revalidatePath(`/management/${engagement.property_id}`)
  return { success: true }
}

/**
 * Смена состояния обслуживания.
 *
 * `active` доступен только после закрытия акта приёма: обслуживание без
 * начальных показаний и описи нельзя считать налаженным — расход считать не от
 * чего, а претензию по имуществу предъявить не с чем.
 */
export async function setEngagementStatusAction(
  id: string,
  status: 'onboarding' | 'active' | 'paused' | 'ended',
): Promise<Result> {
  const ctx = await getSessionContext()
  if (!ctx.ok) return { error: ctx.error }
  const { supabase, user, orgId } = ctx

  const permError = await requirePermission(user.id, 'contracts', 'update')
  if (permError) return permError

  const { data: engagement } = await supabase
    .from('management_engagements')
    .select('id, property_id, status, settlement_scheme, owner_contact_id, handover:property_handovers(completed_at)')
    .eq('id', id)
    .maybeSingle()
  if (!engagement) return { error: 'Обслуживание не найдено' }

  if (status === 'active') {
    if (!engagement.owner_contact_id) {
      return { error: 'Не указан собственник — заполните условия расчёта, прежде чем запускать обслуживание' }
    }
    if (!engagement.settlement_scheme) {
      return { error: 'Не выбрана схема расчёта — заполните условия, прежде чем запускать обслуживание' }
    }
    const handover = Array.isArray(engagement.handover) ? engagement.handover[0] : engagement.handover
    if (!handover?.completed_at) {
      return { error: 'Акт приёма не закрыт: нужны начальные показания счётчиков и опись имущества' }
    }
  }

  const { error } = await supabase
    .from('management_engagements')
    .update({
      status,
      // Завершение обслуживания закрывает период — иначе уникальный индекс не
      // даст принять этот же объект заново.
      ended_at: status === 'ended' ? new Date().toISOString().slice(0, 10) : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: error.message }

  await writeAuditLog({
    userId: user.id, orgId,
    action: 'update', entityType: 'management_engagement',
    entityId: id, entityLabel: `Статус обслуживания: ${status}`,
  })

  revalidatePath('/management')
  revalidatePath(`/management/${engagement.property_id}`)
  return { success: true }
}
