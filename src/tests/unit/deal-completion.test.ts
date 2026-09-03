import { describe, it, expect } from 'vitest'
import {
  contractTypeForDeal,
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
})

describe('propertyStatusAfterDeal', () => {
  it('аренда делает объект сданным, продажа — проданным', () => {
    expect(propertyStatusAfterDeal('rent_agent')).toBe('rented')
    expect(propertyStatusAfterDeal('sale')).toBe('sold')
  })

  it('управление статус объекта не меняет — он может быть и сдан, и свободен', () => {
    expect(propertyStatusAfterDeal('management')).toBeNull()
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
