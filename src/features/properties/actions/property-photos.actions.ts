'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requirePermission } from '@/lib/permissions'
import { validateUploadedFile } from '@/lib/validate-file'

const BUCKET = 'property-photos'
const MAX_PHOTO_SIZE = 10 * 1024 * 1024 // 10 МБ — фото для Авито не нужно тяжелее
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export async function uploadPropertyPhotoAction(propertyId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const permError = await requirePermission(user.id, 'properties', 'update')
  if (permError) return permError

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { error: 'Файл не выбран' }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = new Uint8Array(arrayBuffer)

  const validationError = validateUploadedFile(file, buffer, {
    maxSizeBytes: MAX_PHOTO_SIZE,
    allowedMimeTypes: ALLOWED_MIME_TYPES,
  })
  if (validationError) return { error: validationError }

  const { data: property } = await supabase
    .from('properties')
    .select('photo_urls')
    .eq('id', propertyId)
    .single()

  if (!property) return { error: 'Объект не найден' }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${propertyId}/${Date.now()}-${safeName}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: file.type, upsert: false })

  if (uploadError) return { error: `Ошибка загрузки: ${uploadError.message}` }

  const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
  const newUrls = [...(property.photo_urls ?? []), publicUrlData.publicUrl]

  const { error: dbError } = await supabase
    .from('properties')
    .update({ photo_urls: newUrls })
    .eq('id', propertyId)

  if (dbError) {
    await supabase.storage.from(BUCKET).remove([storagePath])
    return { error: `Ошибка записи: ${dbError.message}` }
  }

  revalidatePath(`/properties/${propertyId}`)
  revalidatePath(`/properties/${propertyId}/edit`)
  return { success: true, url: publicUrlData.publicUrl }
}

export async function deletePropertyPhotoAction(propertyId: string, url: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const permError = await requirePermission(user.id, 'properties', 'update')
  if (permError) return permError

  const { data: property } = await supabase
    .from('properties')
    .select('photo_urls')
    .eq('id', propertyId)
    .single()

  if (!property) return { error: 'Объект не найден' }

  const newUrls = (property.photo_urls ?? []).filter((u: string) => u !== url)

  const { error } = await supabase
    .from('properties')
    .update({ photo_urls: newUrls })
    .eq('id', propertyId)

  if (error) return { error: error.message }

  const marker = `/storage/v1/object/public/${BUCKET}/`
  const storagePath = url.split(marker)[1]
  if (storagePath) {
    await supabase.storage.from(BUCKET).remove([storagePath])
  }

  revalidatePath(`/properties/${propertyId}`)
  revalidatePath(`/properties/${propertyId}/edit`)
  return { success: true }
}

/** Переставляет фото первым в списке — Авито и большинство площадок берут первое изображение как обложку. */
export async function setPropertyCoverPhotoAction(propertyId: string, url: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const permError = await requirePermission(user.id, 'properties', 'update')
  if (permError) return permError

  const { data: property } = await supabase
    .from('properties')
    .select('photo_urls')
    .eq('id', propertyId)
    .single()

  if (!property) return { error: 'Объект не найден' }

  const urls = property.photo_urls ?? []
  const newUrls = [url, ...urls.filter((u: string) => u !== url)]

  const { error } = await supabase
    .from('properties')
    .update({ photo_urls: newUrls })
    .eq('id', propertyId)

  if (error) return { error: error.message }

  revalidatePath(`/properties/${propertyId}`)
  revalidatePath(`/properties/${propertyId}/edit`)
  return { success: true }
}
