import { describe, it, expect } from 'vitest'
import { calculateIncome, clampRate, formatRub, guaranteeCostPerMonth } from '@/features/site/uslugi/calc'
import { describeLeadContext, summarizeLeadContext } from '@/features/site/uslugi/lead-context'
import { RATE_SLIDER, TARIFFS } from '@/features/site/uslugi/config'

// Калькулятор — публичное обещание денег собственнику, поэтому формулы
// закреплены тестом: 25% разово / 10% и 15% в месяц, первая сделка бесплатно.

describe('calculateIncome', () => {
  const R = 32_000
  const calc = calculateIncome(R)

  it('разовый подбор: на руки полная ставка, первый год 12R, дальше 25% при новом заселении', () => {
    expect(calc.podbor.monthlyToOwner).toBe(R)
    expect(calc.podbor.firstYear).toBe(12 * R)
    expect(calc.podbor.nextYears).toBe(12 * R)
    expect(calc.podbor.perNewTenant).toBe(R * TARIFFS.podbor.percent / 100)
  })

  it('управление: 0.9R в месяц, 10.8R в год', () => {
    expect(calc.upravlenie.monthlyToOwner).toBe(0.9 * R)
    expect(calc.upravlenie.firstYear).toBe(10.8 * R)
    expect(calc.upravlenie.perNewTenant).toBe(0)
  })

  it('премиум: 0.85R в месяц, 10.2R в год', () => {
    expect(calc.premium.monthlyToOwner).toBe(0.85 * R)
    expect(calc.premium.firstYear).toBe(10.2 * R)
  })

  it('разница «Управление» − «Премиум» = 5% ставки', () => {
    expect(guaranteeCostPerMonth(R)).toBe(0.05 * R)
  })

  it('некорректная ставка даёт нули, а не NaN', () => {
    const zero = calculateIncome(Number.NaN)
    expect(zero.upravlenie.monthlyToOwner).toBe(0)
    expect(zero.podbor.firstYear).toBe(0)
  })
})

describe('formatRub', () => {
  it('русский формат с неразрывными пробелами', () => {
    expect(formatRub(32_000)).toBe('32 000 ₽')
    expect(formatRub(1_000_000)).toBe('1 000 000 ₽')
  })
})

describe('clampRate', () => {
  it('держит ставку в диапазоне ползунка и округляет к шагу', () => {
    expect(clampRate(5_000, RATE_SLIDER)).toBe(RATE_SLIDER.min)
    expect(clampRate(999_999, RATE_SLIDER)).toBe(RATE_SLIDER.max)
    expect(clampRate(35_499, RATE_SLIDER)).toBe(35_000)
    expect(clampRate(Number.NaN, RATE_SLIDER)).toBe(RATE_SLIDER.min)
  })
})

describe('describeLeadContext', () => {
  it('собирает читаемые строки для комментария лида', () => {
    const lines = describeLeadContext({
      intent: 'tariff',
      tariffId: 'upravlenie',
      district: 'Центральный',
      rooms: 'r3',
      rate: 55_000,
    })
    expect(lines[0]).toBe('Тариф: Управление (10% в месяц)')
    expect(lines[1]).toBe('Объект: Центральный, комнат: 3')
    expect(lines[2]).toBe('Ставка из калькулятора: 55 000 ₽/мес')
    // при выбранном тарифе — расчёт только по нему
    expect(lines).toHaveLength(4)
    expect(lines[3]).toContain('Управление: на руки 49 500 ₽/мес')
  })

  it('без тарифа — расчёт по всем трём', () => {
    const lines = describeLeadContext({ rate: 30_000 })
    expect(lines.filter(l => /на руки/.test(l))).toHaveLength(3)
  })

  it('пустой контекст — пусто', () => {
    expect(describeLeadContext({})).toEqual([])
    expect(summarizeLeadContext({})).toBeNull()
  })
})
