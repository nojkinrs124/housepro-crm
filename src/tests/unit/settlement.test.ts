import { describe, it, expect } from 'vitest'
import {
  calcSettlement,
  obligationMonths,
  isVacantOn,
  monthBounds,
  type SettlementOperation,
} from '@/features/management/services/settlement.service'
import { buildMonthlyReport, disclosesAgencyResult } from '@/features/management/services/report.service'

const op = (
  type: 'income' | 'expense',
  categoryCode: string | null,
  amount: number,
  date = '2026-09-05',
  borneBy: 'agency' | 'owner' | null = null,
  status = 'completed',
): SettlementOperation => ({ type, categoryCode, amount, date, borneBy, status })

describe('calcSettlement — схема «процент»', () => {
  const terms = { scheme: 'percent' as const, rate: 10, ownerFixedAmount: null, ownerPayoutDay: null, startedAt: '2026-08-01' }

  it('сценарий из quickstart: сальдо сходится в ноль', () => {
    // Поступление 50 000, удержание 10%, клининг 3 000 за счёт собственника,
    // выплата 42 000. Ожидается ровно 0.
    const result = calcSettlement(terms, [
      op('income', 'tenant_payment', 50000),
      op('expense', 'cleaning', 3000, '2026-09-10', 'owner'),
      op('expense', 'owner_payout', 42000, '2026-09-15'),
    ], '2026-09-30')

    expect(result.tenantPayments).toBe(50000)
    expect(result.agencyFee).toBe(5000)
    expect(result.ownerExpenses).toBe(3000)
    expect(result.ownerObligation).toBe(42000)
    expect(result.balance).toBe(0)
    expect(result.agencyResult).toBe(5000)
  })

  it('за простой не начисляется ничего: риск на собственнике', () => {
    const result = calcSettlement(terms, [], '2026-12-31')
    expect(result.ownerObligation).toBe(0)
    expect(result.agencyResult).toBe(0)
    expect(result.balance).toBe(0)
  })

  it('расход за счёт агентства уменьшает его доход, а не выплату собственнику', () => {
    const result = calcSettlement(terms, [
      op('income', 'tenant_payment', 50000),
      op('expense', 'repair_minor', 2000, '2026-09-10', 'agency'),
    ], '2026-09-30')

    expect(result.ownerObligation).toBe(45000)
    expect(result.agencyResult).toBe(3000)
  })

  it('запланированные операции в расчёт не идут — деньги ещё не прошли', () => {
    const result = calcSettlement(terms, [
      op('income', 'tenant_payment', 50000, '2026-09-05', null, 'planned'),
    ], '2026-09-30')
    expect(result.tenantPayments).toBe(0)
  })

  it('копейки не теряются', () => {
    const result = calcSettlement({ ...terms, rate: 10 }, [
      op('income', 'tenant_payment', 33333.33),
    ], '2026-09-30')
    expect(result.agencyFee).toBe(3333.33)
  })
})

describe('calcSettlement — схема «фиксированная выплата»', () => {
  const terms = {
    scheme: 'fixed' as const, rate: null,
    ownerFixedAmount: 40000, ownerPayoutDay: 5,
    startedAt: '2026-08-01',
  }

  it('сценарий из quickstart: месяц с платежом даёт +10 000', () => {
    const result = calcSettlement(terms, [
      op('income', 'tenant_payment', 50000, '2026-08-10'),
    ], '2026-08-31')

    expect(result.obligationMonths).toBe(1)
    expect(result.ownerObligation).toBe(40000)
    expect(result.agencyResult).toBe(10000)
  })

  it('сценарий из quickstart: месяц простоя даёт −40 000, итог −30 000', () => {
    // Два месяца: в первом поступило 50 000, во втором ничего.
    const result = calcSettlement(terms, [
      op('income', 'tenant_payment', 50000, '2026-08-10'),
    ], '2026-09-30')

    expect(result.obligationMonths).toBe(2)
    expect(result.ownerObligation).toBe(80000)
    // 50 000 собрано, 80 000 должны — накопленный убыток агентства.
    expect(result.agencyResult).toBe(-30000)
  })

  it('обязательство наступает независимо от платежа арендатора', () => {
    const result = calcSettlement(terms, [], '2026-09-30')
    expect(result.ownerObligation).toBe(80000)
    expect(result.balance).toBe(80000)
    expect(result.agencyResult).toBe(-80000)
  })

  it('расход за счёт собственника уменьшает то, что мы ему должны', () => {
    const result = calcSettlement(terms, [
      op('income', 'tenant_payment', 50000, '2026-08-10'),
      op('expense', 'cleaning', 3000, '2026-08-20', 'owner'),
    ], '2026-08-31')

    expect(result.balance).toBe(37000)
  })

  it('вознаграждение отдельной величиной не выделяется — агентство зарабатывает разницу', () => {
    const result = calcSettlement(terms, [op('income', 'tenant_payment', 50000, '2026-08-10')], '2026-08-31')
    expect(result.agencyFee).toBe(0)
  })

  it('завершённое обслуживание не накапливает обязательств после конца', () => {
    const result = calcSettlement({ ...terms, endedAt: '2026-08-31' }, [], '2026-12-31')
    expect(result.obligationMonths).toBe(1)
  })
})

describe('calcSettlement — без схемы', () => {
  it('расчёт не делается и объясняет причину', () => {
    const result = calcSettlement(
      { scheme: null, rate: null, ownerFixedAmount: null, ownerPayoutDay: null, startedAt: '2026-08-01' },
      [op('income', 'tenant_payment', 50000)],
    )
    expect(result.error).toContain('Схема расчёта не выбрана')
    expect(result.balance).toBe(0)
  })
})

describe('obligationMonths', () => {
  it('считает наступления дня выплаты', () => {
    expect(obligationMonths('2026-08-01', '2026-10-31', 5)).toBe(3)
  })

  it('день выплаты раньше начала обслуживания не считается', () => {
    // Начали 20 августа, выплата 5-го: первое обязательство — 5 сентября.
    expect(obligationMonths('2026-08-20', '2026-09-30', 5)).toBe(1)
  })

  it('до первой даты выплаты обязательств нет', () => {
    expect(obligationMonths('2026-08-20', '2026-08-31', 5)).toBe(0)
  })

  it('дата расчёта раньше начала — ноль', () => {
    expect(obligationMonths('2026-08-01', '2026-07-01', 5)).toBe(0)
  })

  it('29-е и позже схлопываются в 28-е: такого дня нет в каждом месяце', () => {
    expect(obligationMonths('2026-02-01', '2026-02-28', 31)).toBe(1)
  })
})

describe('isVacantOn', () => {
  const contract = (start: string | null, end: string | null, status = 'signed') =>
    ({ start_date: start, end_date: end, status })

  it('действующий договор — объект не простаивает', () => {
    expect(isVacantOn([contract('2026-08-01', '2027-06-30')], '2026-09-15')).toBe(false)
  })

  it('закончившийся договор — простой', () => {
    expect(isVacantOn([contract('2026-01-01', '2026-08-31')], '2026-09-15')).toBe(true)
  })

  it('договор в будущем — сейчас простой', () => {
    expect(isVacantOn([contract('2026-10-01', '2027-09-30')], '2026-09-15')).toBe(true)
  })

  it('черновик и отменённый договор арендатором не считаются', () => {
    expect(isVacantOn([contract('2026-08-01', '2027-06-30', 'draft')], '2026-09-15')).toBe(true)
    expect(isVacantOn([contract('2026-08-01', '2027-06-30', 'cancelled')], '2026-09-15')).toBe(true)
  })

  it('бессрочный договор без даты окончания действует', () => {
    expect(isVacantOn([contract('2026-08-01', null)], '2027-09-15')).toBe(false)
  })
})

describe('monthBounds', () => {
  it('границы обычного месяца', () => {
    expect(monthBounds(2026, 9)).toEqual({ from: '2026-09-01', to: '2026-09-30' })
  })

  it('февраль высокосного года', () => {
    expect(monthBounds(2028, 2)).toEqual({ from: '2028-02-01', to: '2028-02-29' })
  })
})

describe('buildMonthlyReport — состав зависит от схемы', () => {
  const percentTerms = {
    scheme: 'percent' as const, rate: 10,
    ownerFixedAmount: null, ownerPayoutDay: null, startedAt: '2026-08-01',
  }
  const fixedTerms = {
    scheme: 'fixed' as const, rate: null,
    ownerFixedAmount: 40000, ownerPayoutDay: 5, startedAt: '2026-08-01',
  }
  const ops = [
    op('income', 'tenant_payment', 50000, '2026-09-05'),
    op('expense', 'cleaning', 3000, '2026-09-10', 'owner'),
    op('expense', 'owner_payout', 42000, '2026-09-15'),
  ]

  it('при проценте удержание агентства раскрывается', () => {
    const report = buildMonthlyReport(percentTerms, 2026, 9, ops, ops)
    const labels = report.lines.map(l => l.label)
    expect(labels.some(l => l.includes('Удержание агентства'))).toBe(true)
    expect(labels.some(l => l.includes('10%'))).toBe(true)
    expect(report.dueToOwner).toBe(0)
  })

  it('при фиксе доход агентства собственнику не раскрывается', () => {
    const report = buildMonthlyReport(fixedTerms, 2026, 9, ops, ops)
    const labels = report.lines.map(l => l.label)
    expect(labels.some(l => l.includes('Удержание агентства'))).toBe(false)
    expect(labels.some(l => l.includes('Обязательство агентства'))).toBe(true)
    expect(disclosesAgencyResult('fixed')).toBe(false)
    expect(disclosesAgencyResult('percent')).toBe(true)
  })

  it('расходы за счёт собственника попадают в отчёт по категориям', () => {
    const report = buildMonthlyReport(percentTerms, 2026, 9, ops, ops)
    expect(report.lines.some(l => l.label === 'Клининг' && l.amount === 3000)).toBe(true)
  })

  it('расход за счёт агентства в отчёт собственнику не попадает', () => {
    const withAgencyExpense = [...ops, op('expense', 'repair_minor', 1500, '2026-09-12', 'agency')]
    const report = buildMonthlyReport(percentTerms, 2026, 9, withAgencyExpense, withAgencyExpense)
    expect(report.lines.some(l => l.label === 'Мелкий ремонт')).toBe(false)
  })

  it('незакрытый период виден: внутри есть запланированные операции', () => {
    const withPlanned = [...ops, op('income', 'tenant_payment', 50000, '2026-09-25', null, 'planned')]
    expect(buildMonthlyReport(percentTerms, 2026, 9, withPlanned, withPlanned).hasPending).toBe(true)
    expect(buildMonthlyReport(percentTerms, 2026, 9, ops, ops).hasPending).toBe(false)
  })

  it('без схемы отчёт не собирается и говорит почему', () => {
    const report = buildMonthlyReport(
      { scheme: null, rate: null, ownerFixedAmount: null, ownerPayoutDay: null, startedAt: '2026-08-01' },
      2026, 9, ops, ops,
    )
    expect(report.error).toContain('Схема расчёта не выбрана')
  })

  it('границы месяца берутся календарные', () => {
    const report = buildMonthlyReport(percentTerms, 2026, 9, ops, ops)
    expect(report.from).toBe('2026-09-01')
    expect(report.to).toBe('2026-09-30')
  })
})
