import { describe, it, expect } from 'vitest'
import { ContactSchema, RepresentativeSchema, DealSchema, PaymentCreateSchema, ContractSchema, RentApartmentDataSchema } from '@/lib/schemas'

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

  it('ставит client_type individual по умолчанию', () => {
    const r = ContactSchema.safeParse({ ...valid })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.client_type).toBe('individual')
  })

  it('требует company_name и inn для юрлица', () => {
    const r = ContactSchema.safeParse({ ...valid, client_type: 'legal_entity' })
    expect(r.success).toBe(false)
    if (!r.success) {
      const paths = r.error.issues.map(i => i.path.join('.'))
      expect(paths).toContain('company_name')
      expect(paths).toContain('inn')
    }
  })

  it('принимает корректное юрлицо', () => {
    const r = ContactSchema.safeParse({
      ...valid,
      client_type: 'legal_entity',
      company_name: 'ООО "Ромашка"',
      inn: '7707083893',
    })
    expect(r.success).toBe(true)
  })
})

describe('RepresentativeSchema', () => {
  const valid = {
    contact_id: '11111111-1111-4111-8111-111111111111',
    full_name: 'Иванов Иван Иванович',
  }

  it('принимает минимально валидные данные', () => {
    expect(RepresentativeSchema.safeParse(valid).success).toBe(true)
  })

  it('отклоняет некорректный contact_id', () => {
    const r = RepresentativeSchema.safeParse({ ...valid, contact_id: 'not-a-uuid' })
    expect(r.success).toBe(false)
  })

  it('отклоняет пустое ФИО', () => {
    const r = RepresentativeSchema.safeParse({ ...valid, full_name: '' })
    expect(r.success).toBe(false)
  })

  it('ставит basis_type power_of_attorney по умолчанию', () => {
    const r = RepresentativeSchema.safeParse(valid)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.basis_type).toBe('power_of_attorney')
  })

  it('трансформирует is_primary из чекбокса формы', () => {
    const r = RepresentativeSchema.safeParse({ ...valid, is_primary: 'on' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.is_primary).toBe(true)
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
      'rent_apartment', 'rent_commercial', 'sale',
      'agency_owner', 'agency_client', 'agency_legal_entity',
      'property_management', 'sublease',
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

describe('RentApartmentDataSchema', () => {
  it('принимает пустой объект (все поля опциональны)', () => {
    expect(RentApartmentDataSchema.safeParse({}).success).toBe(true)
  })

  it('нормализует пустой объект к значениям по умолчанию для массивов', () => {
    const r = RentApartmentDataSchema.safeParse({})
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.cohabitants).toEqual([])
      expect(r.data.inventory_items).toEqual([])
    }
  })

  it('принимает список проживающих и опись имущества', () => {
    const r = RentApartmentDataSchema.safeParse({
      cohabitants: [{ full_name: 'Иванов Иван', passport: '1234 567890' }],
      inventory_items: [{ name: 'Диван', qty: 1, unit_price: 30000, condition: 'хорошее' }],
      pets_allowed: true,
      pets_species: 'кошка',
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.cohabitants[0].full_name).toBe('Иванов Иван')
      expect(r.data.inventory_items[0].name).toBe('Диван')
      expect(r.data.pets_allowed).toBe(true)
    }
  })

  it('отклоняет проживающего без ФИО', () => {
    const r = RentApartmentDataSchema.safeParse({ cohabitants: [{ full_name: '' }] })
    expect(r.success).toBe(false)
  })

  it('приводит concierge_internet_payer только к допустимым значениям', () => {
    expect(RentApartmentDataSchema.safeParse({ concierge_internet_payer: 'tenant' }).success).toBe(true)
    expect(RentApartmentDataSchema.safeParse({ concierge_internet_payer: 'someone_else' }).success).toBe(false)
  })
})
