'use server'

import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { rateLimitMutation } from '@/lib/rate-limit'

/**
 * Выдаёт (или перевыпускает) токен подписки на календарь.
 *
 * 24 байта случайности в hex — 48 символов. Ссылка публична по своей природе
 * (календари ходят за фидом без авторизации), поэтому единственная защита —
 * неугадываемость токена и возможность его отозвать.
 */
export async function regenerateIcalTokenAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const rl = await rateLimitMutation(user.id, 'ical_token')
  if (!rl.success) return { error: 'Слишком много запросов. Подождите минуту.' }

  const token = randomBytes(24).toString('hex')

  const { error } = await supabase.from('users').update({ ical_token: token }).eq('id', user.id)
  if (error) return { error: error.message }

  revalidatePath('/settings/profile')
  return { success: true, token }
}

/** Отзывает ссылку: старый URL сразу перестаёт отдавать события. */
export async function revokeIcalTokenAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { error } = await supabase.from('users').update({ ical_token: null }).eq('id', user.id)
  if (error) return { error: error.message }

  revalidatePath('/settings/profile')
  return { success: true }
}
