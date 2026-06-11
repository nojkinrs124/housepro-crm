'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const VALID_STATUSES = ['new','contacted','showing','searching','converted','closed','interested','rejected']

function extractLeadFields(formData: FormData, userId?: string) {
  return {
    full_name:       (formData.get('full_name')  as string)?.trim() || null,
    phone:           (formData.get('phone')       as string)?.trim() || null,
    email:           (formData.get('email')       as string)?.trim() || null,
    telegram:        (formData.get('telegram')    as string)?.trim() || null,
    whatsapp:        (formData.get('whatsapp')    as string)?.trim() || null,
    source:          (formData.get('source')      as string) || null,
    comment:         (formData.get('comment')     as string)?.trim() || null,
    deal_type:       (formData.get('deal_type')   as string) || null,
    property_type:   (formData.get('property_type') as string) || null,
    rooms:           formData.get('rooms')      ? Number(formData.get('rooms'))      : null,
    budget_min:      formData.get('budget_min') ? Number(formData.get('budget_min')) : null,
    budget_max:      formData.get('budget_max') ? Number(formData.get('budget_max')) : null,
    area_min:        formData.get('area_min')   ? Number(formData.get('area_min'))   : null,
    area_max:        formData.get('area_max')   ? Number(formData.get('area_max'))   : null,
    district:        (formData.get('district')    as string)?.trim() || null,
    next_contact_at: (formData.get('next_contact_at') as string) || null,
    assigned_to:     (formData.get('assigned_to') as string) || userId || null,
  }
}

export async function createLeadAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const fields = extractLeadFields(formData, user.id)

  const { data: lead, error } = await supabase
    .from('leads')
    .insert({ ...fields, status: 'new' })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/leads')
  redirect(`/leads/${lead.id}`)
}

export async function updateLeadAction(id: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const fields = extractLeadFields(formData)

  const { error } = await supabase
    .from('leads')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/leads')
  revalidatePath(`/leads/${id}`)
  redirect(`/leads/${id}`)
}

export async function updateLeadStatusAction(id: string, status: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }
  if (!VALID_STATUSES.includes(status)) return { error: `Недопустимый статус: ${status}` }

  const { error } = await supabase
    .from('leads')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/leads')
  revalidatePath(`/leads/${id}`)
  return { success: true }
}

export async function addLeadActivityAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const lead_id = formData.get('lead_id') as string
  const type    = formData.get('type') as string
  const content = (formData.get('content') as string)?.trim() || null
  const result  = (formData.get('result')  as string)?.trim() || null
  const scheduled_at = (formData.get('scheduled_at') as string) || null

  if (!lead_id || !type) return { error: 'Некорректные данные' }

  const { error } = await supabase.from('lead_activities').insert({
    lead_id, user_id: user.id, type, content, result, scheduled_at,
  })

  if (error) return { error: error.message }

  // Обновляем next_contact_at если указано время следующего контакта
  if (scheduled_at) {
    await supabase.from('leads').update({
      next_contact_at: scheduled_at,
      updated_at: new Date().toISOString(),
    }).eq('id', lead_id)
  }

  revalidatePath(`/leads/${lead_id}`)
  return { success: true }
}

export async function convertLeadToClient(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { data: lead } = await supabase.from('leads').select('*').eq('id', id).single()
  if (!lead) return { error: 'Лид не найден' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const l = lead as any

  const { data: contact, error } = await supabase
    .from('contacts')
    .insert({
      full_name: l.full_name || 'Без имени',
      phone:     l.phone    || null,
      email:     l.email    || null,
      telegram:  l.telegram || null,
      whatsapp:  l.whatsapp || null,
      source:    l.source   || null,
      comment:   l.comment  || null,
      role:   'client',
      status: 'new',
    })
    .select()
    .single()

  if (error) return { error: error.message }

  await supabase
    .from('leads')
    .update({ status: 'converted', updated_at: new Date().toISOString() })
    .eq('id', id)

  revalidatePath('/leads')
  revalidatePath('/contacts')
  redirect(`/contacts/${contact.id}`)
}

export async function deleteLeadAction(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  await supabase.from('leads').delete().eq('id', id)

  revalidatePath('/leads')
  redirect('/leads')
}
