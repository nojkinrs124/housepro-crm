/**
 * Правила условий тарифа в договоре.
 *
 * Чистые функции без обращений к базе: по ним считаются деньги, и они обязаны
 * быть проверяемы тестом, а не только глазами в Server Action.
 *
 * Файл без 'use server' и без 'use client' намеренно: его вызывает серверный
 * экшен, а проверяет юнит-тест.
 */

/** Типы договоров, у которых бывает схема расчёта с собственником. */
export const SCHEME_CONTRACT_TYPES = ['property_management', 'sublease']

export interface PlanTermsInput {
  contract_type: string
  plan_id?: string | null
  settlement_scheme?: string | null
  owner_fixed_amount?: number | null
  owner_payout_day?: number | null
}

/** Условия уже заключённого договора — при правке они и остаются в силе. */
export interface ExistingTerms {
  plan_id: string | null
  plan_rate: number | null
}

/**
 * Проверяет согласованность схемы расчёта с её полями.
 * Возвращает текст ошибки или null, если всё сходится.
 */
export function validateSchemeFields(input: PlanTermsInput): string | null {
  const needsScheme = SCHEME_CONTRACT_TYPES.includes(input.contract_type)

  if (input.settlement_scheme && !needsScheme) {
    return 'Схема расчёта с собственником задаётся только в договоре управления или субаренды'
  }
  if (needsScheme && !input.settlement_scheme) {
    return 'Выберите схему расчёта с собственником — процент от платежа или фиксированную выплату'
  }
  if (input.settlement_scheme === 'fixed') {
    if (!input.owner_fixed_amount) {
      return 'Укажите ежемесячную выплату собственнику: при фиксированной схеме она и есть обязательство агентства'
    }
    if (!input.owner_payout_day) {
      return 'Укажите день выплаты собственнику — при фиксированной схеме обязательство наступает по календарю'
    }
  }
  return null
}

/**
 * Нужно ли перечитывать ставку из справочника.
 *
 * Ставка фиксируется на момент подписания: при редактировании договора она НЕ
 * обновляется, иначе подорожание тарифа задним числом переписало бы расчёты по
 * действующим договорам (FR-007). Перечитываем только тогда, когда в договоре
 * осознанно выбрали другой тариф — или когда договор создаётся с нуля.
 */
export function shouldRefetchRate(planId: string | null | undefined, existing?: ExistingTerms | null): boolean {
  if (!planId) return false
  if (!existing) return true
  return existing.plan_id !== planId
}

/**
 * Итоговые поля условий, кроме ставки: её подставляет вызывающий, потому что за
 * ней нужно сходить в справочник.
 */
export function schemeFields(input: PlanTermsInput): {
  settlement_scheme: string | null
  owner_fixed_amount: number | null
  owner_payout_day: number | null
} {
  const fixed = input.settlement_scheme === 'fixed'
  return {
    settlement_scheme: input.settlement_scheme ?? null,
    // При процентной схеме сумма и день выплаты не заполняются: их отсутствие —
    // часть смысла схемы, а не пропуск. Констрейнт в базе проверяет то же самое.
    owner_fixed_amount: fixed ? input.owner_fixed_amount ?? null : null,
    owner_payout_day: fixed ? input.owner_payout_day ?? null : null,
  }
}

/**
 * Проверка условий расчёта у объекта в управлении.
 *
 * Отличается от `validateSchemeFields` тем, что там схема привязана к типу
 * договора, а здесь она свойство самого обслуживания: договора может ещё не
 * быть, а условия уже согласованы.
 */
export function validateEngagementTerms(input: {
  settlement_scheme?: string | null
  rate?: number | null
  owner_fixed_amount?: number | null
  owner_payout_day?: number | null
}): string | null {
  if (!input.settlement_scheme) {
    return 'Выберите схему расчёта с собственником — без неё нельзя посчитать ни его выплату, ни наше вознаграждение'
  }
  if (input.settlement_scheme === 'percent') {
    if (input.rate === null || input.rate === undefined) {
      return 'Укажите процент, который агентство удерживает с платежа арендатора'
    }
    if (input.rate < 0 || input.rate > 100) {
      return 'Процент удержания должен быть от 0 до 100'
    }
  }
  if (input.settlement_scheme === 'fixed') {
    if (!input.owner_fixed_amount) {
      return 'Укажите ежемесячную выплату собственнику: при фиксированной схеме она и есть обязательство агентства'
    }
    if (!input.owner_payout_day) {
      return 'Укажите день выплаты собственнику — обязательство наступает по календарю, а не по факту платежа арендатора'
    }
    if (input.owner_payout_day < 1 || input.owner_payout_day > 28) {
      return 'День выплаты — от 1 до 28: 29-е и позже есть не в каждом месяце'
    }
  }
  return null
}
