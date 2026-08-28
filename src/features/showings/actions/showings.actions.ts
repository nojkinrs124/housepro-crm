'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireOrgId } from '@/lib/org'
import { requirePermission } from '@/lib/permissions'

const VALID_STATUSES = ['planned', 'completed', 'cancelled', 'no_show']

export async function createShowingAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const scheduled_at = formData.get('scheduled_at') as string
  if (!scheduled_at) return { error: 'Укажите дату и время показа' }

  const permError = await requirePermission(user.id, 'showings', 'create')
  if (permError) return permError

  const values = {
    organization_id: orgId,
    scheduled_at,
    agent_id:    (formData.get('agent_id')    as string) || user.id,
    property_id: (formData.get('property_id') as string) || null,
    lead_id:     (formData.get('lead_id')     as string) || null,
    deal_id:     (formData.get('deal_id')     as string) || null,
    contact_id:  (formData.get('contact_id')  as string) || null,
    duration_min: formData.get('duration_min') ? Number(formData.get('duration_min')) : 30,
    feedback:    (formData.get('feedback') as string)?.trim() || null,
    created_by:  user.id,
    status: 'planned' as const,
  }

  const { data, error } = await supabase.from('showings').insert(values).select('id').single()
  if (error) return { error: error.message }

  revalidatePath('/showings')
  redirect(`/showings/${data.id}`)
}

export async function updateShowingStatusAction(id: string, status: string, formData?: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }
  if (!VALID_STATUSES.includes(status)) return { error: 'Недопустимый статус' }

  const permError = await requirePermission(user.id, 'showings', 'update')
  if (permError) return permError

  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }

  let result: string | null = null
  if (formData) {
    result = (formData.get('result') as string) || null
    const feedback = (formData.get('feedback') as string)?.trim() || null
    const next_step = (formData.get('next_step') as string)?.trim() || null
    if (result)    updates.result    = result
    if (feedback)  updates.feedback  = feedback
    if (next_step) updates.next_step = next_step
  }

  const { data: updated, error } = await supabase
    .from('showings')
    .update(updates)
    .eq('id', id)
    .select('lead_id, agent_id')
    .single()

  if (error) return { error: error.message }

  // Автоматизация: показ завершён с результатом — двигаем связанный лид без лишнего клика.
  if (status === 'completed' && result && updated?.lead_id) {
    if (result === 'interested') {
      const orgId = await requireOrgId().catch(() => null)
      if (orgId) {
        const deadline = new Date()
        deadline.setDate(deadline.getDate() + 2)
        await supabase.from('tasks').insert({
          title: 'Связаться повторно по показу',
          description: 'Клиент заинтересовался объектом на показе — нужно созвониться и обсудить дальнейшие шаги.',
          priority: 'medium',
          status: 'todo',
          deadline: deadline.toISOString(),
          created_by: user.id,
          assigned_to: updated.agent_id ?? user.id,
          lead_id: updated.lead_id,
          organization_id: orgId,
        })
      }
    } else if (result === 'not_interested') {
      // .neq('status','converted') — не закрываем лид, который уже стал клиентом
      // (например, показ по нему провели повторно уже после конвертации).
      await supabase.from('leads')
        .update({ status: 'closed', updated_at: new Date().toISOString() })
        .eq('id', updated.lead_id)
        .neq('status', 'converted')
      revalidatePath('/leads')
      revalidatePath(`/leads/${updated.lead_id}`)
    }
  }

  revalidatePath('/showings')
  revalidatePath(`/showings/${id}`)
  revalidatePath('/tasks')
  return { success: true }
}

export async function deleteShowingAction(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const permError = await requirePermission(user.id, 'showings', 'delete')
  if (permError) return permError

  const { error } = await supabase.from('showings').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/showings')
  redirect('/showings')
}
