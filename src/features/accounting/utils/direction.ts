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
