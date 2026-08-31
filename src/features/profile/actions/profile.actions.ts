'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { validateUploadedFile } from '@/lib/validate-file'
import { normalizePhone } from '@/lib/utils'

const AVATAR_BUCKET = 'avatars'
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif']

export async function updateProfileAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const full_name = (formData.get('full_name') as string)?.trim()
  const phone = normalizePhone(formData.get('phone') as string)

  if (!full_name) return { error: 'Имя обязательно' }
  if (full_name.length > 255) return { error: 'Имя не должно быть длиннее 255 символов' }
  if (phone && phone.length > 20) return { error: 'Номер телефона не должен быть длиннее 20 символов' }

  const updateData = {
    full_name,
    ...(phone !== null && { phone }),
  }

  const { error } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/settings/profile')
  revalidatePath('/', 'layout')

  return { success: true }
}

export async function updatePasswordAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const password = formData.get('password') as string
  const confirm = formData.get('confirm') as string

  // Более строгая проверка пароля
  if (!password || password.length < 8) {
    return { error: 'Пароль должен быть не менее 8 символов' }
  }

  if (!/[A-Z]/.test(password)) {
    return { error: 'Пароль должен содержать хотя бы одну заглавную букву' }
  }

  if (!/[0-9]/.test(password)) {
    return { error: 'Пароль должен содержать хотя бы одну цифру' }
  }

  if (password !== confirm) {
    return { error: 'Пароли не совпадают' }
  }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.message }

  return { success: true }
}

export async function uploadAvatarAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const file = formData.get('avatar') as File | null
  if (!file || file.size === 0) return { error: 'Файл не выбран' }

  const MAX_SIZE = 5 * 1024 * 1024 // 5 МБ

  const arrayBuffer = await file.arrayBuffer()
  const buffer = new Uint8Array(arrayBuffer)

  // Валидация: размер + расширение + magic bytes
  const validationError = validateUploadedFile(file, buffer, {
    allowedMimeTypes: ALLOWED_IMAGE_TYPES,
    maxSizeBytes: MAX_SIZE,
  })
  if (validationError) return { error: validationError }

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!ext || !ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
    return { error: 'Недопустимое расширение файла' }
  }

  const path = `${user.id}/avatar.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (uploadError) return { error: uploadError.message }

  const { data } = supabase.storage
    .from(AVATAR_BUCKET)
    .getPublicUrl(path)

  // Add cache-bust so browser reloads the image
  const avatarUrl = `${data.publicUrl}?t=${Date.now()}`

  const { error: dbError } = await supabase
    .from('users')
    .update({ avatar_url: avatarUrl })
    .eq('id', user.id)

  if (dbError) return { error: dbError.message }

  revalidatePath('/settings/profile')
  revalidatePath('/', 'layout')

  return { success: true, url: avatarUrl }
}
