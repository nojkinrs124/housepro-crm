'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function createClientAction(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const values = {
    full_name: formData.get('full_name') as string,
    phone: formData.get('phone') as string || null,
    telegram: formData.get('telegram') as string || null,
    whatsapp: formData.get('whatsapp') as string || null,
    passport: formData.get('passport') as string || null,
    comment: formData.get('comment') as string || null,
    source: formData.get('source') as string || null,
    status: formData.get('status') as string || 'new',
    manager_id: user.id,
  }

  if (!values.full_name?.trim()) {
    return { error: 'ФИО обязательно' }
  }

  const { error } = await supabase.from('clients').insert(values)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/clients')
  redirect('/clients')
}

export async function updateClientAction(id: string, formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const values = {
    full_name: formData.get('full_name') as string,
    phone: formData.get('phone') as string || null,
    telegram: formData.get('telegram') as string || null,
    whatsapp: formData.get('whatsapp') as string || null,
    passport: formData.get('passport') as string || null,
    comment: formData.get('comment') as string || null,
    source: formData.get('source') as string || null,
    status: formData.get('status') as string || 'new',
  }

  const { error } = await supabase.from('clients').update(values).eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/clients')
  revalidatePath(`/clients/${id}`)
  redirect(`/clients/${id}`)
}

export async function deleteClientAction(id: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Проверяем права доступа (только admin может удалить)
  const { data: userRole } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (userRole?.role !== 'admin') {
    return { error: 'Только администраторы могут удалять клиентов' }
  }

  const { error } = await supabase.from('clients').delete().eq('id', id)
  
  if (error) {
    return { error: error.message }
  }

  revalidatePath('/clients')
  redirect('/clients')
}
