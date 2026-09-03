/**
 * Месячный отчёт собственнику.
 *
 * Состав отчёта зависит от схемы расчёта, и это не косметика (FR-033):
 *
 *   percent — собственник видит поступления, удержание агентства, расходы и
 *             сумму к выплате. Удержание раскрывается: он платит процент и
 *             имеет право видеть, сколько именно.
 *
 *   fixed   — собственник видит обязательство за период, факт выплаты и расходы,
 *             отнесённые на него. Доход агентства НЕ раскрывается: он получает
 *             оговорённую сумму, а сколько агентство собрало сверх неё — его
 *             коммерческий риск и не касается собственника.
 *
 * Файл намеренно без 'use client' и без 'use server'.
 */

import {
  calcSettlement,
  monthBounds,
  type SettlementOperation,
  type SettlementTerms,
  type SettlementResult,
} from './settlement.service'

export interface ReportLine {
  label: string
  amount: number
  /** Отрицательные суммы показываются как удержания и расходы. */
  negative?: boolean
  hint?: string
}

export interface MonthlyReport {
  year: number
  month: number
  from: string
  to: string
  scheme: 'percent' | 'fixed' | null
  /** Строки отчёта в порядке показа. */
  lines: ReportLine[]
  /** Итог: сколько причитается собственнику за период. */
  dueToOwner: number
  /** Сальдо на конец периода с начала обслуживания. */
  balanceToDate: number
  /** Результат агентства за период. Показывается только внутри CRM. */
  agencyResult: number
  /** Период не закрыт: есть запланированные операции внутри него. */
  hasPending: boolean
  error?: string
}

const CATEGORY_LABELS: Record<string, string> = {
  repair_minor: 'Мелкий ремонт',
  cleaning: 'Клининг',
  utilities: 'Коммунальные платежи',
  contractor: 'Услуги подрядчиков',
}

function money(v: number): number {
  return Math.round(v * 100) / 100
}

/**
 * Собирает отчёт за календарный месяц.
 *
 * `periodOperations` — операции внутри месяца, `allOperations` — с начала
 * обслуживания: сальдо накопительное, а строки отчёта — за период.
 */
export function buildMonthlyReport(
  terms: SettlementTerms,
  year: number,
  month: number,
  periodOperations: SettlementOperation[],
  allOperations: SettlementOperation[],
): MonthlyReport {
  const { from, to } = monthBounds(year, month)

  const base = {
    year, month, from, to,
    scheme: terms.scheme,
    lines: [] as ReportLine[],
    dueToOwner: 0,
    balanceToDate: 0,
    agencyResult: 0,
    hasPending: periodOperations.some(o => o.status === 'planned'),
  }

  if (!terms.scheme) {
    return { ...base, error: 'Схема расчёта не выбрана — отчёт собрать не из чего' }
  }

  const period: SettlementResult = calcSettlement(terms, periodOperations, to)
  const cumulative: SettlementResult = calcSettlement(terms, allOperations, to)

  const expenseLines: ReportLine[] = Object.entries(CATEGORY_LABELS)
    .map(([code, label]) => ({
      label,
      amount: money(periodOperations
        .filter(o => o.status === 'completed' && o.type === 'expense' && o.categoryCode === code && o.borneBy === 'owner')
        .reduce((s, o) => s + Number(o.amount || 0), 0)),
      negative: true,
    }))
    .filter(l => l.amount > 0)

  const lines: ReportLine[] = []

  if (terms.scheme === 'percent') {
    lines.push({ label: 'Поступило от арендатора', amount: period.tenantPayments })
    lines.push({
      label: `Удержание агентства${terms.rate != null ? ` (${terms.rate}%)` : ''}`,
      amount: period.agencyFee,
      negative: true,
    })
    lines.push(...expenseLines)
    lines.push({ label: 'Выплачено собственнику', amount: period.paidToOwner, negative: true })
  } else {
    lines.push({
      label: 'Обязательство агентства за период',
      amount: period.ownerObligation,
      hint: period.obligationMonths > 1
        ? `${period.obligationMonths} выплаты по договору`
        : 'фиксированная выплата по договору',
    })
    lines.push(...expenseLines)
    lines.push({ label: 'Выплачено собственнику', amount: period.paidToOwner, negative: true })
  }

  return {
    ...base,
    lines,
    // За период причитается: начисленное обязательство минус то, что уже выплачено.
    dueToOwner: money(period.ownerObligation - period.paidToOwner),
    balanceToDate: cumulative.balance,
    agencyResult: period.agencyResult,
  }
}

/**
 * Раскрывать ли собственнику доход агентства.
 *
 * При фиксированной схеме — нет: он получает оговорённую сумму, а маржа
 * агентства его не касается. Значение нужно и отчёту в CRM, и личному кабинету.
 */
export function disclosesAgencyResult(scheme: string | null | undefined): boolean {
  return scheme === 'percent'
}
