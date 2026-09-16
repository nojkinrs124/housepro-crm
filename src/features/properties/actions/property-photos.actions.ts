'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { revalidateSiteForProperty } from '@/features/site/lib/revalidate'
import { requirePermission } from '@/lib/permissions'
import { validateUploadedFile } from '@/lib/validate-file'
import {
  uploadPhoto,
  removePhotoByUrl,
  presignPhotoUpload,
  yandexPhotoSize,
  yandexPathFromUrl,
} from '@/lib/storage/photo-storage'
import { friendlyDbError } from '@/lib/errors'

const MAX_PHOTO_SIZE = 10 * 1024 * 1024 // 10 МБ — фото для Авито не нужно тяжелее
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/** Путь объекта в бакете: `<property_id>/<timestamp>-<безопасное имя>` — общий для обоих способов загрузки. */
function photoStoragePath(propertyId: string, fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `${propertyId}/${Date.now()}-${safeName}`
}

/** Объект существует и принадлежит организации пользователя (RLS) — иначе null. */
async function loadPropertyPhotos(supabase: Awaited<ReturnType<typeof createClient>>, propertyId: string) {
  const { data } = await supabase
    .from('properties')
    .select('photo_urls')
    .eq('id', propertyId)
    .single()
  return data ? (data.photo_urls ?? []) : null
}

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

  const storagePath = photoStoragePath(propertyId, file.name)

  const uploaded = await uploadPhoto(supabase, storagePath, buffer, file.type)
  if (!uploaded.url) return { error: uploaded.error ?? 'Ошибка загрузки' }

  const newUrls = [...(property.photo_urls ?? []), uploaded.url]

  const { error: dbError } = await supabase
    .from('properties')
    .update({ photo_urls: newUrls })
    .eq('id', propertyId)

  if (dbError) {
    await removePhotoByUrl(supabase, uploaded.url)
    return { error: `Ошибка записи: ${dbError.message}` }
  }

  revalidatePath(`/properties/${propertyId}`)
  revalidatePath(`/properties/${propertyId}/edit`)
  revalidateSiteForProperty(propertyId)
  return { success: true, url: uploaded.url }
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

  if (error) return { error: friendlyDbError(error, { entity: 'фото' }) }

  await removePhotoByUrl(supabase, url)

  revalidatePath(`/properties/${propertyId}`)
  revalidatePath(`/properties/${propertyId}/edit`)
  revalidateSiteForProperty(propertyId)
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

  if (error) return { error: friendlyDbError(error, { entity: 'фото' }) }

  revalidatePath(`/properties/${propertyId}`)
  revalidatePath(`/properties/${propertyId}/edit`)
  revalidateSiteForProperty(propertyId)
  return { success: true }
}

interface PhotoUploadMeta {
  name: string
  type: string
  size: number
}

/**
 * Шаг 1 прямой загрузки: браузер получает подписанную ссылку и кладёт файл в
 * Яндекс сам, минуя Vercel. `{ mode: 'relay' }` — драйвер supabase, клиент
 * грузит через uploadPropertyPhotoAction как раньше.
 */
export async function preparePhotoUploadAction(propertyId: string, meta: PhotoUploadMeta) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const permError = await requirePermission(user.id, 'properties', 'update')
  if (permError) return permError

  if (!ALLOWED_MIME_TYPES.includes(meta.type)) return { error: 'Разрешены только JPG, PNG, WEBP' }
  if (!Number.isFinite(meta.size) || meta.size <= 0) return { error: 'Файл пуст' }
  if (meta.size > MAX_PHOTO_SIZE) return { error: 'Файл больше 10 МБ' }

  const existing = await loadPropertyPhotos(supabase, propertyId)
  if (existing === null) return { error: 'Объект не найден' }

  const presigned = await presignPhotoUpload(photoStoragePath(propertyId, meta.name), meta.type)
  if (!presigned) return { mode: 'relay' as const }
  return { mode: 'direct' as const, ...presigned }
}

/**
 * Шаг 2: файл лёг в бакет — записать ссылку в photo_urls. Верим не браузеру,
 * а хранилищу: путь должен быть в папке этого объекта, а объект — реально
 * существовать и быть не пустым.
 */
export async function confirmPhotoUploadAction(propertyId: string, publicUrl: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const permError = await requirePermission(user.id, 'properties', 'update')
  if (permError) return permError

  const path = yandexPathFromUrl(publicUrl)
  if (!path || !path.startsWith(`${propertyId}/`)) return { error: 'Ссылка не из хранилища объекта' }

  const size = await yandexPhotoSize(path)
  if (size === null) return { error: 'Файл не найден в хранилище — загрузка не завершилась' }
  if (size === 0 || size > MAX_PHOTO_SIZE) {
    await removePhotoByUrl(supabase, publicUrl)
    return { error: size === 0 ? 'Файл пуст' : 'Файл больше 10 МБ' }
  }

  const existing = await loadPropertyPhotos(supabase, propertyId)
  if (existing === null) {
    await removePhotoByUrl(supabase, publicUrl)
    return { error: 'Объект не найден' }
  }
  if (existing.includes(publicUrl)) return { success: true, url: publicUrl }

  const { error } = await supabase
    .from('properties')
    .update({ photo_urls: [...existing, publicUrl] })
    .eq('id', propertyId)
  if (error) {
    await removePhotoByUrl(supabase, publicUrl)
    return { error: friendlyDbError(error, { entity: 'фото' }) }
  }

  revalidatePath(`/properties/${propertyId}`)
  revalidatePath(`/properties/${propertyId}/edit`)
  revalidateSiteForProperty(propertyId)
  return { success: true, url: publicUrl }
}

/**
 * Новый порядок фото целиком — после перетаскивания в карточке. Первое фото
 * становится обложкой. Набор ссылок должен совпадать с текущим: нельзя ни
 * подсунуть чужую, ни потерять свою.
 */
export async function reorderPropertyPhotosAction(propertyId: string, urls: string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const permError = await requirePermission(user.id, 'properties', 'update')
  if (permError) return permError

  const existing = await loadPropertyPhotos(supabase, propertyId)
  if (existing === null) return { error: 'Объект не найден' }

  const same =
    urls.length === existing.length &&
    new Set(urls).size === urls.length &&
    urls.every((u) => existing.includes(u))
  if (!same) return { error: 'Список фото изменился — обновите страницу' }

  const { error } = await supabase
    .from('properties')
    .update({ photo_urls: urls })
    .eq('id', propertyId)
  if (error) return { error: friendlyDbError(error, { entity: 'фото' }) }

  revalidatePath(`/properties/${propertyId}`)
  revalidatePath(`/properties/${propertyId}/edit`)
  revalidateSiteForProperty(propertyId)
  return { success: true }
}
