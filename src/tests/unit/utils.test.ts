import { describe, it, expect } from 'vitest'
import { formatMoney, formatDate, formatPhone } from '@/lib/utils'

describe('formatMoney', () => {
  it('форматирует положительную сумму', () => {
    const result = formatMoney(50000)
    expect(result).toContain('50')
    expect(result).toContain('000')
    expect(result).toContain('₽')
  })

  it('форматирует ноль', () => {
    const result = formatMoney(0)
    expect(result).toContain('0')
    expect(result).toContain('₽')
  })

  it('обрабатывает null', () => {
    expect(formatMoney(null)).toContain('₽')
  })

  it('обрабатывает undefined', () => {
    expect(formatMoney(undefined)).toContain('₽')
  })

  it('принимает строковое число', () => {
    const result = formatMoney('100000')
    expect(result).toContain('₽')
  })

  it('форматирует миллион', () => {
    const result = formatMoney(1_000_000)
    expect(result).toContain('1')
    expect(result).toContain('₽')
  })
})

describe('formatDate', () => {
  it('форматирует ISO дату', () => {
    const result = formatDate('2025-06-15')
    expect(result).toContain('2025')
    expect(result).toContain('06')
    expect(result).toContain('15')
  })

  it('возвращает — для null', () => {
    expect(formatDate(null)).toBe('—')
  })

  it('возвращает — для undefined', () => {
    expect(formatDate(undefined)).toBe('—')
  })

  it('принимает объект Date', () => {
    const result = formatDate(new Date('2025-01-01'))
    expect(result).toContain('2025')
  })

  it('принимает кастомные опции', () => {
    const result = formatDate('2025-06-15', { month: 'long', year: 'numeric' })
    expect(result).toContain('2025')
  })
})

describe('formatPhone', () => {
  it('форматирует российский номер 11 цифр', () => {
    const result = formatPhone('79991234567')
    expect(result).toMatch(/^\+7/)
    expect(result).toContain('999')
  })

  it('возвращает — для null', () => {
    expect(formatPhone(null)).toBe('—')
  })

  it('возвращает — для undefined', () => {
    expect(formatPhone(undefined)).toBe('—')
  })

  it('возвращает строку как есть если не 11 цифр', () => {
    const phone = '+7 (999) 123-45-67'
    expect(formatPhone(phone)).toBe(phone)
  })

  it('форматирует номер без +', () => {
    const result = formatPhone('89991234567')
    expect(result).toContain('999')
    expect(result).toContain('123')
  })
})
