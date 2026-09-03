'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'
import { grantFor, currentScope } from '@/features/portal/services/access.service'
import { REQUEST_CATEGORY_LABELS } from '@/features/portal/config/request-categories'

type Result = { error?: string; success?: boolean }

/**
 * Заявка арендатора на бытовую услугу.
 *
 * Сразу порождает задачу ответственному: между подачей и появлением работы в
 * CRM не должно быть ни одного ручного действия (SC-009). Если задачу создать
 * не удалось, заявка всё равно остаётся — потерять обращение жильца хуже, чем
 * остаться без задачи, и заявка видна в своём разделе.
 */
export async function createServiceRequestAction(formData: FormData): Promise<Result> {
  const propertyId = typeof formData.get('property_id') === 'string' ? String(formData.get('property_id')) : ''
  const category = typeof formData.get('category') === 'string' ? String(formData.get('category')) : ''
  const description = (typeof formData.get('description') === 'string' ? String(formData.get('description')) : '').trim()

  if (!propertyId) return { error: 'Объект не выбран' }
  if (!REQUEST_CATEGORY_LABELS[category]) return { error: 'Выберите, что случилось' }
  if (description.length < 5) {
    return { error: 'Опишите проблему хотя бы парой слов — по одной категории мастера не выбрать' }
  }

  const scope = await currentScope()
  const grant = await grantFor(propertyId, 'tenant')
  if (!scope || !grant) return { error: 'Объект недоступен' }

  const limited = await rateLimit(`portal:request:${grant.propertyId}`, { limit: 5, windowSeconds: 3600 })
  if (!limited.success) {
    return { error: 'Слишком много заявок за час. Если случилось что-то срочное — позвоните менеджеру.' }
  }

  const supabaseAdmin = getSupabaseAdmin()

  const { data: request, error } = await supabaseAdmin
    .from('service_requests')
    .insert({
      organization_id: grant.organizationId,
      engagement_id: grant.engagementId,
      property_id: grant.propertyId,
      contact_id: scope.contactId,
      category,
      description,
      status: 'new',
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  const { data: property } = await supabaseAdmin
    .from('properties')
    .select('title, manager_id')
    .eq('id', grant.propertyId)
    .maybeSingle()

  const { data: task } = await supabaseAdmin
    .from('tasks')
    .insert({
      title: `${REQUEST_CATEGORY_LABELS[category]} — ${property?.title ?? 'объект'}`,
      description: `Заявка арендатора: ${description}`,
      status: 'todo',
      priority: 'high',
      due_date: new Date().toISOString().slice(0, 10),
      property_id: grant.propertyId,
      engagement_id: grant.engagementId,
      assigned_to: property?.manager_id ?? null,
      organization_id: grant.organizationId,
    })
    .select('id')
    .single()

  if (task) {
    await supabaseAdmin.from('service_requests').update({ task_id: task.id }).eq('id', request.id)
  }

  revalidatePath(`/cabinet/tenant/${grant.propertyId}`)
  revalidatePath('/requests')
  return { success: true }
}
