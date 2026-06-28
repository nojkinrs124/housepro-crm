'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { ContactSchema, RepresentativeSchema } from '@/lib/schemas'
import { rateLimitCreate } from '@/lib/rate-limit'
import { requireOrgId } from '@/lib/org'

function parseContact(formData: FormData) {
  return ContactSchema.safeParse(Object.fromEntries(formData))
}

export async function createContactAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const rl = rateLimitCreate(user.id, 'contact')
  if (!rl.success) return { error: 'Слишком много запросов. Подождите минуту.' }

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const parsed = parseContact(formData)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first.message, fields: parsed.error.flatten().fieldErrors }
  }

  const { data, error } = await supabase
    .from('contacts')
    .insert({ ...parsed.data, organization_id: orgId })
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

  const rl = rateLimitCreate(user.id, 'contact')
  if (!rl.success) return { error: 'Слишком много запросов. Подождите минуту.' }

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

// ─── Representatives ────────────────────────────────────────────────────────

function parseRepresentative(formData: FormData) {
  return RepresentativeSchema.safeParse(Object.fromEntries(formData))
}

export async function addRepresentativeAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const parsed = parseRepresentative(formData)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first.message, fields: parsed.error.flatten().fieldErrors }
  }

  const { error } = await supabase.from('contact_representatives').insert(parsed.data)
  if (error) return { error: error.message }

  revalidatePath(`/contacts/${parsed.data.contact_id}`)
  redirect(`/contacts/${parsed.data.contact_id}`)
}

export async function deleteRepresentativeAction(representativeId: string, contactId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { error } = await supabase.from('contact_representatives').delete().eq('id', representativeId)
  if (error) return { error: error.message }

  revalidatePath(`/contacts/${contactId}`)
}
