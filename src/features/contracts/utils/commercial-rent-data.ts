// Типы и чистые функции для contract_type_data договора аренды коммерческой
// недвижимости (rent_commercial), без 'use client'.

import type { InventoryItem } from './rent-apartment-data'

export type RenovationBy = 'tenant' | 'landlord'

export interface CommercialRentExtraData {
  usage_purpose: string
  vat_included: boolean
  renovation_by: RenovationBy
  late_return_penalty_per_day: string
  copies_count: string
  inventory_items: InventoryItem[]
}

export const COMMERCIAL_RENT_EXTRA_DEFAULTS: CommercialRentExtraData = {
  usage_purpose: '',
  vat_included: false,
  renovation_by: 'tenant',
  late_return_penalty_per_day: '1000',
  copies_count: '2',
  inventory_items: [],
}

export function toCommercialRentDefaults(raw: unknown): Partial<CommercialRentExtraData> {
  if (!raw || typeof raw !== 'object') return {}
  const r = raw as Record<string, unknown>
  const str = (v: unknown) => (v === null || v === undefined ? '' : String(v))

  return {
    usage_purpose: str(r.usage_purpose),
    vat_included: Boolean(r.vat_included),
    renovation_by: (r.renovation_by as RenovationBy) ?? undefined,
    late_return_penalty_per_day: r.late_return_penalty_per_day != null ? str(r.late_return_penalty_per_day) : undefined,
    copies_count: r.copies_count != null ? str(r.copies_count) : undefined,
    inventory_items: Array.isArray(r.inventory_items)
      ? (r.inventory_items as Array<Record<string, unknown>>).map(it => ({
          name: str(it.name), qty: str(it.qty), unit_price: str(it.unit_price), condition: str(it.condition),
        }))
      : [],
  }
}
