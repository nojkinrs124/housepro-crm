'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { rateLimitMutation } from '@/lib/rate-limit'

/**
 * Двухфакторная аутентификация через server actions, а НЕ через браузерный
 * клиент Supabase.
 *
 * Почему так: клиентский `@/lib/supabase/client` читает NEXT_PUBLIC_SUPABASE_URL
 * и NEXT_PUBLIC_SUPABASE_ANON_KEY, которые вшиваются в бандл на сборке. Если их
 * нет в окружении сборки, createBrowserClient падает с «Your project's URL and
 * API key are required» — и роняет всю страницу целиком. Серверный клиент берёт
 * те же значения в рантайме, поэтому здесь эта зависимость не нужна вовсе.
 *
 * Побочный плюс: verify обновляет сессию до AAL2, и серверный клиент сам
 * записывает свежие куки — на клиенте это пришлось бы синхронизировать руками.
 */

export interface MfaFactor {
  id: string
  friendlyName: string | null
  status: string
  createdAt: string | null
}

export interface MfaListResult {
  error?: string
  factors?: MfaFactor[]
}

export async function listMfaFactorsAction(): Promise<MfaListResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) return { error: error.message }

  return {
    factors: (data?.totp ?? []).map((factor) => ({
      id: factor.id,
      friendlyName: factor.friendly_name ?? null,
      status: factor.status,
      createdAt: factor.created_at ?? null,
    })),
  }
}

export interface MfaEnrollResult {
  error?: string
  factorId?: string
  /** SVG QR-кода от Supabase — страница отдаёт его картинкой через data-URI. */
  qr?: string
  /** Ключ для ручного ввода, если камера недоступна. */
  secret?: string
}

/** Начинает подключение: создаёт неподтверждённый фактор и отдаёт QR. */
export async function enrollMfaAction(): Promise<MfaEnrollResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const rl = await rateLimitMutation(user.id, 'mfa_enroll')
  if (!rl.success) return { error: 'Слишком много попыток. Подождите минуту.' }

  // Supabase не даёт завести второй фактор с тем же именем, а брошенные
  // неподтверждённые попытки копятся — подчищаем их перед новой.
  const { data: existing } = await supabase.auth.mfa.listFactors()
  for (const factor of existing?.totp ?? []) {
    if (factor.status !== 'verified') {
      await supabase.auth.mfa.unenroll({ factorId: factor.id })
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: `HousePro ${new Date().toLocaleDateString('ru-RU')}`,
  })

  if (error || !data) return { error: error?.message ?? 'Не удалось начать подключение' }

  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret }
}

export interface MfaSimpleResult {
  error?: string
  success?: boolean
}

/** Подтверждает код из приложения и включает фактор. */
export async function verifyMfaAction(factorId: string, code: string): Promise<MfaSimpleResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const rl = await rateLimitMutation(user.id, 'mfa_verify')
  if (!rl.success) return { error: 'Слишком много попыток. Подождите минуту.' }

  const cleaned = code.replace(/\D/g, '')
  if (cleaned.length !== 6) return { error: 'Код состоит из шести цифр' }

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
  if (challengeError || !challenge) {
    return { error: challengeError?.message ?? 'Не удалось запросить подтверждение' }
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: cleaned,
  })

  if (verifyError) {
    return { error: 'Код не подошёл. Проверьте время на телефоне и попробуйте снова.' }
  }

  revalidatePath('/settings/security')
  return { success: true }
}

/** Отключает фактор — или убирает брошенную неподтверждённую попытку. */
export async function unenrollMfaAction(factorId: string): Promise<MfaSimpleResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { error } = await supabase.auth.mfa.unenroll({ factorId })
  if (error) return { error: error.message }

  revalidatePath('/settings/security')
  return { success: true }
}
