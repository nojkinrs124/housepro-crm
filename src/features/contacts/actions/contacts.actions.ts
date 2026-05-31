'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ContactRole } from '@/types/database'

const VALID_ROLES: ContactRole[] = ['client', 'owner', 'both']

export async function createContactAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Не авторизован' }
  }

  const full_name = (formData.get('full_name') as string)?.trim()
  const phone = (formData.get('phone') as string)?.trim() || null
  const email = (formData.get('email') as string)?.trim() || null
  const role = formData.get('role') as string
  const source = formData.get('source') as string || null
  const comment = (formData.get('comment') as string)?.trim() || null

  if (!full_name || !role) {
    return { error: 'Заполните обязательные поля' }
  }

  if (!VALID_ROLES.includes(role as ContactRole)) {
    return { error: 'Неверная роль' }
  }

  const { data, error } = await supabase
    .from('contacts')
    .insert({
      full_name,
      phone,
      email,
      role: role as ContactRole,
      source,
      comment,
      status: 'new',
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/contacts')
  return { success: true, data }
}

export async function updateContactAction(contactId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Не авторизован' }
  }

  const full_name = (formData.get('full_name') as string)?.trim()
  const phone = (formData.get('phone') as string)?.trim() || null
  const email = (formData.get('email') as string)?.trim() || null
  const telegram = (formData.get('telegram') as string)?.trim() || null
  const whatsapp = (formData.get('whatsapp') as string)?.trim() || null
  const passport = (formData.get('passport') as string)?.trim() || null
  const birth_date = (formData.get('birth_date') as string) || null
  const role = formData.get('role') as string
  const status = formData.get('status') as string || 'new'
  const comment = (formData.get('comment') as string)?.trim() || null
  const country = (formData.get('country') as string)?.trim() || null
  const region = (formData.get('region') as string)?.trim() || null
  const city = (formData.get('city') as string)?.trim() || null
  const street = (formData.get('street') as string)?.trim() || null
  const house_number = (formData.get('house_number') as string)?.trim() || null
  const building = (formData.get('building') as string)?.trim() || null
  const apartment = (formData.get('apartment') as string)?.trim() || null

  if (!full_name || !role) {
    return { error: 'Заполните обязательные поля' }
  }

  if (!VALID_ROLES.includes(role as ContactRole)) {
    return { error: 'Неверная роль' }
  }

  const { error } = await supabase
    .from('contacts')
    .update({
      full_name,
      phone,
      email,
      telegram,
      whatsapp,
      passport,
      birth_date,
      role: role as ContactRole,
      status: status as any,
      comment,
      country,
      region,
      city,
      street,
      house_number,
      building,
      apartment,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contactId)

  if (error) return { error: error.message }

  revalidatePath('/contacts')
  return { success: true }
}

export async function deleteContactAction(contactId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Не авторизован' }
  }

  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', contactId)

  if (error) return { error: error.message }

  revalidatePath('/contacts')
  return { success: true }
}
