import { describe, it, expect } from 'vitest'
import {
  contractTypeForDeal,
  requiredForContract,
  propertyStatusAfterDeal,
  needsSchedule,
  suggestContractNumber,
  defaultEndDate,
  defaultTaskDeadline,
  buildCompletionPlan,
} from '@/features/deals/services/deal-completion'

describe('contractTypeForDeal', () => {
  it('аренда жилья и аренда коммерции — разные договоры одного направления', () => {
    expect(contractTypeForDeal('rent_agent', 'apartment')).toBe('rent_apartment')
    expect(contractTypeForDeal('rent_agent', 'office')).toBe('rent_commercial')
  })

  it('продажа и управление берутся по направлению работы', () => {
    expect(contractTypeForDeal('sale', 'apartment')).toBe('sale')
    expect(contractTypeForDeal('management', 'apartment')).toBe('property_management')
  })

  it('неизвестное направление не роняет оформление', () => {
    expect(contractTypeForDeal(null)).toBe('rent_apartment')
  })

  it('до агентского договора включительно оформляется договор агентства, дальше — итоговый', () => {
    expect(contractTypeForDeal('rent_agent', 'apartment', 'agency_contract')).toBe('agency_owner')
    expect(contractTypeForDeal('rent_agent', 'apartment', 'tenant_check')).toBe('rent_apartment')
    expect(contractTypeForDeal('sale', 'apartment', 'agency_contract')).toBe('agency_owner')
    expect(contractTypeForDeal('sale', 'apartment', 'main_contract')).toBe('sale')
    expect(contractTypeForDeal('management', 'apartment', 'mgmt_contract')).toBe('property_management')
    expect(contractTypeForDeal('management', 'apartment', 'tenant_check')).toBe('rent_apartment')
    expect(contractTypeForDeal('tenant_search', null, 'search_contract')).toBe('agency_client')
    expect(contractTypeForDeal('tenant_search', null, 'search_contract', 'legal_entity')).toBe('agency_legal_entity')
    expect(contractTypeForDeal('tenant_search', 'apartment', 'rent_contract')).toBe('rent_apartment')
  })

  it('агентскому договору не нужны клиент и объект, договору на подбор — собственник', () => {
    expect(requiredForContract('agency_owner')).toEqual({ owner: true, client: false, property: false })
    expect(requiredForContract('agency_client')).toEqual({ owner: false, client: true, property: false })
    expect(requiredForContract('rent_apartment')).toEqual({ owner: true, client: true, property: true })
  })
})

describe('propertyStatusAfterDeal', () => {
  it('аренда делает объект сданным, продажа — проданным', () => {
    expect(propertyStatusAfterDeal('rent_agent')).toBe('rented')
    expect(propertyStatusAfterDeal('sale')).toBe('sold')
  })

  it('управление после заселения тоже делает объект сданным', () => {
    expect(propertyStatusAfterDeal('management')).toBe('rented')
  })

  it('на агентской стадии мастер не трогает статус объекта и не начисляет комиссию', () => {
    const plan = buildCompletionPlan({ dealType: 'rent_agent', stage: 'agency_contract', amount: 50000, seqInYear: 1, planChargeType: 'deal_percent', planRate: 50 })
    expect(plan.contractType).toBe('agency_owner')
    expect(plan.propertyStatus).toBeNull()
    expect(plan.withSchedule).toBe(false)
    expect(plan.commission.amount).toBe(0)
    // Сумма агентского договора — вознаграждение, а не цена объекта.
    expect(plan.amount).toBe(25000)
  })
})

describe('needsSchedule', () => {
  it('аренде и управлению график нужен, продаже — нет', () => {
    expect(needsSchedule('rent_apartment')).toBe(true)
    expect(needsSchedule('property_management')).toBe(true)
    expect(needsSchedule('sale')).toBe(false)
  })
})

describe('suggestContractNumber', () => {
  it('собирает номер из типа, года и порядкового номера', () => {
    expect(suggestContractNumber('rent_apartment', 14, '2026-09-03')).toBe('АР-2026-014')
    expect(suggestContractNumber('sale', 3, '2026-09-03')).toBe('КП-2026-003')
  })

  it('незнакомому типу даёт нейтральный префикс', () => {
    expect(suggestContractNumber('unknown', 1, '2026-09-03')).toBe('ДГ-2026-001')
  })
})

describe('defaultEndDate', () => {
  it('наём жилья — 11 месяцев без дня, чтобы не регистрировать договор', () => {
    expect(defaultEndDate('2026-09-03', 'rent_apartment')).toBe('2027-08-02')
  })

  it('управление — год без дня', () => {
    expect(defaultEndDate('2026-09-03', 'property_management')).toBe('2027-09-02')
  })

  it('у продажи срока нет', () => {
    expect(defaultEndDate('2026-09-03', 'sale')).toBeNull()
  })

  it('31-е число схлопывается в конец короткого месяца', () => {
    expect(defaultEndDate('2026-03-31', 'rent_apartment')).toBe('2027-02-27')
  })

  it('мусор на входе не превращается в дату', () => {
    expect(defaultEndDate('', 'rent_apartment')).toBeNull()
  })
})

describe('defaultTaskDeadline', () => {
  it('три дня от начала договора', () => {
    expect(defaultTaskDeadline('2026-09-03', '2026-09-03')).toBe('2026-09-06')
  })

  it('договор с будущей датой не отодвигает задачу — считаем от сегодня', () => {
    expect(defaultTaskDeadline('2026-12-01', '2026-09-03')).toBe('2026-09-06')
  })
})

describe('buildCompletionPlan', () => {
  it('аренда квартиры: договор, график, задача и статус объекта', () => {
    const plan = buildCompletionPlan({
      dealType: 'rent_agent',
      propertyType: 'apartment',
      amount: 50000,
      seqInYear: 7,
      today: '2026-09-03',
      planChargeType: 'deal_percent',
      planRate: 25,
      isFirstDealWithOwner: false,
    })
    expect(plan.commission.amount).toBe(12500)
    expect(plan).toMatchObject({
      contractType: 'rent_apartment',
      contractNumber: 'АР-2026-007',
      startDate: '2026-09-03',
      endDate: '2027-08-02',
      periodicity: 'monthly',
      withSchedule: true,
      propertyStatus: 'rented',
      taskDeadline: '2026-09-06',
    })
  })

  it('продажа: графика нет, объект становится проданным', () => {
    const plan = buildCompletionPlan({
      dealType: 'sale',
      propertyType: 'apartment',
      amount: 9000000,
      seqInYear: 1,
      today: '2026-09-03',
    })
    expect(plan.withSchedule).toBe(false)
    expect(plan.endDate).toBeNull()
    expect(plan.propertyStatus).toBe('sold')
  })

  it('без суммы график заранее не включается', () => {
    const plan = buildCompletionPlan({
      dealType: 'rent_agent',
      propertyType: 'apartment',
      amount: null,
      seqInYear: 1,
      today: '2026-09-03',
    })
    expect(plan.withSchedule).toBe(false)
  })
})
