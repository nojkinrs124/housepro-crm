import { describe, it, expect } from 'vitest'
import {
  calcCommission,
  contractTypeForDeal,
  propertyStatusAfterDeal,
  extraServicesFor,
} from '@/features/deals/services/deal-completion'

describe('calcCommission — разовый процент от суммы сделки', () => {
  it('считает 25% от суммы сделки', () => {
    const r = calcCommission({ chargeType: 'deal_percent', rate: 25, dealAmount: 50000 })
    expect(r.amount).toBe(12500)
    expect(r.basis).toContain('25%')
  })

  it('первая сделка с собственником — бесплатно, и причина названа', () => {
    const r = calcCommission({ chargeType: 'deal_percent', rate: 25, dealAmount: 50000, isFirstDealWithOwner: true })
    expect(r.amount).toBe(0)
    expect(r.waivedReason).toContain('Первая сделка')
  })

  it('вторая сделка с тем же собственником уже платная', () => {
    const r = calcCommission({ chargeType: 'deal_percent', rate: 25, dealAmount: 50000, isFirstDealWithOwner: false })
    expect(r.amount).toBe(12500)
  })

  it('округляет до копеек, а не до рублей', () => {
    const r = calcCommission({ chargeType: 'deal_percent', rate: 25, dealAmount: 33333 })
    expect(r.amount).toBe(8333.25)
  })

  it('без суммы сделки процент считать не от чего', () => {
    const r = calcCommission({ chargeType: 'deal_percent', rate: 25, dealAmount: null })
    expect(r.amount).toBe(0)
    expect(r.waivedReason).toContain('сумма сделки')
  })
})

describe('calcCommission — прочие способы начисления', () => {
  it('фиксированная сумма берётся как есть', () => {
    expect(calcCommission({ chargeType: 'flat_fee', rate: 15000, dealAmount: 999999 }).amount).toBe(15000)
  })

  it('договорной тариф берёт сумму из подписанного договора', () => {
    const r = calcCommission({ chargeType: 'negotiated', rate: null, dealAmount: 50000, agreedFee: 35000 })
    expect(r.amount).toBe(35000)
    expect(r.basis).toContain('из подписанного договора')
  })

  it('договорной тариф без суммы в договоре просит её заполнить', () => {
    const r = calcCommission({ chargeType: 'negotiated', rate: null, dealAmount: 50000 })
    expect(r.amount).toBe(0)
    expect(r.waivedReason).toContain('в договоре не указано')
  })

  it('сумма из договора не подменяется процентом от сделки', () => {
    // При подборе комиссия согласована заранее и от суммы найма не зависит.
    const r = calcCommission({ chargeType: 'negotiated', rate: 25, dealAmount: 1000000, agreedFee: 35000 })
    expect(r.amount).toBe(35000)
  })

  it('ежемесячный процент при оформлении не начисляется', () => {
    const r = calcCommission({ chargeType: 'monthly_percent', rate: 10, dealAmount: 50000 })
    expect(r.amount).toBe(0)
    expect(r.waivedReason).toContain('ежемесячным начислением')
  })

  it('фиксированная выплата собственнику при оформлении тоже не начисляется', () => {
    const r = calcCommission({ chargeType: 'owner_fixed', rate: null, dealAmount: 50000 })
    expect(r.amount).toBe(0)
  })

  it('без тарифа считать нечего, и это сказано прямо', () => {
    const r = calcCommission({ chargeType: null, rate: null, dealAmount: 50000 })
    expect(r.amount).toBe(0)
    expect(r.waivedReason).toContain('Тариф не выбран')
  })
})

describe('contractTypeForDeal — направление и тип объекта', () => {
  it('аренда жилья', () => {
    expect(contractTypeForDeal('rent_agent', 'apartment')).toBe('rent_apartment')
  })

  it('коммерческий объект даёт коммерческий договор в том же направлении', () => {
    expect(contractTypeForDeal('rent_agent', 'office')).toBe('rent_commercial')
    expect(contractTypeForDeal('rent_agent', 'warehouse')).toBe('rent_commercial')
  })

  it('управление и продажа', () => {
    expect(contractTypeForDeal('management', 'apartment')).toBe('property_management')
    expect(contractTypeForDeal('sale', 'apartment')).toBe('sale')
  })

  it('подбор для арендатора заканчивается договором найма', () => {
    expect(contractTypeForDeal('tenant_search', 'apartment')).toBe('rent_apartment')
  })
})

describe('propertyStatusAfterDeal', () => {
  it('продажа помечает объект проданным', () => {
    expect(propertyStatusAfterDeal('sale')).toBe('sold')
  })

  it('аренда и подбор помечают сданным', () => {
    expect(propertyStatusAfterDeal('rent_agent')).toBe('rented')
    expect(propertyStatusAfterDeal('tenant_search')).toBe('rented')
  })

  it('управление статус объекта не трогает', () => {
    expect(propertyStatusAfterDeal('management')).toBeNull()
  })
})

describe('extraServicesFor — услуги с фиксированной ценой', () => {
  const plans = [
    { id: 'p1', code: 'legal_support', title: 'Юридическое сопровождение', charge_type: 'flat_fee', rate: 15000, directions: ['sale'] },
    { id: 'p2', code: 'agent', title: 'Агент', charge_type: 'deal_percent', rate: 25, directions: ['rent_agent'] },
    { id: 'p3', code: 'valuation', title: 'Оценка объекта', charge_type: 'flat_fee', rate: 5000, directions: ['sale', 'rent_agent'] },
    { id: 'p4', code: 'broken', title: 'Без цены', charge_type: 'flat_fee', rate: null, directions: ['sale'] },
  ]

  it('берёт только фиксированные услуги своего направления', () => {
    const r = extraServicesFor('sale', plans)
    expect(r.map(s => s.code)).toEqual(['legal_support', 'valuation'])
  })

  it('процентный тариф дополнительной услугой не считается', () => {
    expect(extraServicesFor('rent_agent', plans).map(s => s.code)).toEqual(['valuation'])
  })

  it('услугу без цены не предлагает — начислять было бы нечего', () => {
    expect(extraServicesFor('sale', plans).some(s => s.code === 'broken')).toBe(false)
  })

  it('без направления ничего не предлагает', () => {
    expect(extraServicesFor(null, plans)).toEqual([])
  })
})
