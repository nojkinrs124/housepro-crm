/**
 * Итоги по деньгам за период — ОДИН расчёт для всех внешних потребителей
 * (бот, API-/summary, отчёты), чтобы «сколько заработали» не отвечалось
 * двумя разными способами.
 *
 * Причина появления (находка аудита бота 28.10.2026): Telegram-бот суммировал
 * `type='income'` плоско и по ОДНОЙ странице выборки (limit 200). Отсюда две
 * ошибки сразу — в «доход» попадал транзит клиентов (аренда жильцов, депозиты),
 * и за 200+ операций в периоде сумма молча занижалась. В вебе за это время
 * появилось деление «реальная выручка / транзит» (money-classification.ts),
 * и бот с вебом начали отвечать на один вопрос разными цифрами.
 *
 * Правила здесь ровно те же, что у KPI «Доход» на /analytics
 * (computeKpis: payment_status === 'paid' && isAgencyRevenue):
 *  • в суммы идёт только ПРОВЕДЁННОЕ (`status='completed'`);
 *  • доход агентства — income, у которого категория не транзитная;
 *  • расход агентства — expense, который платит агентство (не выплата
 *    собственнику и не расход «за счёт собственника»);
 *  • начисления (`planned`) — не деньги, а дебиторка: отдельным блоком.
 *
 * Файл без 'use client' и без обращения к БД: на вход строки, на выход числа.
 * Поэтому его можно и протестировать без базы, и звать из route handler.
 */

import { isAgencyRevenue, isAgencyExpense, OWNER_PAYOUT_CODE, toPaymentStatus } from '../utils/money-classification'

export interface FinanceSummaryRow {
  type: 'income' | 'expense'
  amount: number | null
  /** completed | planned | cancelled — как в accounting_transactions.status */
  status: string
  /** YYYY-MM-DD */
  date: string
  due_date: string | null
  categoryCode: string | null
  borneBy?: 'agency' | 'owner' | null
}

export interface FinanceMonthRow {
  /** YYYY-MM */
  month: string
  agencyRevenue: number
  transitIncome: number
  agencyExpense: number
  profit: number
}

export interface FinanceSummary {
  /** Реальная выручка агентства (комиссии, управление) — «сколько мы заработали». */
  agencyRevenue: number
  /** Транзит клиентов: аренда жильцов, депозиты — деньги прошли через нас, но не наши. */
  transitIncome: number
  /** Всё проведённое поступление (agencyRevenue + transitIncome). */
  grossIncome: number
  /** Расходы, которые платит агентство. */
  agencyExpense: number
  /** Выплаты собственникам — тоже не расход агентства, показываем отдельно. */
  ownerPayouts: number
  /** agencyRevenue − agencyExpense. Транзит сюда не входит ни с какой стороны. */
  profit: number
  /** Начисления, которые ещё не оплачены (status='planned'). */
  receivable: { amount: number; overdueAmount: number; overdueCount: number }
  /** По месяцам — только реальная выручка/расход агентства, без транзита. */
  byMonth: FinanceMonthRow[]
  /** Сколько строк реально попало в расчёт — чтобы потребитель не думал, что это выборка. */
  rowsCounted: number
}

const EMPTY_MONTH = (month: string): FinanceMonthRow => ({
  month, agencyRevenue: 0, transitIncome: 0, agencyExpense: 0, profit: 0,
})

/**
 * Считает итоги за период по строкам операций.
 *
 * `todayIso` нужен для просроченной дебиторки: «просрочено» вычисляется по
 * сроку оплаты, а не хранится (см. toPaymentStatus).
 */
export function summarizeFinance(
  rows: readonly FinanceSummaryRow[],
  opts: { todayIso: string },
): FinanceSummary {
  const { todayIso } = opts
  const months = new Map<string, FinanceMonthRow>()
  const summary: FinanceSummary = {
    agencyRevenue: 0,
    transitIncome: 0,
    grossIncome: 0,
    agencyExpense: 0,
    ownerPayouts: 0,
    profit: 0,
    receivable: { amount: 0, overdueAmount: 0, overdueCount: 0 },
    byMonth: [],
    rowsCounted: 0,
  }

  for (const row of rows) {
    if (row.status === 'cancelled') continue
    const amount = Number(row.amount ?? 0)
    if (!Number.isFinite(amount)) continue
    summary.rowsCounted++

    if (row.status !== 'completed') {
      // План ещё не деньги. В дебиторку берём только ожидаемые поступления:
      // непроведённый расход ничего не «должен» нам.
      if (row.type === 'income') {
        summary.receivable.amount += amount
        if (toPaymentStatus(row.status, row.due_date, todayIso) === 'overdue') {
          summary.receivable.overdueAmount += amount
          summary.receivable.overdueCount++
        }
      }
      continue
    }

    const monthKey = String(row.date).slice(0, 7)
    const bucket = months.get(monthKey) ?? EMPTY_MONTH(monthKey)
    months.set(monthKey, bucket)

    if (row.type === 'income') {
      summary.grossIncome += amount
      if (isAgencyRevenue(row.categoryCode, 'income')) {
        summary.agencyRevenue += amount
        bucket.agencyRevenue += amount
      } else {
        summary.transitIncome += amount
        bucket.transitIncome += amount
      }
    } else if (row.categoryCode === OWNER_PAYOUT_CODE) {
      summary.ownerPayouts += amount
    } else if (isAgencyExpense(row.categoryCode, 'expense', row.borneBy ?? null)) {
      summary.agencyExpense += amount
      bucket.agencyExpense += amount
    }
  }

  summary.profit = summary.agencyRevenue - summary.agencyExpense
  summary.byMonth = [...months.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((m) => ({ ...m, profit: m.agencyRevenue - m.agencyExpense }))

  return summary
}
