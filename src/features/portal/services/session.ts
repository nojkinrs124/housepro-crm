import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Сессия личного кабинета.
 *
 * Подписанная кука, а не запись в базе: сессий у кабинета мало, живут они
 * недолго, и лишняя таблица с чисткой просроченных строк тут не окупается.
 * Отзыв доступа при этом действует немедленно — потому что каждый запрос
 * заново проверяет `portal_access`, а не полагается на содержимое куки.
 *
 * Секрет тот же, что у простой электронной подписи (API_KEY_PEPPER): заводить
 * второй ради той же задачи — лишняя переменная окружения, которую забудут
 * задать в проде.
 */

export const PORTAL_COOKIE = 'hp_portal'

/** Час: кабинет открывают ненадолго — посмотреть отчёт или внести показания. */
export const SESSION_TTL_MINUTES = 60

export interface PortalSession {
  contactId: string
  phone: string
  /** Момент истечения, unix-секунды. */
  exp: number
}

function secret(): string {
  const value = process.env.API_KEY_PEPPER
  if (!value) throw new Error('API_KEY_PEPPER не задан — сессии кабинета недоступны')
  return value
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url')
}

export function createSessionCookie(contactId: string, phone: string): string {
  const session: PortalSession = {
    contactId,
    phone,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_MINUTES * 60,
  }
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url')
  return `${payload}.${sign(payload)}`
}

/**
 * Разбирает куку. Возвращает null при любой проблеме — подделанной подписи,
 * испорченном содержимом, истёкшем сроке.
 */
export function readSessionCookie(raw: string | undefined | null): PortalSession | null {
  if (!raw) return null
  const dot = raw.lastIndexOf('.')
  if (dot <= 0) return null

  const payload = raw.slice(0, dot)
  const signature = raw.slice(dot + 1)

  const expected = Buffer.from(sign(payload))
  const actual = Buffer.from(signature)
  if (expected.length !== actual.length) return null
  if (!timingSafeEqual(expected, actual)) return null

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as PortalSession
    if (!session.contactId || !session.phone || !session.exp) return null
    if (session.exp < Math.floor(Date.now() / 1000)) return null
    return session
  } catch {
    return null
  }
}
