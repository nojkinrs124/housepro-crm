'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')

  const redirectTo = formData.get('redirectTo') as string | null
  const safePath =
    redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//')
      ? redirectTo
      : '/dashboard'

  redirect(safePath)
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function resetPassword(formData: FormData) {
  const supabase = await createClient()
  const email = (formData.get('email') as string)?.trim()
  if (!email) return { error: 'Введите email' }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
  })

  // Не раскрываем, существует ли email в системе — иначе это утечка данных
  // (можно перебором проверять, кто зарегистрирован). Supabase со своей стороны
  // тоже не возвращает ошибку на несуществующий email по этой же причине.
  if (error) {
    console.error('resetPasswordForEmail error:', error.message)
  }

  return { success: true }
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient()
  const password = formData.get('password') as string
  if (!password || password.length < 6) {
    return { error: 'Пароль должен быть не короче 6 символов' }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ссылка для сброса пароля недействительна или устарела' }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.message }

  return { success: true }
}

export async function getUser() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) return null

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError) {
    console.error('Error fetching user profile:', profileError)
    return null
  }

  return profile
}
