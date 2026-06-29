'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireOrgId } from '@/lib/org'

export async function createCollectionAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const title   = (formData.get('title')   as string)?.trim()
  const lead_id = (formData.get('lead_id') as string) || null
  if (!title) return { error: 'Укажите название подборки' }

  const { data, error } = await supabase
    .from('property_collections')
    .insert({ title, lead_id, organization_id: orgId, created_by: user.id })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/collections')
  redirect(`/collections/${data.id}`)
}

export async function toggleCollectionPublicAction(collectionId: string, isPublic: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { error } = await supabase
    .from('property_collections')
    .update({ is_public: isPublic })
    .eq('id', collectionId)

  if (error) return { error: error.message }
  revalidatePath(`/collections/${collectionId}`)
  return { success: true }
}

export async function addPropertyToCollectionAction(collectionId: string, propertyId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { error } = await supabase
    .from('collection_items')
    .insert({ collection_id: collectionId, property_id: propertyId })

  if (error) {
    if (error.code === '23505') return { error: 'Объект уже в подборке' }
    return { error: error.message }
  }

  revalidatePath(`/collections/${collectionId}`)
  return { success: true }
}

export async function removePropertyFromCollectionAction(collectionId: string, propertyId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { error } = await supabase
    .from('collection_items')
    .delete()
    .eq('collection_id', collectionId)
    .eq('property_id', propertyId)

  if (error) return { error: error.message }
  revalidatePath(`/collections/${collectionId}`)
  return { success: true }
}

export async function deleteCollectionAction(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { error } = await supabase.from('property_collections').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/collections')
  redirect('/collections')
}
