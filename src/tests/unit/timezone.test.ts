import { describe, it, expect } from 'vitest'
import { localDateTimeToIso, isoToLocalDateTime, todayIso, formatDateTime } from '@/lib/timezone'

/**
 * Пояс агентства — Europe/Moscow (UTC+3, без перехода на летнее время).
 * Тесты не зависят от TZ машины: функции считают через Intl с явным поясом.
 */
describe('timezone', () => {
  it('значение datetime-local считается по Москве и пишется в базу как UTC', () => {
    expect(localDateTimeToIso('2026-09-20T11:00')).toBe('2026-09-20T08:00:00.000Z')
    expect(localDateTimeToIso('2026-01-15T00:30')).toBe('2026-01-14T21:30:00.000Z')
  })

  it('полное ISO и пустое значение проходят как есть', () => {
    expect(localDateTimeToIso('2026-09-20T08:00:00.000Z')).toBe('2026-09-20T08:00:00.000Z')
    expect(localDateTimeToIso('')).toBeNull()
    expect(localDateTimeToIso(null)).toBeNull()
    expect(localDateTimeToIso('мусор')).toBeNull()
  })

  it('обратное преобразование даёт то же локальное время', () => {
    expect(isoToLocalDateTime('2026-09-20T08:00:00.000Z')).toBe('2026-09-20T11:00')
    expect(isoToLocalDateTime(localDateTimeToIso('2026-03-01T23:45'))).toBe('2026-03-01T23:45')
  })

  it('«сегодня» — по календарю агентства, а не по UTC', () => {
    // 21:30 UTC 16 сентября — в Москве уже 17-е.
    expect(todayIso(new Date('2026-09-16T21:30:00Z'))).toBe('2026-09-17')
    expect(todayIso(new Date('2026-09-16T12:00:00Z'))).toBe('2026-09-16')
  })

  it('форматирование показывает московское время', () => {
    expect(formatDateTime('2026-09-20T08:00:00.000Z', { hour: '2-digit', minute: '2-digit' })).toBe('11:00')
  })
})
