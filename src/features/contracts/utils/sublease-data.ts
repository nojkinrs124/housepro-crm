// Типы и чистые функции для contract_type_data договора субаренды (sublease),
// без 'use client'.

export interface SubleaseExtraData {
  owner_consent_given: boolean
  owner_consent_document: string
  utilities_included_in_rent: boolean
  utilities_paid_by_tenant: string
  late_return_penalty_per_day: string
  copies_count: string
}

export const SUBLEASE_EXTRA_DEFAULTS: SubleaseExtraData = {
  owner_consent_given: false,
  owner_consent_document: '',
  utilities_included_in_rent: false,
  utilities_paid_by_tenant: 'электроэнергия, холодная и горячая вода',
  late_return_penalty_per_day: '1000',
  copies_count: '2',
}

export function toSubleaseDefaults(raw: unknown): Partial<SubleaseExtraData> {
  if (!raw || typeof raw !== 'object') return {}
  const r = raw as Record<string, unknown>
  const str = (v: unknown) => (v === null || v === undefined ? '' : String(v))

  return {
    owner_consent_given: Boolean(r.owner_consent_given),
    owner_consent_document: str(r.owner_consent_document),
    utilities_included_in_rent: Boolean(r.utilities_included_in_rent),
    utilities_paid_by_tenant: r.utilities_paid_by_tenant != null ? str(r.utilities_paid_by_tenant) : undefined,
    late_return_penalty_per_day: r.late_return_penalty_per_day != null ? str(r.late_return_penalty_per_day) : undefined,
    copies_count: r.copies_count != null ? str(r.copies_count) : undefined,
  }
}
