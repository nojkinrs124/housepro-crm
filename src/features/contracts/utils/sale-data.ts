// Типы и чистые функции для contract_type_data договора купли-продажи (sale),
// без 'use client'.

export type PaymentMethod = 'cash' | 'bank_transfer' | 'mortgage' | 'maternal_capital'
export type RegistrationExpensesPayer = 'buyer' | 'seller' | 'both'

export interface SaleExtraData {
  payment_method: PaymentMethod
  registration_expenses_payer: RegistrationExpensesPayer
  encumbrances: string
  registered_persons: string
  key_transfer_order: string
  advance_amount: string
  copies_count: string
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Наличный расчёт',
  bank_transfer: 'Безналичный перевод',
  mortgage: 'Ипотечные средства',
  maternal_capital: 'Материнский капитал',
}

export const REGISTRATION_EXPENSES_PAYER_LABELS: Record<RegistrationExpensesPayer, string> = {
  buyer: 'Покупатель',
  seller: 'Продавец',
  both: 'Стороны в равных долях',
}

export const SALE_EXTRA_DEFAULTS: SaleExtraData = {
  payment_method: 'bank_transfer',
  registration_expenses_payer: 'buyer',
  encumbrances: 'не имеется',
  registered_persons: 'не имеется',
  key_transfer_order: 'в течение 3 (трёх) рабочих дней после государственной регистрации перехода права собственности',
  advance_amount: '',
  copies_count: '3',
}

export function toSaleDefaults(raw: unknown): Partial<SaleExtraData> {
  if (!raw || typeof raw !== 'object') return {}
  const r = raw as Record<string, unknown>
  const str = (v: unknown) => (v === null || v === undefined ? '' : String(v))

  return {
    payment_method: (r.payment_method as PaymentMethod) ?? undefined,
    registration_expenses_payer: (r.registration_expenses_payer as RegistrationExpensesPayer) ?? undefined,
    encumbrances: r.encumbrances != null ? str(r.encumbrances) : undefined,
    registered_persons: r.registered_persons != null ? str(r.registered_persons) : undefined,
    key_transfer_order: r.key_transfer_order != null ? str(r.key_transfer_order) : undefined,
    advance_amount: str(r.advance_amount),
    copies_count: r.copies_count != null ? str(r.copies_count) : undefined,
  }
}
