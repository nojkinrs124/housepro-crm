import { describe, it, expect } from 'vitest'
import { planReading } from '@/features/meters/services/reading-batch'
import { computeConsumption } from '@/features/meters/services/anomalies'

const r = (date: string, value: number) => ({ reading_date: date, value })

describe('computeConsumption — дробные показания', () => {
  it('округляет до тысячных, без хвоста плавающей точки', () => {
    expect(computeConsumption(160.17, 163.47)).toBe(3.3)
    expect(computeConsumption(420.13, 426.38)).toBe(6.25)
  })
})

describe('planReading', () => {
  it('считает расход и сумму как в таблице Соколовской 72', () => {
    const hot = planReading([r('2026-08-23', 160.17)], '2026-09-23', 163.47, 209.1)
    const cold = planReading([r('2026-08-23', 420.13)], '2026-09-23', 426.38, 38.06)
    const el = planReading([r('2026-08-23', 7449)], '2026-09-23', 7612, 4.58)
    expect(hot).toMatchObject({ consumption: 3.3, amount: 690.03 })
    expect(cold).toMatchObject({ consumption: 6.25, amount: 237.88 })
    expect(el).toMatchObject({ consumption: 163, amount: 746.54 })
  })

  it('первое показание — без расхода и суммы', () => {
    expect(planReading([], '2026-09-23', 100, 5)).toMatchObject({ consumption: null, amount: null })
  })

  it('без тарифа — расход есть, суммы нет', () => {
    expect(planReading([r('2026-08-23', 10)], '2026-09-23', 15, null)).toMatchObject({ consumption: 5, amount: null })
  })

  it('отклоняет показание меньше предыдущего', () => {
    expect(planReading([r('2026-08-23', 500)], '2026-09-23', 400, 5)).toHaveProperty('error')
  })

  it('не даёт внести второе показание на ту же дату', () => {
    expect(planReading([r('2026-09-23', 500)], '2026-09-23', 510, 5)).toHaveProperty('error')
  })

  it('берёт предыдущим показание до даты, а не самое свежее', () => {
    const history = [r('2026-10-23', 200), r('2026-08-23', 100)]
    expect(planReading(history, '2026-09-23', 150, 1)).toMatchObject({ consumption: 50, amount: 50 })
  })
})
