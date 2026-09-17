'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DealSchema } from '@/lib/schemas'
import { rateLimitCreate } from '@/lib/rate-limit'
import { requireOrgId } from '@/lib/org'
import { writeAuditLog } from '@/lib/audit'
import { dispatchWebhook } from '@/lib/webhooks'
import { requirePermission } from '@/lib/permissions'
import { friendlyDbError } from '@/lib/errors'
import { collectDealFacts, canMoveStage } from '@/features/directions/services/transitions'
import { STAGE_CANCELLED, stageLabel, stagesOf, terminalStageOf } from '@/features/directions/config/directions'
import { propertyStatusAfterDeal } from '@/features/deals/services/deal-completion'
import { revalidateSiteForProperty } from '@/features/site/lib/revalidate'
import { defaultPlanFor } from '@/features/plans/data/deal-plans'

// Список допустимых стадий больше не хранится здесь: он зависит от направления
// работы и живёт в src/features/directions/config/directions.ts. Здесь только
// проверка перехода — она же объясняет отказ.

/**
 * Сделка без сторон — пустая карточка, по которой нечего делать (проход
 * 17.09.2026, TS-0/SL-9): подбору нужен клиент, остальным — собственник,
 * продаже — ещё и объект, потому что вся её воронка держится на объекте.
 */
function validateDealParties(d: { deal_type: string; owner_contact_id: string | null; client_contact_id: string | null; property_id: string | null }): string | null {
  if (d.deal_type === 'tenant_search') {
    return d.client_contact_id ? null : 'Укажите клиента — подбор ведётся для конкретного арендатора'
  }
  if (!d.owner_contact_id) return 'Укажите собственника — с ним заключается договор на этом направлении'
  if (d.deal_type === 'sale' && !d.property_id) {
    return 'Для продажи нужен объект: без него не пройти публикацию и показы. Если ищете объект для покупателя — заведите сделку «Подбор»'
  }
  return null
}

export async function createDealAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const rl = await rateLimitCreate(user.id, 'deal')
  if (!rl.success) return { error: 'Слишком много запросов. Подождите минуту.' }

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const parsed = DealSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first.message, fields: parsed.error.flatten().fieldErrors }
  }

  const permError = await requirePermission(user.id, 'deals', 'create')
  if (permError) return permError

  const partiesError = validateDealParties(parsed.data)
  if (partiesError) return { error: partiesError }

  // Первая стадия зависит от направления: в подборе для арендатора это
  // «Обращение», в остальных — «Поиск и контакт».
  const firstStage = stagesOf(parsed.data.deal_type)[0]?.value ?? 'sourcing'

  // Тариф не выбран, а у направления он один — берём его: без тарифа сделка
  // упрётся в `plan_selected`, а вознаграждение не посчитается.
  const planId = parsed.data.plan_id ?? await defaultPlanFor(supabase, parsed.data.deal_type)

  const { data: deal, error } = await supabase.from('deals').insert({
    ...parsed.data,
    plan_id: planId,
    status: firstStage,
    manager_id: user.id,
    organization_id: orgId,
  }).select('id').single()
  if (error) return { error: friendlyDbError(error, { entity: 'сделку' }) }

  await writeAuditLog({
    userId: user.id, orgId,
    action: 'create', entityType: 'deal',
    entityId: deal.id, entityLabel: `Сделка (${parsed.data.deal_type})`,
  })

  dispatchWebhook(orgId, 'deal.created', {
    id: deal.id, deal_type: parsed.data.deal_type, amount: parsed.data.amount,
  })

  revalidatePath('/deals')
  revalidatePath('/analytics', 'page')
  redirect('/deals')
}

/**
 * Общая форма ответа перетаскивания на Kanban-доске: клиенту нужно знать
 * только, откатывать ли оптимистичное перемещение карточки.
 */
export interface StatusUpdateResult {
  error?: string
  success?: boolean
}

export async function updateDealStatusAction(
  id: string,
  status: string,
  cancelReason?: string,
): Promise<StatusUpdateResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const permError = await requirePermission(user.id, 'deals', 'update')
  if (permError) return permError

  // Проверка идёт по данным сделки, а не по списку допустимых значений: стадия
  // должна принадлежать направлению, обязательные пункты текущей стадии должны
  // быть закрыты, а предусловия целевой — выполнены. Отказ называет причину.
  const facts = await collectDealFacts(supabase, id)
  if (!facts) return { error: 'Сделка не найдена' }

  const verdict = canMoveStage(facts, status)
  if (!verdict.allowed) return { error: verdict.reason }

  const cancelling = status === STAGE_CANCELLED.value
  if (cancelling && !cancelReason?.trim()) {
    return { error: 'Укажите причину отмены — без неё непонятно, что пошло не так и стоит ли возвращаться к клиенту' }
  }

  const { error } = await supabase
    .from('deals')
    .update(cancelling
      ? { status, cancel_reason: cancelReason!.trim() }
      : facts.status === STAGE_CANCELLED.value ? { status, cancel_reason: null } : { status })
    .eq('id', id)

  if (error) return { error: friendlyDbError(error, { entity: 'стадию', verb: 'изменить' }) }

  // Доведённая до конца работа меняет судьбу объекта: сданный объект не должен
  // выгружаться на площадки как свободный (проход 17.09.2026, RA-11/DB-2).
  if (status === terminalStageOf(facts.deal_type) && facts.property_id) {
    const nextStatus = propertyStatusAfterDeal(facts.deal_type)
    if (nextStatus) {
      await supabase.from('properties')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', facts.property_id)
        .in('status', ['available', 'reserved'])
      revalidateSiteForProperty(facts.property_id)
      revalidatePath(`/properties/${facts.property_id}`)
    }
  }

  await writeAuditLog({
    userId: user.id,
    orgId: await requireOrgId().catch(() => ''),
    action: 'update',
    entityType: 'deal',
    entityId: id,
    entityLabel: `Стадия: ${stageLabel(facts.deal_type, status)}`,
  })

  revalidatePath('/deals')
  revalidatePath(`/deals/${id}`)
  revalidatePath('/analytics', 'page')
  return { success: true }
}

export async function updateDealAction(id: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const parsed = DealSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first.message, fields: parsed.error.flatten().fieldErrors }
  }

  const permError = await requirePermission(user.id, 'deals', 'update')
  if (permError) return permError

  const { error } = await supabase
    .from('deals')
    .update(parsed.data)
    .eq('id', id)

  if (error) return { error: friendlyDbError(error, { entity: 'сделку' }) }

  revalidatePath('/deals')
  revalidatePath(`/deals/${id}`)
  redirect(`/deals/${id}`)
}

export async function deleteDealAction(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const permError = await requirePermission(user.id, 'deals', 'delete')
  if (permError) return permError

  // Результат раньше не проверялся: при отказе RLS или FK экшен всё равно
  // делал redirect, и сделка «удалялась» только на экране.
  const { error } = await supabase.from('deals').delete().eq('id', id)
  if (error) return { error: friendlyDbError(error, { entity: 'сделку', verb: 'удалить' }) }

  await writeAuditLog({
    userId: user.id,
    orgId: await requireOrgId().catch(() => ''),
    action: 'delete', entityType: 'deal', entityId: id, entityLabel: 'Сделка',
  })

  revalidatePath('/deals')
  redirect('/deals')
}
