import { describe, it, expect } from 'vitest'
import {
  CHARGE_CATEGORY_CODE,
  buildChargeRows,
  chargeCategoryCode,
  chargeKindFor,
  type ChargeItem,
} from '@/features/accounting/services/charges'
import { calcSettlement, type SettlementOperation } from '@/features/management/services/settlement.service'
import { isAgencyRevenue } from '@/features/accounting/utils/money-classification'

/**
 * Смысл этих тестов — не в строках INSERT, а в деньгах: залог не должен
 * попадать ни в доход агентства, ни в базу процента при взаиморасчёте.
 * Дефект 22.10.2026 был именно в категории, а не в арифметике.
 */

const links = {
  organizationId: 'org-1',
  createdBy: 'user-1',
  contractId: 'contract-1',
  propertyId: 'property-1',
  engagementId: 'engagement-1',
}

const categoryIds = { rent: 'cat-rent', deposit: 'cat-deposit', management_fee: 'cat-mgmt' }

function item(overrides: Partial<ChargeItem> = {}): ChargeItem {
  return { kind: 'rent', amount: 30_000, label: 'Аренда', ...overrides }
}

describe('chargeCategoryCode', () => {
  it('залог идёт в отдельную категорию, а не в арендный платёж', () => {
    expect(chargeCategoryCode('deposit')).toBe('deposit')
    expect(chargeCategoryCode('rent')).toBe('tenant_payment')
    expect(chargeCategoryCode('deposit')).not.toBe(chargeCategoryCode('rent'))
  })

  it('платёж по договору управления — это вознаграждение за управление', () => {
    expect(chargeKindFor('rent', 'property_management')).toBe('management_fee')
    expect(chargeKindFor('rent', 'rent_apartment')).toBe('rent')
    expect(chargeKindFor('rent', null)).toBe('rent')
  })

  it('депозит остаётся депозитом при любом типе договора', () => {
    expect(chargeKindFor('deposit', 'property_management')).toBe('deposit')
    expect(chargeKindFor('deposit', 'rent_apartment')).toBe('deposit')
  })
})

describe('buildChargeRows', () => {
  it('первая строка графика-депозита получает категорию депозита', () => {
    const rows = buildChargeRows(
      [item({ kind: 'deposit', amount: 30_000, label: 'Депозит' }), item({ amount: 30_000 })],
      links,
      categoryIds,
      '2026-10-22',
    )

    expect(rows).toHaveLength(2)
    expect(rows[0].category_id).toBe(categoryIds.deposit)
    expect(rows[1].category_id).toBe(categoryIds.rent)
    expect(rows[0].schedule_seq).toBeNull()
  })

  it('плановое начисление не имеет даты оплаты, проведённое — имеет', () => {
    const [planned] = buildChargeRows([item()], links, categoryIds, '2026-10-22')
    expect(planned.status).toBe('planned')
    expect(planned.paid_at).toBeNull()
    expect(planned.date).toBe('2026-10-22')

    const [done] = buildChargeRows(
      [item({ status: 'completed', paidAt: '2026-10-01T10:00:00.000Z' })],
      links,
      categoryIds,
      '2026-10-22',
    )
    expect(done.status).toBe('completed')
    expect(done.paid_at).toBe('2026-10-01T10:00:00.000Z')
  })

  it('объект, обслуживание и сделка переносятся из контекста', () => {
    const [row] = buildChargeRows([item()], { ...links, dealId: 'deal-1' }, categoryIds, '2026-10-22')
    expect(row.organization_id).toBe('org-1')
    expect(row.property_id).toBe('property-1')
    expect(row.engagement_id).toBe('engagement-1')
    expect(row.deal_id).toBe('deal-1')
    expect(row.contract_id).toBe('contract-1')
  })

  it('нет категории в организации — строка не падает, просто без категории', () => {
    const [row] = buildChargeRows([item()], links, {}, '2026-10-22')
    expect(row.category_id).toBeNull()
  })
})

describe('залог в расчёте с собственником', () => {
  const operations = (kinds: Array<'rent' | 'deposit'>): SettlementOperation[] =>
    kinds.map((kind) => ({
      type: 'income',
      status: 'completed',
      categoryCode: CHARGE_CATEGORY_CODE[kind],
      amount: 30_000,
      date: '2026-10-05',
      borneBy: null,
    }))

  it('залог не входит в поступления от арендатора и не даёт комиссию', () => {
    const result = calcSettlement(
      { scheme: 'percent', rate: 10, ownerFixedAmount: null, ownerPayoutDay: null, startedAt: '2026-01-01' },
      operations(['rent', 'deposit']),
      '2026-10-22',
    )

    expect(result.tenantPayments).toBe(30_000)
    expect(result.agencyFee).toBe(3_000)
    // Собственнику причитается аренда минус комиссия; залог в обязательство не входит.
    expect(result.ownerObligation).toBe(27_000)
  })

  it('залог не считается доходом агентства', () => {
    expect(isAgencyRevenue(CHARGE_CATEGORY_CODE.deposit, 'income')).toBe(false)
    expect(isAgencyRevenue(CHARGE_CATEGORY_CODE.rent, 'income')).toBe(false)
    expect(isAgencyRevenue('agency_fee', 'income')).toBe(true)
  })
})
