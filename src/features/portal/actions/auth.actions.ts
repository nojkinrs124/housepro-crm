'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'
import { normalizePhone } from '@/lib/utils'
import {
  generateSignToken,
  generateSignCode,
  hashSignCode,
  verifySignCode,
  CODE_TTL_MINUTES,
  MAX_CODE_ATTEMPTS,
  maskPhone,
} from '@/lib/signing'
import { PORTAL_COOKIE, SESSION_TTL_MINUTES, createSessionCookie } from '@/features/portal/services/session'
import { isPortalConfigured } from '@/features/portal/services/access.service'

type RequestResult = { ok?: boolean; maskedTarget?: string | null; error?: string }
type VerifyResult = { error?: string }

/**
 * Ответ на запрос кода одинаков для существующего и несуществующего номера.
 *
 * Иначе форма входа превращается в способ узнать, работает ли человек с
 * агентством: ввёл номер — узнал ответ. Поэтому и текст, и время ответа не
 * зависят от того, нашёлся доступ или нет.
 */
const GENERIC_OK = 'Если номер привязан к объекту, код придёт от вашего менеджера.'

/**
 * Самостоятельный запрос кода.
 *
 * Автоматической доставки сегодня нет: contacts.telegram хранит @username, а
 * личное сообщение по юзернейму Telegram отправить не даёт (нужен chat_id,
 * которого в базе нет), SMS-провайдер не подключён. Поэтому код здесь только
 * создаётся, а передаёт его менеджер — см. issuePortalCodeAction в CRM.
 *
 * Когда канал появится, отправка добавится сюда без изменения формы входа.
 */
export async function requestPortalCodeAction(formData: FormData): Promise<RequestResult> {
  if (!isPortalConfigured()) {
    return { error: 'Личный кабинет пока не настроен. Обратитесь к менеджеру агентства.' }
  }

  const rawPhone = typeof formData.get('phone') === 'string' ? String(formData.get('phone')) : ''
  const phone = normalizePhone(rawPhone)

  if (!phone) {
    return { error: 'Введите номер телефона' }
  }

  // Не чаще одного запроса в минуту на номер и не более пяти в час (FR-047).
  const perMinute = await rateLimit(`portal:otp:min:${phone}`, { limit: 1, windowSeconds: 60 })
  if (!perMinute.success) {
    return { error: 'Код уже запрошен. Следующий можно запросить через минуту.' }
  }
  const perHour = await rateLimit(`portal:otp:hour:${phone}`, { limit: 5, windowSeconds: 3600 })
  if (!perHour.success) {
    return { error: 'Слишком много запросов. Попробуйте через час или обратитесь к менеджеру.' }
  }

  const supabaseAdmin = getSupabaseAdmin()
  const { data: access } = await supabaseAdmin
    .from('portal_access')
    .select('organization_id')
    .eq('phone', phone)
    .is('revoked_at', null)
    .limit(1)
    .maybeSingle()

  // Номер не найден — отвечаем тем же самым и ничего не создаём.
  if (!access) return { ok: true, maskedTarget: maskPhone(phone) }

  const token = generateSignToken()
  const code = generateSignCode()

  await supabaseAdmin.from('portal_otp').insert({
    organization_id: access.organization_id,
    phone,
    token,
    code_hash: hashSignCode(code, token),
    channel: 'manual',
    expires_at: new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString(),
  })

  return { ok: true, maskedTarget: maskPhone(phone) }
}

/**
 * Проверка кода и вход.
 *
 * Попытки считаются на самом коде: после пяти неверных он гаснет, и нужен новый.
 * Сообщение об ошибке одно на все случаи — не найден, истёк, неверный: по
 * различиям между ними тоже можно узнать лишнее.
 */
export async function verifyPortalCodeAction(formData: FormData): Promise<VerifyResult> {
  if (!isPortalConfigured()) {
    return { error: 'Личный кабинет пока не настроен. Обратитесь к менеджеру агентства.' }
  }

  const phone = normalizePhone(typeof formData.get('phone') === 'string' ? String(formData.get('phone')) : '')
  const code = (typeof formData.get('code') === 'string' ? String(formData.get('code')) : '').trim()

  if (!phone || !/^\d{6}$/.test(code)) {
    return { error: 'Код состоит из шести цифр' }
  }

  const attempts = await rateLimit(`portal:verify:${phone}`, { limit: 10, windowSeconds: 600 })
  if (!attempts.success) {
    return { error: 'Слишком много попыток. Попробуйте позже.' }
  }

  const supabaseAdmin = getSupabaseAdmin()
  const { data: otp } = await supabaseAdmin
    .from('portal_otp')
    .select('id, token, code_hash, expires_at, attempts, consumed_at')
    .eq('phone', phone)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const invalid = { error: 'Неверный или истёкший код' }

  if (!otp) return invalid
  if (new Date(otp.expires_at).getTime() < Date.now()) return invalid
  if (otp.attempts >= MAX_CODE_ATTEMPTS) return invalid

  if (!verifySignCode(code, otp.token, otp.code_hash)) {
    await supabaseAdmin
      .from('portal_otp')
      .update({ attempts: otp.attempts + 1 })
      .eq('id', otp.id)
    return invalid
  }

  // Код одноразовый: гасим сразу, чтобы повторно им не воспользовались.
  await supabaseAdmin.from('portal_otp').update({ consumed_at: new Date().toISOString() }).eq('id', otp.id)

  const { data: access } = await supabaseAdmin
    .from('portal_access')
    .select('contact_id')
    .eq('phone', phone)
    .is('revoked_at', null)
    .limit(1)
    .maybeSingle()

  // Доступ отозвали между запросом кода и вводом — впускать некуда.
  if (!access) return invalid

  await supabaseAdmin
    .from('portal_access')
    .update({ last_login_at: new Date().toISOString() })
    .eq('phone', phone)
    .is('revoked_at', null)

  const store = await cookies()
  store.set(PORTAL_COOKIE, createSessionCookie(access.contact_id, phone), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_MINUTES * 60,
  })

  redirect('/cabinet')
}

export async function logoutPortalAction(): Promise<void> {
  const store = await cookies()
  store.delete(PORTAL_COOKIE)
  redirect('/cabinet/login')
}
