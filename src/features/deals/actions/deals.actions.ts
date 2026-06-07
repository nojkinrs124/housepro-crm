'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const VALID_DEAL_STATUSES = ['new', 'showing', 'negotiation', 'contract', 'payment', 'completed', 'cancelled']
const VALID_DEAL_TYPES = ['rent', 'sale', 'management', 'commercial', 'subrent']

export async function createDealAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const deal_type = formData.get('deal_type') as string
  if (!VALID_DEAL_TYPES.includes(deal_type)) {
    return { error: `Недопустимый тип сделки: ${deal_type}` }
  }

  const values = {
    owner_contact_id: formData.get('owner_contact_id') as string || null,
    client_contact_id: formData.get('client_contact_id') as string || null,
    property_id: formData.get('property_id') as string || null,
    deal_type,
    amount: formData.get('amount') ? Number(formData.get('amount')) : null,
    commission: formData.get('commission') ? Number(formData.get('commission')) : null,
    notes: formData.get('notes') as string || null,
    status: 'new' as const,
    manager_id: user.id,
  }

  const { error } = await supabase.from('deals').insert(values)
  if (error) return { error: error.message }

  revalidatePath('/deals')
  redirect('/deals')
}

export async function updateDealStatusAction(id: string, status: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Не авторизован' }
  }

  if (!VALID_DEAL_STATUSES.includes(status)) {
    return { error: `Недопустимый статус сделки: ${status}` }
  }

  const { error } = await supabase
    .from('deals')
    .update({ status })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/deals')
  return { success: true }
}

export async function updateDealAction(id: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const deal_type = formData.get('deal_type') as string
  if (!VALID_DEAL_TYPES.includes(deal_type)) {
    return { error: `Недопустимый тип сделки: ${deal_type}` }
  }

  const status = formData.get('status') as string
  if (!VALID_DEAL_STATUSES.includes(status)) {
    return { error: `Недопустимый статус: ${status}` }
  }

  const values = {
    owner_contact_id: (formData.get('owner_contact_id') as string) || null,
    client_contact_id: (formData.get('client_contact_id') as string) || null,
    property_id: (formData.get('property_id') as string) || null,
    deal_type,
    status,
    amount: formData.get('amount') ? Number(formData.get('amount')) : null,
    commission: formData.get('commission') ? Number(formData.get('commission')) : null,
    notes: (formData.get('notes') as string) || null,
  }

  const { error } = await supabase.from('deals').update(values).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/deals')
  revalidatePath(`/deals/${id}`)
  redirect(`/deals/${id}`)
}

export async function deleteDealAction(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  await supabase.from('deals').delete().eq('id', id)

  revalidatePath('/deals')
  redirect('/deals')
}
