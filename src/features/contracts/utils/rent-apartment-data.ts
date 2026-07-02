// Типы и чистые функции для contract_type_data (rent_apartment), без 'use client' —
// импортируются и из серверных компонентов (страницы), и из клиентской формы.

export interface Cohabitant {
  full_name: string
  passport: string
}

export interface InventoryItem {
  name: string
  qty: string
  unit_price: string
  condition: string
}

export interface RentApartmentExtraData {
  cohabitants: Cohabitant[]
  children_count: string
  pets_allowed: boolean
  pets_species: string
  pets_count: string
  renewal_notice_months: string
  termination_notice_days: string
  late_return_penalty_per_day: string
  landlord_access_notice_days: string
  utilities_included_in_rent: boolean
  utilities_paid_by_tenant: string
  concierge_internet_payer: 'tenant' | 'landlord'
  copies_count: string
  handover_date: string
  handover_keys_count: string
  electricity_meter_reading: string
  hot_water_meter_reading: string
  cold_water_meter_reading: string
  inventory_items: InventoryItem[]
  return_date: string
  return_keys_count: string
  return_claims: string
}

export const RENT_APARTMENT_EXTRA_DEFAULTS: RentApartmentExtraData = {
  cohabitants: [],
  children_count: '',
  pets_allowed: false,
  pets_species: '',
  pets_count: '',
  renewal_notice_months: '1',
  termination_notice_days: '30',
  late_return_penalty_per_day: '1000',
  landlord_access_notice_days: '1',
  utilities_included_in_rent: false,
  utilities_paid_by_tenant: 'электроэнергия, холодная и горячая вода',
  concierge_internet_payer: 'tenant',
  copies_count: '2',
  handover_date: '',
  handover_keys_count: '2',
  electricity_meter_reading: '',
  hot_water_meter_reading: '',
  cold_water_meter_reading: '',
  inventory_items: [],
  return_date: '',
  return_keys_count: '',
  return_claims: '',
}

// Приводит contract_type_data из БД (числа/bool/null) к строковым значениям для контролируемых полей формы.
export function toExtraFieldsDefaults(raw: unknown): Partial<RentApartmentExtraData> {
  if (!raw || typeof raw !== 'object') return {}
  const r = raw as Record<string, unknown>
  const str = (v: unknown) => (v === null || v === undefined ? '' : String(v))

  return {
    cohabitants: Array.isArray(r.cohabitants)
      ? (r.cohabitants as Array<Record<string, unknown>>).map(c => ({
          full_name: str(c.full_name), passport: str(c.passport),
        }))
      : [],
    children_count: str(r.children_count),
    pets_allowed: Boolean(r.pets_allowed),
    pets_species: str(r.pets_species),
    pets_count: str(r.pets_count),
    renewal_notice_months: r.renewal_notice_months != null ? str(r.renewal_notice_months) : undefined,
    termination_notice_days: r.termination_notice_days != null ? str(r.termination_notice_days) : undefined,
    late_return_penalty_per_day: r.late_return_penalty_per_day != null ? str(r.late_return_penalty_per_day) : undefined,
    landlord_access_notice_days: r.landlord_access_notice_days != null ? str(r.landlord_access_notice_days) : undefined,
    utilities_included_in_rent: Boolean(r.utilities_included_in_rent),
    utilities_paid_by_tenant: r.utilities_paid_by_tenant != null ? str(r.utilities_paid_by_tenant) : undefined,
    concierge_internet_payer: (r.concierge_internet_payer as 'tenant' | 'landlord') ?? undefined,
    copies_count: r.copies_count != null ? str(r.copies_count) : undefined,
    handover_date: str(r.handover_date).slice(0, 10),
    handover_keys_count: r.handover_keys_count != null ? str(r.handover_keys_count) : undefined,
    electricity_meter_reading: str(r.electricity_meter_reading),
    hot_water_meter_reading: str(r.hot_water_meter_reading),
    cold_water_meter_reading: str(r.cold_water_meter_reading),
    inventory_items: Array.isArray(r.inventory_items)
      ? (r.inventory_items as Array<Record<string, unknown>>).map(it => ({
          name: str(it.name), qty: str(it.qty), unit_price: str(it.unit_price), condition: str(it.condition),
        }))
      : [],
    return_date: str(r.return_date).slice(0, 10),
    return_keys_count: r.return_keys_count != null ? str(r.return_keys_count) : undefined,
    return_claims: str(r.return_claims),
  }
}
