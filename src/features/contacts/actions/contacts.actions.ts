'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { ContactSchema } from '@/lib/schemas'

function parseContact(formData: FormData) {
  return ContactSchema.safeParse(Object.fromEntries(formData))
}

export async function createContactAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const parsed = parseContact(formData)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first.message, fields: parsed.error.flatten().fieldErrors }
  }

  const { data, error } = await supabase
    .from('contacts')
    .insert(parsed.data)
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

  const parsed = parseContact(formData)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first.message, fields: parsed.error.flatten().fieldErrors }
  }

  const { error } = await supabase
    .from('contacts')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
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
