import { describe, it, expect } from 'vitest'
import {
  computeConsumption,
  computeAmount,
  detectAnomalies,
  averageConsumption,
  daysBetween,
} from '@/features/meters/services/anomalies'

const r = (date: string, value: number) => ({ reading_date: date, value })

describe('computeConsumption', () => {
  it('считает разницу показаний', () => {
    expect(computeConsumption(100, 130)).toBe(30)
  })

  it('первое показание расхода не даёт — сравнивать не с чем', () => {
    expect(computeConsumption(null, 130)).toBeNull()
  })

  it('падение показания расходом не считается', () => {
    // Счётчик открутили назад или заменили — это повод разобраться,
    // а не отрицательный расход в начислении.
    expect(computeConsumption(130, 100)).toBeNull()
  })

  it('нулевой расход — валидное значение, объект стоял пустым', () => {
    expect(computeConsumption(100, 100)).toBe(0)
  })
})

describe('computeAmount', () => {
  it('умножает расход на тариф до копеек', () => {
    expect(computeAmount(30, 6.47)).toBe(194.1)
  })

  it('без тарифа начисление не считается', () => {
    expect(computeAmount(30, null)).toBeNull()
  })

  it('без расхода начисления нет', () => {
    expect(computeAmount(null, 6.47)).toBeNull()
  })
})

describe('detectAnomalies', () => {
  it('первое показание аномалий не даёт', () => {
    expect(detectAnomalies(r('2026-09-01', 100), [])).toEqual([])
  })

  it('нормальное показание проходит чисто', () => {
    const history = [r('2026-08-01', 100), r('2026-07-01', 70), r('2026-06-01', 40), r('2026-05-01', 10)]
    expect(detectAnomalies(r('2026-09-01', 130), history)).toEqual([])
  })

  it('падение показания — аномалия с подсказкой про замену счётчика', () => {
    const a = detectAnomalies(r('2026-09-01', 90), [r('2026-08-01', 100)])
    expect(a.map(x => x.kind)).toContain('decreased')
    expect(a[0].message).toContain('замене счётчика')
  })

  it('разрыв больше 45 дней — аномалия', () => {
    const a = detectAnomalies(r('2026-09-01', 130), [r('2026-06-01', 100)])
    expect(a.map(x => x.kind)).toContain('gap')
  })

  it('месячный интервал разрывом не считается', () => {
    const a = detectAnomalies(r('2026-09-01', 130), [r('2026-08-01', 100)])
    expect(a.map(x => x.kind)).not.toContain('gap')
  })

  it('скачок втрое от обычного расхода — аномалия', () => {
    const history = [r('2026-08-01', 100), r('2026-07-01', 70), r('2026-06-01', 40), r('2026-05-01', 10)]
    // Обычный расход 30, новый — 200.
    const a = detectAnomalies(r('2026-09-01', 300), history)
    expect(a.map(x => x.kind)).toContain('spike')
  })

  it('на короткой истории скачок не ищется — обычный расход неизвестен', () => {
    const a = detectAnomalies(r('2026-09-01', 300), [r('2026-08-01', 100)])
    expect(a.map(x => x.kind)).not.toContain('spike')
  })

  it('одно показание может дать сразу две аномалии', () => {
    const history = [r('2026-05-01', 100), r('2026-04-01', 70), r('2026-03-01', 40), r('2026-02-01', 10)]
    const a = detectAnomalies(r('2026-09-01', 500), history)
    expect(a.map(x => x.kind).sort()).toEqual(['gap', 'spike'])
  })
})

describe('averageConsumption', () => {
  it('считает средний расход по истории', () => {
    expect(averageConsumption([r('2026-08-01', 100), r('2026-07-01', 70), r('2026-06-01', 40)])).toBe(30)
  })

  it('на одном показании среднего нет', () => {
    expect(averageConsumption([r('2026-08-01', 100)])).toBeNull()
  })

  it('падение показания в среднее не попадает', () => {
    // 100 → 40 это −60, такой «расход» испортил бы базу для сравнения.
    expect(averageConsumption([r('2026-08-01', 40), r('2026-07-01', 100), r('2026-06-01', 70)])).toBe(30)
  })
})

describe('daysBetween', () => {
  it('считает дни между датами', () => {
    expect(daysBetween('2026-08-01', '2026-09-01')).toBe(31)
  })

  it('битую дату не роняет', () => {
    expect(daysBetween('нет даты', '2026-09-01')).toBe(0)
  })
})
