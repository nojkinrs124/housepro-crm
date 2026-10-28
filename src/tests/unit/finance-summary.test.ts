import { describe, it, expect } from 'vitest'
import { summarizeFinance, type FinanceSummaryRow } from '@/features/accounting/services/finance-summary'

const TODAY = '2026-10-28'

const row = (over: Partial<FinanceSummaryRow>): FinanceSummaryRow => ({
  type: 'income',
  amount: 1000,
  status: 'completed',
  date: '2026-10-05',
  due_date: null,
  categoryCode: 'agency_fee',
  borneBy: null,
  ...over,
})

describe('summarizeFinance', () => {
  it('транзит клиентов не попадает в доход агентства', () => {
    const s = summarizeFinance([
      row({ categoryCode: 'agency_fee', amount: 10_000 }),
      row({ categoryCode: 'tenant_payment', amount: 60_000 }),
      row({ categoryCode: 'deposit', amount: 30_000 }),
    ], { todayIso: TODAY })

    expect(s.agencyRevenue).toBe(10_000)
    expect(s.transitIncome).toBe(90_000)
    expect(s.grossIncome).toBe(100_000)
  })

  it('прибыль = выручка агентства минус расходы агентства, без транзита', () => {
    const s = summarizeFinance([
      row({ categoryCode: 'management_fee', amount: 50_000 }),
      row({ type: 'expense', categoryCode: 'marketing', amount: 15_000 }),
    ], { todayIso: TODAY })

    expect(s.profit).toBe(35_000)
    expect(s.transitIncome).toBe(0)
  })

  it('выплата собственнику — не расход агентства, показана отдельно', () => {
    const s = summarizeFinance([
      row({ type: 'expense', categoryCode: 'owner_payout', amount: 40_000 }),
    ], { todayIso: TODAY })

    expect(s.agencyExpense).toBe(0)
    expect(s.ownerPayouts).toBe(40_000)
    expect(s.profit).toBe(0)
  })

  it('расход «за счёт собственника» не уменьшает прибыль агентства', () => {
    const s = summarizeFinance([
      row({ type: 'expense', categoryCode: 'repair', amount: 20_000, borneBy: 'owner' }),
    ], { todayIso: TODAY })

    expect(s.agencyExpense).toBe(0)
  })

  it('начисление (planned) не считается деньгами, но попадает в дебиторку', () => {
    const s = summarizeFinance([
      row({ status: 'planned', amount: 25_000, due_date: '2026-10-01' }),
      row({ status: 'planned', amount: 5_000, due_date: '2026-12-01' }),
    ], { todayIso: TODAY })

    expect(s.agencyRevenue).toBe(0)
    expect(s.receivable.amount).toBe(30_000)
    expect(s.receivable.overdueAmount).toBe(25_000)
    expect(s.receivable.overdueCount).toBe(1)
  })

  it('отменённые операции не влияют ни на что', () => {
    const s = summarizeFinance([row({ status: 'cancelled', amount: 999_999 })], { todayIso: TODAY })

    expect(s.grossIncome).toBe(0)
    expect(s.receivable.amount).toBe(0)
    expect(s.rowsCounted).toBe(0)
  })

  it('разбивка по месяцам — по реальным операциям агентства, отсортирована', () => {
    const s = summarizeFinance([
      row({ date: '2026-09-10', amount: 10_000 }),
      row({ date: '2026-10-02', amount: 20_000 }),
      row({ date: '2026-10-20', categoryCode: 'tenant_payment', amount: 55_000 }),
      row({ date: '2026-10-21', type: 'expense', categoryCode: 'marketing', amount: 3_000 }),
    ], { todayIso: TODAY })

    expect(s.byMonth.map((m) => m.month)).toEqual(['2026-09', '2026-10'])
    expect(s.byMonth[1]).toEqual({
      month: '2026-10', agencyRevenue: 20_000, transitIncome: 55_000, agencyExpense: 3_000, profit: 17_000,
    })
  })

  it('нечисловая сумма не ломает итог', () => {
    const s = summarizeFinance([
      row({ amount: null }),
      row({ amount: 5_000 }),
    ], { todayIso: TODAY })

    expect(s.agencyRevenue).toBe(5_000)
  })

  it('суммы всей выборки, а не первой страницы', () => {
    // 300 операций по 100 ₽: старая реализация на странице в 200 строк дала бы 20 000.
    const rows = Array.from({ length: 300 }, (_, i) => row({ amount: 100, date: `2026-10-${String((i % 28) + 1).padStart(2, '0')}` }))
    const s = summarizeFinance(rows, { todayIso: TODAY })

    expect(s.agencyRevenue).toBe(30_000)
    expect(s.rowsCounted).toBe(300)
  })
})
