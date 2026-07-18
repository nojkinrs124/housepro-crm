// Типы и чистые функции для contract_type_data договора доверительного
// управления недвижимостью (property_management), без 'use client'.

export type ReportFrequency = 'weekly' | 'monthly' | 'quarterly'

export interface PropertyManagementExtraData {
  services: string[]
  service_other: string
  report_frequency: ReportFrequency
  reward_details: string
}

export const PROPERTY_MANAGEMENT_SERVICE_OPTIONS: { value: string; label: string }[] = [
  { value: 'tenant_search', label: 'Поиск арендаторов' },
  { value: 'rent_collection', label: 'Сбор арендных платежей' },
  { value: 'maintenance', label: 'Техническое обслуживание объекта' },
  { value: 'reporting', label: 'Регулярная отчётность перед собственником' },
  { value: 'utility_payments', label: 'Оплата коммунальных услуг' },
  { value: 'inspections', label: 'Периодические осмотры объекта' },
]

export const REPORT_FREQUENCY_LABELS: Record<ReportFrequency, string> = {
  weekly: 'Еженедельно',
  monthly: 'Ежемесячно',
  quarterly: 'Ежеквартально',
}

export const PROPERTY_MANAGEMENT_EXTRA_DEFAULTS: PropertyManagementExtraData = {
  services: [],
  service_other: '',
  report_frequency: 'monthly',
  reward_details: '',
}

export function toPropertyManagementDefaults(raw: unknown): Partial<PropertyManagementExtraData> {
  if (!raw || typeof raw !== 'object') return {}
  const r = raw as Record<string, unknown>
  const str = (v: unknown) => (v === null || v === undefined ? '' : String(v))

  return {
    services: Array.isArray(r.services) ? (r.services as unknown[]).map(String) : [],
    service_other: str(r.service_other),
    report_frequency: (r.report_frequency as ReportFrequency) ?? undefined,
    reward_details: str(r.reward_details),
  }
}
