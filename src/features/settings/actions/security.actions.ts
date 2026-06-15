'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getSecurityInfoAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  // Supabase doesn't expose session list via client SDK — we return current session info
  const { data: sessionData } = await supabase.auth.getSession()

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, email, role, created_at, last_sign_in_at')
    .eq('id', user.id)
    .single()

  const lastSignIn = user.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null

  const createdAt = user.created_at
    ? new Date(user.created_at).toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      })
    : null

  return {
    user: {
      id: user.id,
      email: user.email ?? '',
      lastSignIn,
      createdAt,
      role: (profile as { role?: string } | null)?.role ?? 'agent',
    },
    hasActiveSession: !!sessionData?.session,
  }
}

export async function changePasswordSecurityAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const newPassword = formData.get('new_password') as string
  const confirmPassword = formData.get('confirm_password') as string

  if (!newPassword || newPassword.length < 8) {
    return { error: 'Пароль должен быть не менее 8 символов' }
  }
  if (!/[A-Z]/.test(newPassword)) {
    return { error: 'Пароль должен содержать хотя бы одну заглавную букву' }
  }
  if (!/[0-9]/.test(newPassword)) {
    return { error: 'Пароль должен содержать хотя бы одну цифру' }
  }
  if (newPassword !== confirmPassword) {
    return { error: 'Пароли не совпадают' }
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { error: error.message }

  revalidatePath('/settings/security')
  return { success: true }
}

export async function signOutAllSessionsAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { error } = await supabase.auth.signOut({ scope: 'global' })
  if (error) return { error: error.message }

  return { success: true }
}
