'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const VALID_LEAD_STATUSES = ['new', 'contacted', 'interested', 'converted', 'rejected']

export async function createLeadAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const values = {
    full_name: (formData.get('full_name') as string)?.trim() || null,
    phone: formData.get('phone') as string || null,
    telegram: formData.get('telegram') as string || null,
    source: formData.get('source') as string || null,
    comment: formData.get('comment') as string || null,
    status: 'new' as const,
    assigned_to: user.id,
  }

  const { error } = await supabase.from('leads').insert(values)
  if (error) return { error: error.message }

  revalidatePath('/leads')
  redirect('/leads')
}

export async function updateLeadStatusAction(id: string, status: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Не авторизован' }
  }

  if (!VALID_LEAD_STATUSES.includes(status)) {
    return { error: `Недопустимый статус лида: ${status}` }
  }

  const { error } = await supabase
    .from('leads')
    .update({ status })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/leads')
  return { success: true }
}

export async function convertLeadToClient(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { data: lead } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .single()

  if (!lead) return { error: 'Лид не найден' }

  // Создаём клиента из лида
  const { data: client, error } = await supabase
    .from('clients')
    .insert({
      full_name: lead.full_name || 'Без имени',
      phone: lead.phone,
      telegram: lead.telegram,
      whatsapp: lead.whatsapp,
      source: lead.source,
      comment: lead.comment,
      status: 'new',
      manager_id: user.id,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  // Помечаем лид как конвертированный
  await supabase
    .from('leads')
    .update({ status: 'converted' })
    .eq('id', id)

  revalidatePath('/leads')
  revalidatePath('/clients')
  redirect(`/clients/${client.id}`)
}
