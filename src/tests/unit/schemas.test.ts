import { describe, it, expect } from 'vitest'
import { ContactSchema, DealSchema, PaymentCreateSchema, ContractSchema } from '@/lib/schemas'

describe('ContactSchema', () => {
  const valid = {
    full_name: 'Иван Петров',
    role: 'client',
    status: 'new',
  }

  it('принимает минимально валидные данные', () => {
    expect(ContactSchema.safeParse(valid).success).toBe(true)
  })

  it('отклоняет пустое имя', () => {
    const r = ContactSchema.safeParse({ ...valid, full_name: '' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].path).toContain('full_name')
  })

  it('отклоняет имя длиннее 200 символов', () => {
    const r = ContactSchema.safeParse({ ...valid, full_name: 'А'.repeat(201) })
    expect(r.success).toBe(false)
  })

  it('отклоняет невалидный email', () => {
    const r = ContactSchema.safeParse({ ...valid, email: 'not-an-email' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].path).toContain('email')
  })

  it('принимает валидный email', () => {
    const r = ContactSchema.safeParse({ ...valid, email: 'ivan@example.com' })
    expect(r.success).toBe(true)
  })

  it('принимает null email', () => {
    const r = ContactSchema.safeParse({ ...valid, email: null })
    expect(r.success).toBe(true)
  })

  it('трансформирует пустой email в null', () => {
    const r = ContactSchema.safeParse({ ...valid, email: '' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.email).toBeNull()
  })

  it('отклоняет неверную роль', () => {
    const r = ContactSchema.safeParse({ ...valid, role: 'superadmin' })
    expect(r.success).toBe(false)
  })

  it('принимает все допустимые роли', () => {
    for (const role of ['client', 'owner', 'both']) {
      expect(ContactSchema.safeParse({ ...valid, role }).success).toBe(true)
    }
  })

  it('ставит статус new по умолчанию', () => {
    const r = ContactSchema.safeParse({ ...valid })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.status).toBe('new')
  })
})

describe('DealSchema', () => {
  const valid = {
    deal_type: 'rent',
  }

  it('принимает валидный тип сделки', () => {
    expect(DealSchema.safeParse(valid).success).toBe(true)
  })

  it('отклоняет неверный тип сделки', () => {
    const r = DealSchema.safeParse({ deal_type: 'unknown' })
    expect(r.success).toBe(false)
  })

  it('принимает все допустимые типы', () => {
    for (const t of ['rent', 'sale', 'management', 'commercial', 'subrent']) {
      expect(DealSchema.safeParse({ deal_type: t }).success).toBe(true)
    }
  })

  it('принимает отрицательную сумму — отклоняет', () => {
    const r = DealSchema.safeParse({ ...valid, amount: '-1000' })
    expect(r.success).toBe(false)
  })

  it('принимает положительную сумму строкой', () => {
    const r = DealSchema.safeParse({ ...valid, amount: '5000000' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.amount).toBe(5000000)
  })

  it('принимает null amount', () => {
    const r = DealSchema.safeParse({ ...valid, amount: null })
    expect(r.success).toBe(true)
  })
})

describe('PaymentCreateSchema', () => {
  const valid = {
    amount: '50000',
    payment_type: 'rent',
  }

  it('принимает валидный платёж', () => {
    expect(PaymentCreateSchema.safeParse(valid).success).toBe(true)
  })

  it('отклоняет нулевую сумму', () => {
    const r = PaymentCreateSchema.safeParse({ ...valid, amount: '0' })
    expect(r.success).toBe(false)
  })

  it('отклоняет отрицательную сумму', () => {
    const r = PaymentCreateSchema.safeParse({ ...valid, amount: '-100' })
    expect(r.success).toBe(false)
  })

  it('отклоняет нечисловую сумму', () => {
    const r = PaymentCreateSchema.safeParse({ ...valid, amount: 'abc' })
    expect(r.success).toBe(false)
  })

  it('конвертирует строковую сумму в число', () => {
    const r = PaymentCreateSchema.safeParse({ ...valid, amount: '75000' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.amount).toBe(75000)
  })

  it('принимает платёж без contract_id', () => {
    expect(PaymentCreateSchema.safeParse(valid).success).toBe(true)
  })
})

describe('ContractSchema', () => {
  const valid = {
    contract_type: 'rent_apartment',
  }

  it('принимает валидный тип договора', () => {
    expect(ContractSchema.safeParse(valid).success).toBe(true)
  })

  it('отклоняет неверный тип договора', () => {
    const r = ContractSchema.safeParse({ contract_type: 'magic_deal' })
    expect(r.success).toBe(false)
  })

  it('принимает все допустимые типы договора', () => {
    const types = [
      'rent_apartment', 'rent_commercial', 'sale_apartment',
      'sale_house', 'property_management', 'sublease', 'agency_contract',
    ]
    for (const t of types) {
      expect(ContractSchema.safeParse({ contract_type: t }).success).toBe(true)
    }
  })

  it('ставит статус draft по умолчанию', () => {
    const r = ContractSchema.safeParse(valid)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.status).toBe('draft')
  })
})
