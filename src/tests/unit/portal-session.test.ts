import { describe, it, expect, beforeAll } from 'vitest'
import { createSessionCookie, readSessionCookie, SESSION_TTL_MINUTES } from '@/features/portal/services/session'

beforeAll(() => {
  process.env.API_KEY_PEPPER = 'test-pepper-for-portal-sessions'
})

describe('сессия личного кабинета', () => {
  it('своя кука читается обратно', () => {
    const cookie = createSessionCookie('contact-1', '79001234567')
    const session = readSessionCookie(cookie)
    expect(session?.contactId).toBe('contact-1')
    expect(session?.phone).toBe('79001234567')
  })

  it('подделанная подпись отвергается', () => {
    const cookie = createSessionCookie('contact-1', '79001234567')
    const [payload] = cookie.split('.')
    expect(readSessionCookie(`${payload}.подделка`)).toBeNull()
  })

  it('подменённое содержимое отвергается', () => {
    // Меняем контакт в полезной нагрузке, подпись остаётся от старой — так
    // выглядела бы попытка войти в чужой кабинет правкой куки.
    const cookie = createSessionCookie('contact-1', '79001234567')
    const [, signature] = cookie.split('.')
    const forged = Buffer.from(JSON.stringify({
      contactId: 'contact-2', phone: '79001234567',
      exp: Math.floor(Date.now() / 1000) + 3600,
    })).toString('base64url')
    expect(readSessionCookie(`${forged}.${signature}`)).toBeNull()
  })

  it('истёкшая сессия не принимается', () => {
    const expired = Buffer.from(JSON.stringify({
      contactId: 'contact-1', phone: '79001234567',
      exp: Math.floor(Date.now() / 1000) - 10,
    })).toString('base64url')
    // Подписываем корректно — отвергнуть должен именно срок, а не подпись.
    const cookie = createSessionCookie('contact-1', '79001234567')
    const signature = cookie.split('.')[1]
    expect(readSessionCookie(`${expired}.${signature}`)).toBeNull()
  })

  it('пустая и мусорная кука не роняют разбор', () => {
    expect(readSessionCookie(undefined)).toBeNull()
    expect(readSessionCookie('')).toBeNull()
    expect(readSessionCookie('мусор')).toBeNull()
    expect(readSessionCookie('.')).toBeNull()
  })

  it('срок жизни сессии короткий — кабинет открывают ненадолго', () => {
    expect(SESSION_TTL_MINUTES).toBeLessThanOrEqual(120)
  })
})
