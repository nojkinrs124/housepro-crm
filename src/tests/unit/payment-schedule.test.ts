import { describe, it, expect } from 'vitest'
import {
  addMonthsKeepingDay,
  buildPaymentSchedule,
  scheduleTotal,
} from '@/features/accounting/services/payment-schedule.service'

describe('addMonthsKeepingDay', () => {
  it('подрезает 31-е число под длину короткого месяца', () => {
    const jan31 = new Date(Date.UTC(2026, 0, 31))
    expect(addMonthsKeepingDay(jan31, 1, 31).toISOString().slice(0, 10)).toBe('2026-02-28')
  })

  it('возвращает 31-е обратно, когда месяц позволяет', () => {
    const jan31 = new Date(Date.UTC(2026, 0, 31))
    expect(addMonthsKeepingDay(jan31, 2, 31).toISOString().slice(0, 10)).toBe('2026-03-31')
  })

  it('учитывает високосный февраль', () => {
    const jan31 = new Date(Date.UTC(2028, 0, 31))
    expect(addMonthsKeepingDay(jan31, 1, 31).toISOString().slice(0, 10)).toBe('2028-02-29')
  })

  it('перескакивает через границу года', () => {
    const nov15 = new Date(Date.UTC(2026, 10, 15))
    expect(addMonthsKeepingDay(nov15, 3, 15).toISOString().slice(0, 10)).toBe('2027-02-15')
  })
})

describe('buildPaymentSchedule', () => {
  it('строит 12 ежемесячных платежей за год аренды', () => {
    const items = buildPaymentSchedule({
      startDate: '2026-09-01',
      endDate: '2027-08-31',
      amount: 50_000,
      periodicity: 'monthly',
    })

    expect(items).toHaveLength(12)
    expect(items[0].dueDate).toBe('2026-09-01')
    expect(items[11].dueDate).toBe('2027-08-01')
    expect(scheduleTotal(items)).toBe(600_000)
    expect(items.every((i) => i.kind === 'rent')).toBe(true)
  })

  it('добавляет депозит первой строкой и не путает его с арендой', () => {
    const items = buildPaymentSchedule({
      startDate: '2026-09-01',
      endDate: '2026-12-01',
      amount: 40_000,
      depositAmount: 40_000,
      periodicity: 'monthly',
    })

    expect(items[0].kind).toBe('deposit')
    expect(items[0].seq).toBe(1)
    expect(items[1].kind).toBe('rent')
    expect(items.filter((i) => i.kind === 'deposit')).toHaveLength(1)
  })

  it('переносит день платежа на начало периода, если он уже прошёл внутри периода', () => {
    // Договор с 20-го числа, платёж 5-го: первый платёж не может быть 5 сентября,
    // когда договор начинается 20 сентября.
    const items = buildPaymentSchedule({
      startDate: '2026-09-20',
      endDate: '2026-12-20',
      amount: 30_000,
      periodicity: 'monthly',
      dayOfMonth: 5,
    })

    expect(items[0].dueDate).toBe('2026-09-20')
    expect(items[1].dueDate).toBe('2026-10-05')
  })

  it('квартальная периодичность даёт 4 платежа в год', () => {
    const items = buildPaymentSchedule({
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      amount: 150_000,
      periodicity: 'quarterly',
    })
    expect(items).toHaveLength(4)
    expect(items[1].dueDate).toBe('2026-04-01')
  })

  it('разовый платёж — ровно одна строка', () => {
    const items = buildPaymentSchedule({
      startDate: '2026-03-10',
      endDate: '2026-03-10',
      amount: 200_000,
      periodicity: 'once',
    })
    expect(items).toHaveLength(1)
    expect(items[0].amount).toBe(200_000)
  })

  it('без даты окончания строит год вперёд, а не бесконечность', () => {
    const items = buildPaymentSchedule({
      startDate: '2026-05-01',
      amount: 25_000,
      periodicity: 'monthly',
    })
    expect(items).toHaveLength(12)
  })

  it('пропорционально уменьшает неполный последний период при prorateLastPeriod', () => {
    const items = buildPaymentSchedule({
      startDate: '2026-01-01',
      endDate: '2026-03-15',
      amount: 30_000,
      periodicity: 'monthly',
      prorateLastPeriod: true,
    })
    const last = items[items.length - 1]
    expect(last.amount).toBeLessThan(30_000)
    expect(last.periodEnd).toBe('2026-03-15')
  })

  it('возвращает пустой график на некорректном вводе вместо исключения', () => {
    expect(buildPaymentSchedule({ startDate: 'не дата', amount: 1000, periodicity: 'monthly' })).toEqual([])
    expect(buildPaymentSchedule({ startDate: '2026-01-01', amount: 0, periodicity: 'monthly' })).toEqual([])
    expect(
      buildPaymentSchedule({ startDate: '2026-05-01', endDate: '2026-01-01', amount: 1000, periodicity: 'monthly' })
    ).toEqual([])
  })

  it('уважает предохранитель maxItems', () => {
    const items = buildPaymentSchedule({
      startDate: '2026-01-01',
      endDate: '2036-01-01',
      amount: 10_000,
      periodicity: 'monthly',
      maxItems: 24,
    })
    expect(items).toHaveLength(24)
  })

  it('индексирует ставку раз в год на заданный процент', () => {
    const items = buildPaymentSchedule({
      startDate: '2026-01-01',
      endDate: '2027-12-31',
      amount: 50_000,
      periodicity: 'monthly',
      indexationPercent: 10,
    })

    // Первый год — базовая ставка, второй — на 10% выше.
    expect(items[0].amount).toBe(50_000)
    expect(items[11].amount).toBe(50_000)
    expect(items[12].amount).toBe(55_000)
    expect(items[12].indexationSteps).toBe(1)
    expect(items[12].label).toContain('индексация')
  })

  it('применяет индексацию по датам, а не по номеру строки', () => {
    // Квартальная оплата: год наступает на пятой строке (периоды по 3 месяца),
    // а не на двенадцатой, как было бы при отсчёте по номеру платежа.
    const items = buildPaymentSchedule({
      startDate: '2026-01-01',
      endDate: '2027-12-31',
      amount: 150_000,
      periodicity: 'quarterly',
      indexationPercent: 10,
    })
    expect(items[3].periodStart).toBe('2026-10-01')
    expect(items[3].amount).toBe(150_000)
    expect(items[4].periodStart).toBe('2027-01-01')
    expect(items[4].amount).toBe(165_000)
  })

  it('уважает нестандартный период индексации', () => {
    const items = buildPaymentSchedule({
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      amount: 20_000,
      periodicity: 'monthly',
      indexationPercent: 5,
      indexationPeriodMonths: 6,
    })
    expect(items[5].amount).toBe(20_000)
    expect(items[6].amount).toBe(21_000)
  })

  it('без указания процента ставка не меняется', () => {
    const items = buildPaymentSchedule({
      startDate: '2026-01-01',
      endDate: '2027-12-31',
      amount: 50_000,
      periodicity: 'monthly',
    })
    expect(new Set(items.map((i) => i.amount)).size).toBe(1)
  })
})
