/**
 * Единое определение того, что считается доходом/расходом агентства, а не
 * транзитом или расчётом с собственником. Извлечено из уже проверенной логики
 * settlement.service.ts — раньше Бухгалтерия игнорировала это деление вовсе, а
 * Аналитика держала свою копию списка кодов, и цифры на двух экранах расходились.
 */

export const PASS_THROUGH_INCOME_CODES = new Set(['tenant_payment', 'deposit'])
export const OWNER_PAYOUT_CODE = 'owner_payout'

export function isAgencyRevenue(categoryCode: string | null, type: 'income' | 'expense'): boolean {
  return type === 'income' && !PASS_THROUGH_INCOME_CODES.has(categoryCode ?? '')
}

export function isAgencyExpense(
  categoryCode: string | null,
  type: 'income' | 'expense',
  borneBy: 'agency' | 'owner' | null,
): boolean {
  return type === 'expense' && categoryCode !== OWNER_PAYOUT_CODE && borneBy !== 'owner'
}

/**
 * Статус операции → форма «платежа» для внешних потребителей (боту, аналитике).
 * `accounting_transactions.status` знает только completed/planned/cancelled —
 * pending/overdue вычисляются по сроку, а не хранятся.
 */
export function toPaymentStatus(
  status: string,
  dueDate: string | null,
  todayIso: string,
): 'paid' | 'pending' | 'overdue' | 'cancelled' {
  if (status === 'completed') return 'paid'
  if (status === 'planned') return dueDate && dueDate < todayIso ? 'overdue' : 'pending'
  return 'cancelled'
}
