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
import { collectDealFacts, canMoveStage } from '@/features/directions/services/transitions'
import { stageLabel, stagesOf } from '@/features/directions/config/directions'

// Список допустимых стадий больше не хранится здесь: он зависит от направления
// работы и живёт в src/features/directions/config/directions.ts. Здесь только
// проверка перехода — она же объясняет отказ.

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

  // Первая стадия зависит от направления: в подборе для арендатора это
  // «Обращение», в остальных — «Поиск и контакт».
  const firstStage = stagesOf(parsed.data.deal_type)[0]?.value ?? 'sourcing'

  const { data: deal, error } = await supabase.from('deals').insert({
    ...parsed.data,
    status: firstStage,
    manager_id: user.id,
    organization_id: orgId,
  }).select('id').single()
  if (error) return { error: error.message }

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
  status: string
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

  const { error } = await supabase
    .from('deals')
    .update({ status })
    .eq('id', id)

  if (error) return { error: error.message }

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

  if (error) return { error: error.message }

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

  await supabase.from('deals').delete().eq('id', id)

  revalidatePath('/deals')
  redirect('/deals')
}
