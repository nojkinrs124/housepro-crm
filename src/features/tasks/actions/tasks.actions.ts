'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireOrgId } from '@/lib/org'
import { requirePermission } from '@/lib/permissions'
import { emailTaskAssigned } from '@/lib/email/send'

const VALID_TASK_STATUSES = ['todo', 'in_progress', 'done', 'cancelled']
const VALID_TASK_PRIORITIES = ['low', 'medium', 'high']

export async function createTaskAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const priority = formData.get('priority') as string
  if (!VALID_TASK_PRIORITIES.includes(priority)) {
    return { error: `Недопустимый приоритет: ${priority}` }
  }

  const values = {
    title: (formData.get('title') as string)?.trim(),
    description: formData.get('description') as string || null,
    priority,
    deadline: formData.get('deadline') as string || null,
    status: 'todo' as const,
    created_by: user.id,
    assigned_to: formData.get('assigned_to') as string || user.id,
    lead_id: formData.get('lead_id') as string || null,
    // Связь задачи с человеком — через контакт. Колонка называлась client_id и
    // указывала на удалённую таблицу clients; owner_id писался всегда пустым,
    // поля для него в форме нет.
    contact_id: formData.get('contact_id') as string || null,
    deal_id: formData.get('deal_id') as string || null,
    property_id: formData.get('property_id') as string || null,
    contract_id: formData.get('contract_id') as string || null,
    payment_id: formData.get('payment_id') as string || null,
    organization_id: orgId,
  }

  if (!values.title) {
    return { error: 'Название обязательно' }
  }

  const permError = await requirePermission(user.id, 'tasks', 'create')
  if (permError) return permError

  const { data: task, error } = await supabase.from('tasks').insert(values).select('id').single()
  if (error) return { error: error.message }

  // Письмо исполнителю — только если задачу назначили не себе (emailTaskAssigned
  // сам отсеет этот случай по actorId) и почта настроена.
  await emailTaskAssigned(
    orgId,
    { id: task.id, title: values.title, deadline: values.deadline, description: values.description, assigned_to: values.assigned_to },
    user.id
  )

  revalidatePath('/tasks')
  redirect('/tasks')
}

/**
 * Общая форма ответа перетаскивания на Kanban-доске: клиенту нужно знать
 * только, откатывать ли оптимистичное перемещение карточки.
 */
export interface StatusUpdateResult {
  error?: string
  success?: boolean
}

export async function updateTaskStatusAction(
  id: string,
  status: string
): Promise<StatusUpdateResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Не авторизован' }
  }

  if (!VALID_TASK_STATUSES.includes(status)) {
    return { error: `Недопустимый статус: ${status}` }
  }

  const permError = await requirePermission(user.id, 'tasks', 'update')
  if (permError) return permError

  const { error } = await supabase
    .from('tasks')
    .update({ status })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/tasks')
  return { success: true }
}

export async function deleteTaskAction(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Проверяем права доступа
  const permError = await requirePermission(user.id, 'tasks', 'delete')
  if (permError) return permError

  const { error } = await supabase.from('tasks').delete().eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/tasks')
  redirect('/tasks')
}
