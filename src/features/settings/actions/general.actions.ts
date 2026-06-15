'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type GeneralSettings = {
  language: string
  currency: string
  timezone: string
  date_format: string
  theme: string
}

export async function getGeneralSettingsAction(): Promise<GeneralSettings> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const defaults: GeneralSettings = {
    language: 'ru',
    currency: 'RUB',
    timezone: 'Europe/Moscow',
    date_format: 'DD.MM.YYYY',
    theme: 'light',
  }

  if (!user) return defaults

  const { data } = await supabase
    .from('users')
    .select('settings')
    .eq('id', user.id)
    .single()

  if (!data?.settings) return defaults

  return { ...defaults, ...(data.settings as Partial<GeneralSettings>) }
}

export async function updateGeneralSettingsAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const language = formData.get('language') as string
  const currency = formData.get('currency') as string
  const timezone = formData.get('timezone') as string
  const date_format = formData.get('date_format') as string
  const theme = formData.get('theme') as string

  const VALID_LANGUAGES = ['ru', 'en']
  const VALID_CURRENCIES = ['RUB', 'USD', 'EUR', 'KZT', 'BYN', 'UAH']
  const VALID_THEMES = ['light', 'dark', 'system']
  const VALID_DATE_FORMATS = ['DD.MM.YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']

  if (!VALID_LANGUAGES.includes(language)) return { error: 'Неверный язык' }
  if (!VALID_CURRENCIES.includes(currency)) return { error: 'Неверная валюта' }
  if (!VALID_THEMES.includes(theme)) return { error: 'Неверная тема' }
  if (!VALID_DATE_FORMATS.includes(date_format)) return { error: 'Неверный формат даты' }

  const settings: GeneralSettings = { language, currency, timezone, date_format, theme }

  const { error } = await supabase
    .from('users')
    .update({ settings })
    .eq('id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/settings/general')
  revalidatePath('/', 'layout')

  return { success: true }
}
