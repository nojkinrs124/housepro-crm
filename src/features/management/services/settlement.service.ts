/**
 * Взаиморасчёт с собственником по объекту в управлении.
 *
 * Чистые функции без обращений к базе: по ним считается, сколько агентство
 * должно собственнику и сколько заработало само. Ошибка здесь — это неверная
 * выплата живыми деньгами, поэтому расчёт обязан проверяться тестом.
 *
 * Две схемы, и разница между ними принципиальна:
 *
 *   percent — обязательство перед собственником рождается из фактического
 *             поступления от арендатора. Нет арендатора — нет ни выплаты, ни
 *             вознаграждения. Риск простоя на собственнике.
 *
 *   fixed   — обязательство наступает по календарю, в оговорённый день месяца,
 *             заплатил арендатор или нет. Всё, что собрано сверх выплаты, —
 *             доход агентства; пустой месяц — его убыток. Риск на агентстве.
 *
 * Файл намеренно без 'use client' и без 'use server'.
 */

export type SettlementScheme = 'percent' | 'fixed'

export interface SettlementOperation {
  type: 'income' | 'expense'
  status: string
  /** Код категории (`accounting_categories.code`), не название. */
  categoryCode: string | null
  amount: number
  date: string
  borneBy: 'agency' | 'owner' | null
}

export interface SettlementTerms {
  scheme: SettlementScheme | null
  rate: number | null
  ownerFixedAmount: number | null
  ownerPayoutDay: number | null
  startedAt: string
  endedAt?: string | null
}

export interface SettlementResult {
  /** Поступило от арендатора (только проведённые операции). */
  tenantPayments: number
  /** Вознаграждение агентства за период. */
  agencyFee: number
  /** Расходы, отнесённые на собственника. */
  ownerExpenses: number
  /** Расходы за счёт агентства. */
  agencyExpenses: number
  /** Фактически выплачено собственнику. */
  paidToOwner: number
  /** Начисленное обязательство перед собственником. */
  ownerObligation: number
  /**
   * Сальдо. Положительное — агентство должно собственнику, отрицательное —
   * собственник должен агентству (например, расходы превысили поступления).
   */
  balance: number
  /** Результат агентства. Отрицательный — убыток. */
  agencyResult: number
  /** Сколько месяцев обязательства насчитано при фиксированной схеме. */
  obligationMonths: number
  /** Расчёт невозможен: схема не выбрана. */
  error?: string
}

const COMPLETED = 'completed'

function sum(ops: SettlementOperation[], predicate: (o: SettlementOperation) => boolean): number {
  return ops.filter(predicate).reduce((acc, o) => acc + Number(o.amount || 0), 0)
}

/** Копейки, а не рубли: округление на каждой операции за год расходится заметно. */
function money(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Сколько раз наступил день выплаты между началом обслуживания и датой расчёта.
 *
 * Считаем именно наступления, а не календарные месяцы: обслуживание, начатое
 * 20-го числа с выплатой 5-го, первое обязательство даёт только в следующем
 * месяце. Иначе агентство оказывалось бы должно за месяц, которого не было.
 */
export function obligationMonths(startedAt: string, asOf: string, payoutDay: number): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startedAt) || !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) return 0
  if (asOf < startedAt) return 0

  const day = Math.min(Math.max(payoutDay, 1), 28)
  const [sy, sm] = startedAt.split('-').map(Number)

  let count = 0
  let year = sy
  let month = sm
  // Год вперёд от начала — с запасом: обслуживание длиннее считается по циклу ниже.
  for (let guard = 0; guard < 600; guard++) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    if (date > asOf) break
    if (date >= startedAt) count++
    month++
    if (month > 12) { month = 1; year++ }
  }
  return count
}

/**
 * Считает взаиморасчёт по операциям.
 *
 * `operations` — операции обслуживания за нужный период. Отбор периода делает
 * вызывающий: за месяц для отчёта, за всё время для сальдо.
 */
export function calcSettlement(
  terms: SettlementTerms,
  operations: SettlementOperation[],
  asOf: string = new Date().toISOString().slice(0, 10),
): SettlementResult {
  const empty: SettlementResult = {
    tenantPayments: 0, agencyFee: 0, ownerExpenses: 0, agencyExpenses: 0,
    paidToOwner: 0, ownerObligation: 0, balance: 0, agencyResult: 0, obligationMonths: 0,
  }

  if (!terms.scheme) {
    return {
      ...empty,
      error: 'Схема расчёта не выбрана — ни выплату собственнику, ни вознаграждение агентства посчитать нельзя',
    }
  }

  const done = operations.filter(o => o.status === COMPLETED)

  const tenantPayments = money(sum(done, o => o.type === 'income' && o.categoryCode === 'tenant_payment'))
  const ownerExpenses = money(sum(done, o => o.type === 'expense' && o.borneBy === 'owner' && o.categoryCode !== 'owner_payout'))
  const agencyExpenses = money(sum(done, o => o.type === 'expense' && o.borneBy === 'agency'))
  const paidToOwner = money(sum(done, o => o.type === 'expense' && o.categoryCode === 'owner_payout'))

  if (terms.scheme === 'percent') {
    const rate = Number(terms.rate ?? 0)
    const agencyFee = money(tenantPayments * rate / 100)
    // Обязательство рождается только из фактического поступления: за пустой
    // месяц собственнику ничего не причитается.
    const ownerObligation = money(tenantPayments - agencyFee - ownerExpenses)
    return {
      tenantPayments,
      agencyFee,
      ownerExpenses,
      agencyExpenses,
      paidToOwner,
      ownerObligation,
      balance: money(ownerObligation - paidToOwner),
      agencyResult: money(agencyFee - agencyExpenses),
      obligationMonths: 0,
    }
  }

  // fixed: обязательство по календарю, независимо от поступлений.
  const fixedAmount = Number(terms.ownerFixedAmount ?? 0)
  const payoutDay = Number(terms.ownerPayoutDay ?? 1)
  const untilDate = terms.endedAt && terms.endedAt < asOf ? terms.endedAt : asOf
  const months = obligationMonths(terms.startedAt, untilDate, payoutDay)
  const ownerObligation = money(fixedAmount * months)

  return {
    tenantPayments,
    // Вознаграждения как отдельной величины при фиксированной схеме нет:
    // агентство зарабатывает разницу, и она уже в agencyResult.
    agencyFee: 0,
    ownerExpenses,
    agencyExpenses,
    paidToOwner,
    ownerObligation,
    // Расходы за счёт собственника уменьшают то, что мы ему должны: агентство
    // потратило за него, а не сверх обязательства.
    balance: money(ownerObligation - paidToOwner - ownerExpenses),
    agencyResult: money(tenantPayments - ownerObligation - agencyExpenses),
    obligationMonths: months,
  }
}

/** Границы календарного месяца в виде строк YYYY-MM-DD. */
export function monthBounds(year: number, month: number): { from: string; to: string } {
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return { from, to: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}` }
}

/**
 * Простой объекта: есть ли действующий договор найма на дату.
 *
 * Отдельного статуса «простаивает» у обслуживания нет намеренно: простой — это
 * не состояние договора с собственником, а факт отсутствия арендатора, и он
 * вычисляется, а не проставляется руками.
 */
export function isVacantOn(
  rentContracts: { start_date: string | null; end_date: string | null; status: string }[],
  date: string,
): boolean {
  return !rentContracts.some(c => {
    if (c.status === 'cancelled' || c.status === 'draft') return false
    if (c.start_date && c.start_date > date) return false
    if (c.end_date && c.end_date < date) return false
    return true
  })
}
