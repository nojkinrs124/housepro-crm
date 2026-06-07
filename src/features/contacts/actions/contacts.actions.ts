'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { ContactRole } from '@/types/database'

const VALID_ROLES: ContactRole[] = ['client', 'owner', 'both']

function getContactFields(formData: FormData) {
  return {
    full_name: (formData.get('full_name') as string)?.trim(),
    phone: (formData.get('phone') as string)?.trim() || null,
    email: (formData.get('email') as string)?.trim() || null,
    telegram: (formData.get('telegram') as string)?.trim() || null,
    whatsapp: (formData.get('whatsapp') as string)?.trim() || null,
    birth_date: (formData.get('birth_date') as string) || null,
    role: formData.get('role') as string,
    status: (formData.get('status') as string) || 'new',
    source: (formData.get('source') as string) || null,
    comment: (formData.get('comment') as string)?.trim() || null,
    // Passport fields
    passport_series: (formData.get('passport_series') as string)?.trim() || null,
    passport_number: (formData.get('passport_number') as string)?.trim() || null,
    passport_issued_date: (formData.get('passport_issued_date') as string) || null,
    passport_issued_by: (formData.get('passport_issued_by') as string)?.trim() || null,
    passport_department_code: (formData.get('passport_department_code') as string)?.trim() || null,
    // Address
    country: (formData.get('country') as string)?.trim() || null,
    region: (formData.get('region') as string)?.trim() || null,
    city: (formData.get('city') as string)?.trim() || null,
    street: (formData.get('street') as string)?.trim() || null,
    house_number: (formData.get('house_number') as string)?.trim() || null,
    building: (formData.get('building') as string)?.trim() || null,
    apartment: (formData.get('apartment') as string)?.trim() || null,
  }
}

export async function createContactAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const fields = getContactFields(formData)

  if (!fields.full_name || !fields.role) {
    return { error: 'Заполните обязательные поля' }
  }
  if (!VALID_ROLES.includes(fields.role as ContactRole)) {
    return { error: 'Неверная роль' }
  }

  const { data, error } = await supabase
    .from('contacts')
    .insert({
      ...fields,
      role: fields.role as ContactRole,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: fields.status as any,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/contacts')
  redirect(`/contacts/${data.id}`)
}

export async function updateContactAction(contactId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const fields = getContactFields(formData)

  if (!fields.full_name || !fields.role) {
    return { error: 'Заполните обязательные поля' }
  }
  if (!VALID_ROLES.includes(fields.role as ContactRole)) {
    return { error: 'Неверная роль' }
  }

  const { error } = await supabase
    .from('contacts')
    .update({
      ...fields,
      role: fields.role as ContactRole,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: fields.status as any,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contactId)

  if (error) return { error: error.message }

  revalidatePath('/contacts')
  revalidatePath(`/contacts/${contactId}`)
  redirect(`/contacts/${contactId}`)
}

export async function deleteContactAction(contactId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { error } = await supabase.from('contacts').delete().eq('id', contactId)
  if (error) return { error: error.message }

  revalidatePath('/contacts')
  redirect('/contacts')
}
