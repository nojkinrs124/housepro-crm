'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const VALID_DEAL_STATUSES = ['new', 'in_progress', 'completed', 'cancelled']
const VALID_DEAL_TYPES = ['rent', 'sale', 'management', 'subrent']

export async function createDealAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const deal_type = formData.get('deal_type') as string
  if (!VALID_DEAL_TYPES.includes(deal_type)) {
    return { error: `Недопустимый тип сделки: ${deal_type}` }
  }

  const values = {
    client_id: formData.get('client_id') as string || null,
    owner_id: formData.get('owner_id') as string || null,
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
