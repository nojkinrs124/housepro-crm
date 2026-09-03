import { describe, it, expect } from 'vitest'
import {
  dueWithinLeadWindow,
  dueForEvent,
  planTasksFor,
  type Regulation,
} from '@/features/management/services/regulation.service'

const reg = (over: Partial<Regulation> = {}): Regulation => ({
  code: 'meter_reading',
  title: 'Снять показания счётчиков',
  period: 'monthly',
  dayOfMonth: 25,
  leadDays: 3,
  priority: 'medium',
  ...over,
})

describe('dueWithinLeadWindow — ежемесячные правила', () => {
  it('в день открытия окна срок появляется', () => {
    // Срок 25-го, окно за 3 дня — открывается 22-го.
    expect(dueWithinLeadWindow(reg(), '2026-01-01', '2026-09-22')).toBe('2026-09-25')
  })

  it('до открытия окна срока нет', () => {
    expect(dueWithinLeadWindow(reg(), '2026-01-01', '2026-09-21')).toBeNull()
  })

  it('в сам день срока окно ещё открыто', () => {
    expect(dueWithinLeadWindow(reg(), '2026-01-01', '2026-09-25')).toBe('2026-09-25')
  })

  it('после срока окно этого месяца закрыто, следующее ещё не открылось', () => {
    expect(dueWithinLeadWindow(reg(), '2026-01-01', '2026-09-26')).toBeNull()
  })

  it('сроки раньше начала обслуживания не наступали', () => {
    // Обслуживание с 1 сентября: августовский срок не наш.
    expect(dueWithinLeadWindow(reg(), '2026-09-01', '2026-08-22')).toBeNull()
  })

  it('срок в месяце начала считается, если он позже старта', () => {
    expect(dueWithinLeadWindow(reg(), '2026-09-01', '2026-09-22')).toBe('2026-09-25')
  })
})

describe('dueWithinLeadWindow — редкие периоды привязаны к месяцу старта', () => {
  it('раз в полгода: взяли в марте — проверяем в марте и сентябре', () => {
    const inspection = reg({ code: 'inspection', period: 'semiannual', dayOfMonth: 15, leadDays: 7 })
    expect(dueWithinLeadWindow(inspection, '2026-03-01', '2026-03-10')).toBe('2026-03-15')
    expect(dueWithinLeadWindow(inspection, '2026-03-01', '2026-09-10')).toBe('2026-09-15')
    // Июнь — не наш месяц: между мартом и сентябрём проверки нет.
    expect(dueWithinLeadWindow(inspection, '2026-03-01', '2026-06-10')).toBeNull()
  })

  it('раз в квартал шагает через три месяца', () => {
    const uk = reg({ code: 'uk_liaison', period: 'quarterly', dayOfMonth: 20, leadDays: 5 })
    expect(dueWithinLeadWindow(uk, '2026-02-01', '2026-02-16')).toBe('2026-02-20')
    expect(dueWithinLeadWindow(uk, '2026-02-01', '2026-05-16')).toBe('2026-05-20')
    expect(dueWithinLeadWindow(uk, '2026-02-01', '2026-03-16')).toBeNull()
  })

  it('раз в год — через год от старта', () => {
    const review = reg({ code: 'rate_review', period: 'annual', dayOfMonth: 1, leadDays: 14 })
    expect(dueWithinLeadWindow(review, '2026-04-01', '2027-03-20')).toBe('2027-04-01')
  })

  it('переход через год считается верно', () => {
    const q = reg({ period: 'quarterly', dayOfMonth: 10, leadDays: 2 })
    expect(dueWithinLeadWindow(q, '2026-11-01', '2027-02-09')).toBe('2027-02-10')
  })
})

describe('dueForEvent — окончание договора найма', () => {
  const expiry = reg({ code: 'contract_expiry', period: 'on_event', dayOfMonth: null, leadDays: 30 })

  it('за 30 дней до конца напоминание появляется', () => {
    expect(dueForEvent(expiry, '2026-10-31', '2026-10-01')).toBe('2026-10-31')
  })

  it('раньше окна — молчит', () => {
    expect(dueForEvent(expiry, '2026-10-31', '2026-09-30')).toBeNull()
  })

  it('после окончания договора напоминать поздно', () => {
    expect(dueForEvent(expiry, '2026-10-31', '2026-11-01')).toBeNull()
  })

  it('без договора найма события нет', () => {
    expect(dueForEvent(expiry, null, '2026-10-01')).toBeNull()
  })

  it('календарное правило через это событие не проходит', () => {
    expect(dueForEvent(reg(), '2026-10-31', '2026-10-01')).toBeNull()
  })
})

describe('planTasksFor', () => {
  const regulations = [
    reg({ code: 'meter_reading', period: 'monthly', dayOfMonth: 25, leadDays: 3 }),
    reg({ code: 'rent_collection', title: 'Принять оплату', period: 'monthly', dayOfMonth: 5, leadDays: 2, priority: 'high' }),
    reg({ code: 'contract_expiry', title: 'Договор заканчивается', period: 'on_event', dayOfMonth: null, leadDays: 30, priority: 'high' }),
  ]

  it('на дату собирает только те правила, чьи окна открыты', () => {
    const planned = planTasksFor(regulations, { startedAt: '2026-01-01', rentEndDate: '2026-12-31' }, '2026-09-22')
    expect(planned.map(p => p.regulationCode)).toEqual(['meter_reading'])
    expect(planned[0].dueDate).toBe('2026-09-25')
  })

  it('несколько правил могут открыться в один день', () => {
    // 3 сентября: окно сбора оплаты (5-го, за 2 дня) открыто; окончание
    // договора 2 октября — окно за 30 дней тоже открыто.
    const planned = planTasksFor(regulations, { startedAt: '2026-01-01', rentEndDate: '2026-10-02' }, '2026-09-03')
    expect(planned.map(p => p.regulationCode).sort()).toEqual(['contract_expiry', 'rent_collection'])
  })

  it('без открытых окон не планирует ничего', () => {
    expect(planTasksFor(regulations, { startedAt: '2026-01-01', rentEndDate: null }, '2026-09-15')).toEqual([])
  })

  it('приоритет и описание переносятся в задачу', () => {
    const planned = planTasksFor(regulations, { startedAt: '2026-01-01', rentEndDate: null }, '2026-09-03')
    expect(planned[0].priority).toBe('high')
    expect(planned[0].title).toBe('Принять оплату')
  })
})
