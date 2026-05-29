'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const AVATAR_BUCKET = 'avatars'

export async function updateProfileAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const full_name = (formData.get('full_name') as string)?.trim()
  const phone = (formData.get('phone') as string)?.trim() || null

  if (!full_name) return { error: 'Имя обязательно' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = { full_name }
  if (phone !== null) updateData.phone = phone

  const { error } = await supabase
    .from('users')
    .update(updateData as never)
    .eq('id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/settings/profile')
  revalidatePath('/', 'layout')

  return { success: true }
}

export async function updatePasswordAction(formData: FormData) {
  const supabase = await createClient()

  const password = formData.get('password') as string
  const confirm = formData.get('confirm') as string

  if (!password || password.length < 6) {
    return { error: 'Пароль должен быть не менее 6 символов' }
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
  if (file.size > 5 * 1024 * 1024) return { error: 'Максимум 5 МБ' }
  if (!file.type.startsWith('image/')) return { error: 'Только изображения' }

  const ext = file.name.split('.').pop()
  const path = `${user.id}/avatar.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = new Uint8Array(arrayBuffer)

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (uploadError) return { error: uploadError.message }

  const { data: { publicUrl } } = supabase.storage
    .from(AVATAR_BUCKET)
    .getPublicUrl(path)

  // Add cache-bust so browser reloads the image
  const avatarUrl = `${publicUrl}?t=${Date.now()}`

  const { error: dbError } = await supabase
    .from('users')
    .update({ avatar_url: avatarUrl } as never)
    .eq('id', user.id)

  if (dbError) return { error: dbError.message }

  revalidatePath('/settings/profile')
  revalidatePath('/', 'layout')

  return { success: true, url: avatarUrl }
}
