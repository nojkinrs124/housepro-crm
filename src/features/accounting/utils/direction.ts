import { getContractTypeConfig } from '@/features/contracts/config/contract-types'
import type { DirectionCode } from '@/features/directions/config/directions'

/** Срез статистики/списка операций — общий для Бухгалтерии и Аналитики. */
export interface AccountingFilters {
  employeeId?: string
  propertyId?: string
  direction?: DirectionCode
}

/**
 * Направление работы для операции бухгалтерии. Прямой колонки у операции нет —
 * направление выводится через привязку: к сделке (deal_type — само направление),
 * к обслуживанию (engagement — оно всегда управление) или к договору аренды
 * (contract_type → направление в конфиге типов договоров).
 */
export function transactionDirection(t: {
  contractType: string | null
  engagementId: string | null
  dealType: string | null
}): DirectionCode | null {
  if (t.dealType) return t.dealType as DirectionCode
  if (t.engagementId) return 'management'
  if (t.contractType) return getContractTypeConfig(t.contractType)?.direction ?? null
  return null
}

/**
 * Фоллбэк, когда у операции нет связи ни со сделкой, ни с обслуживанием, ни с
 * договором — только категория и текст назначения. Находка 27.10.2026: 20 из
 * 29 реальных доходов за период введены вручную без выбора сделки/объекта, при
 * этом в самом тексте направление угадывается («управление», «продажа», «по
 * сделке аренды»). Без этого фоллбэка такие операции оседали в «Прочее» и
 * искажали картину (85% дохода выглядело бы неклассифицируемым, хотя на самом
 * деле это обычная аренда/управление без заполненной связи).
 *
 * НЕ подмена `transactionDirection()` — используется только когда та вернула
 * null, и результат в интерфейсе должен быть помечен как предположение
 * («по тексту»), а не как точный факт.
 */
export function guessTransactionDirectionFromText(t: {
  description: string | null
  categoryCode: string | null
}): DirectionCode | null {
  // Категория — надёжнее текста, когда она явно указывает направление.
  if (t.categoryCode === 'management_fee') return 'management'
  if (t.categoryCode === 'agency_fee') return 'rent_agent'

  const text = (t.description ?? '').toLowerCase()
  if (text.includes('продаж')) return 'sale'
  if (text.includes('управлен')) return 'management'
  if (text.includes('подбор')) return 'tenant_search'
  if (['аренд', 'комисси', 'сделк', 'наймодат', 'посуточник'].some(w => text.includes(w))) return 'rent_agent'
  return null
}
