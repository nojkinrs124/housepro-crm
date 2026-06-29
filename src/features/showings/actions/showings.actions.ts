'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireOrgId } from '@/lib/org'

const VALID_STATUSES = ['planned', 'completed', 'cancelled', 'no_show']

export async function createShowingAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const scheduled_at = formData.get('scheduled_at') as string
  if (!scheduled_at) return { error: 'Укажите дату и время показа' }

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

  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }

  if (formData) {
    const result  = (formData.get('result')    as string) || null
    const feedback = (formData.get('feedback') as string)?.trim() || null
    const next_step = (formData.get('next_step') as string)?.trim() || null
    if (result)    updates.result    = result
    if (feedback)  updates.feedback  = feedback
    if (next_step) updates.next_step = next_step
  }

  const { error } = await supabase.from('showings').update(updates).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/showings')
  revalidatePath(`/showings/${id}`)
  return { success: true }
}

export async function deleteShowingAction(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { error } = await supabase.from('showings').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/showings')
  redirect('/showings')
}
