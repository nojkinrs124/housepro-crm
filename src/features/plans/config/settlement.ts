/**
 * Схемы расчёта с собственником при управлении.
 *
 * Собственник выбирает одну из двух — и от этого зависит не только формула
 * вознаграждения, но и то, КТО НЕСЁТ РИСК ПРОСТОЯ:
 *
 *   percent — агентство удерживает процент от платежа арендатора. Нет арендатора —
 *             нет платежа ни собственнику, ни агентству. Риск на собственнике.
 *   fixed   — агентство платит собственнику оговорённую сумму каждый месяц и
 *             оставляет себе всё сверх неё. Пустой месяц агентство оплачивает из
 *             своего кармана. Риск на агентстве.
 *
 * Раньше вторая схема называлась «субаренда» и жила отдельным типом сделки. Это
 * не отдельный процесс, а способ расчёта внутри управления.
 *
 * Файл намеренно без 'use client'.
 */

export type SettlementScheme = 'percent' | 'fixed'

export interface SettlementSchemeConfig {
  value: SettlementScheme
  label: string
  /** Как объясняем собственнику. */
  description: string
  /** Кто теряет деньги, если объект стоит пустым. */
  vacancyRiskBearer: 'owner' | 'agency'
  /** Поля договора, обязательные при этой схеме. */
  requiredFields: readonly string[]
  /** Поля, которые при этой схеме заполнять нельзя. */
  forbiddenFields: readonly string[]
}

export const SETTLEMENT_SCHEMES: readonly SettlementSchemeConfig[] = [
  {
    value: 'percent',
    label: 'Процент от платежа',
    description: 'Агентство удерживает процент от платежа арендатора, остаток перечисляет собственнику. За пустой месяц не начисляется ничего.',
    vacancyRiskBearer: 'owner',
    requiredFields: ['plan_rate'],
    forbiddenFields: ['owner_fixed_amount', 'owner_payout_day'],
  },
  {
    value: 'fixed',
    label: 'Фиксированная выплата собственнику',
    description: 'Агентство платит собственнику фиксированную сумму ежемесячно и оставляет себе всё сверх неё. За пустой месяц агентство платит из своих средств.',
    vacancyRiskBearer: 'agency',
    requiredFields: ['owner_fixed_amount', 'owner_payout_day'],
    forbiddenFields: [],
  },
] as const

export const SETTLEMENT_SCHEME_VALUES: SettlementScheme[] = SETTLEMENT_SCHEMES.map(s => s.value)

export const SETTLEMENT_SCHEME_LABELS: Record<string, string> =
  Object.fromEntries(SETTLEMENT_SCHEMES.map(s => [s.value, s.label]))

export function getSettlementScheme(value: string | null | undefined): SettlementSchemeConfig | undefined {
  return SETTLEMENT_SCHEMES.find(s => s.value === value)
}

/**
 * Способы начисления вознаграждения агентства (`service_plans.charge_type`).
 *
 * `owner_fixed` стоит особняком: это не ставка, а обязательство перед
 * собственником, и вознаграждение при нём вычисляется как разница.
 */
export type ChargeType = 'deal_percent' | 'monthly_percent' | 'owner_fixed' | 'flat_fee' | 'negotiated'

export interface ChargeTypeConfig {
  value: ChargeType
  label: string
  /** Нужна ли ставка в справочнике тарифов. */
  needsRate: boolean
  /** Единица ставки для подписи поля. */
  rateUnit?: '%' | '₽'
  hint: string
}

export const CHARGE_TYPES: readonly ChargeTypeConfig[] = [
  { value: 'deal_percent',    label: 'Процент от суммы сделки',      needsRate: true,  rateUnit: '%', hint: 'Разово при заселении или закрытии сделки' },
  { value: 'monthly_percent', label: 'Процент от платежа',            needsRate: true,  rateUnit: '%', hint: 'Ежемесячно, при поступлении платежа арендатора' },
  { value: 'owner_fixed',     label: 'Фиксированная выплата собственнику', needsRate: false,          hint: 'Вознаграждение — разница между платежом и выплатой. Сумма задаётся в договоре' },
  { value: 'flat_fee',        label: 'Фиксированная сумма',           needsRate: true,  rateUnit: '₽', hint: 'Одинаковая сумма независимо от объекта' },
  { value: 'negotiated',      label: 'Договорная',                    needsRate: false,              hint: 'Размер согласуется и фиксируется в договоре' },
] as const

export const CHARGE_TYPE_VALUES: ChargeType[] = CHARGE_TYPES.map(c => c.value)

export const CHARGE_TYPE_LABELS: Record<string, string> =
  Object.fromEntries(CHARGE_TYPES.map(c => [c.value, c.label]))

export function getChargeType(value: string | null | undefined): ChargeTypeConfig | undefined {
  return CHARGE_TYPES.find(c => c.value === value)
}
