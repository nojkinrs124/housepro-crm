// Криптографическая обвязка простой электронной подписи.
//
// Код подтверждения хранится только хэшем — так же, как публичные API-ключи
// в lib/api-auth.ts. Утечка таблицы подписей не должна давать возможности
// «подписать» договор за клиента.

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto'

/** 15 минут: дольше держать код опасно, короче — неудобно клиенту. */
export const CODE_TTL_MINUTES = 15
/** После пяти неверных попыток код сгорает и нужно запрашивать новый. */
export const MAX_CODE_ATTEMPTS = 5

/**
 * Секрет для HMAC. Переиспользуем существующий API_KEY_PEPPER: заводить второй
 * секрет ради той же задачи — лишняя переменная окружения, которую забудут
 * задать в проде. Отсутствие ключа делает подпись бессмысленной, поэтому
 * функции об этом сообщают явно.
 */
function pepper(): string {
  const value = process.env.API_KEY_PEPPER
  if (!value) throw new Error('API_KEY_PEPPER не задан — подписание недоступно')
  return value
}

/** Токен публичной ссылки на подписание. */
export function generateSignToken(): string {
  return randomBytes(32).toString('hex')
}

/** Шестизначный код. randomInt из crypto, а не Math.random — код должен быть непредсказуем. */
export function generateSignCode(): string {
  const number = randomBytes(4).readUInt32BE(0) % 1_000_000
  return String(number).padStart(6, '0')
}

export function hashSignCode(code: string, token: string): string {
  // Токен подмешан в HMAC: один и тот же код в разных подписаниях даёт разные
  // хэши, поэтому по базе нельзя найти «одинаковые коды».
  return createHmac('sha256', pepper()).update(`${token}:${code}`).digest('hex')
}

/** Сравнение за постоянное время — защита от подбора по таймингу. */
export function verifySignCode(code: string, token: string, expectedHash: string | null): boolean {
  if (!expectedHash) return false
  const actual = Buffer.from(hashSignCode(code, token), 'hex')
  const expected = Buffer.from(expectedHash, 'hex')
  if (actual.length !== expected.length) return false
  return timingSafeEqual(actual, expected)
}

/** SHA-256 подписываемого файла — доказательство, что подписан именно он. */
export function hashDocument(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

/** Маскирует адрес для публичной страницы: i***v@mail.ru */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null
  const [name, domain] = email.split('@')
  if (!domain) return null
  const visible = name.slice(0, 1)
  const tail = name.length > 2 ? name.slice(-1) : ''
  return `${visible}${'*'.repeat(Math.max(name.length - 2, 1))}${tail}@${domain}`
}

/** Маскирует телефон: +7 *** *** 45 67 */
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 4) return null
  return `+${digits.slice(0, 1)} *** *** ${digits.slice(-4, -2)} ${digits.slice(-2)}`
}
