// Типы и чистые функции для contract_type_data агентских договоров
// (agency_owner, agency_client, agency_legal_entity), без 'use client' —
// импортируются и из серверных компонентов (страницы), и из клиентской формы.

export type RewardModel = 'fixed' | 'percent' | 'fixed_percent'
export type PaymentTerms = 'on_signing' | 'on_completion' | 'installments'

export interface AgencyServiceExtraData {
  services: string[]
  service_other: string
  reward_model: RewardModel
  reward_percent: string
  payment_terms: PaymentTerms
}

export const AGENCY_SERVICE_OPTIONS: { value: string; label: string }[] = [
  { value: 'search_property', label: 'Поиск объекта недвижимости' },
  { value: 'search_tenant_buyer', label: 'Поиск арендатора / покупателя' },
  { value: 'showings', label: 'Организация показов объекта' },
  { value: 'legal_support', label: 'Юридическое сопровождение сделки' },
  { value: 'advertising', label: 'Рекламное продвижение объекта' },
  { value: 'full_support', label: 'Полное сопровождение сделки' },
]

export const REWARD_MODEL_LABELS: Record<RewardModel, string> = {
  fixed: 'Фиксированная сумма',
  percent: '% от суммы сделки',
  fixed_percent: 'Фикс. сумма + %',
}

export const PAYMENT_TERMS_LABELS: Record<PaymentTerms, string> = {
  on_signing: 'При подписании договора',
  on_completion: 'По факту оказания услуги',
  installments: 'Поэтапно',
}

export const AGENCY_SERVICE_EXTRA_DEFAULTS: AgencyServiceExtraData = {
  services: [],
  service_other: '',
  reward_model: 'fixed',
  reward_percent: '',
  payment_terms: 'on_signing',
}

// Приводит contract_type_data из БД к строковым значениям для контролируемых полей формы.
export function toAgencyServiceDefaults(raw: unknown): Partial<AgencyServiceExtraData> {
  if (!raw || typeof raw !== 'object') return {}
  const r = raw as Record<string, unknown>
  const str = (v: unknown) => (v === null || v === undefined ? '' : String(v))

  return {
    services: Array.isArray(r.services) ? (r.services as unknown[]).map(String) : [],
    service_other: str(r.service_other),
    reward_model: (r.reward_model as RewardModel) ?? undefined,
    reward_percent: str(r.reward_percent),
    payment_terms: (r.payment_terms as PaymentTerms) ?? undefined,
  }
}
