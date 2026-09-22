import { describe, it, expect } from 'vitest'
import { transactionDirection } from '@/features/accounting/utils/direction'

describe('transactionDirection', () => {
  it('операция по сделке — направление сделки', () => {
    expect(transactionDirection({ contractType: null, engagementId: null, dealType: 'sale' })).toBe('sale')
  })

  it('операция по обслуживанию — всегда управление, даже если есть договор', () => {
    expect(transactionDirection({ contractType: 'rent_apartment', engagementId: 'eng-1', dealType: null })).toBe('management')
  })

  it('операция по агентскому договору аренды — направление из конфига типа договора', () => {
    expect(transactionDirection({ contractType: 'agency_owner', engagementId: null, dealType: null })).toBe('rent_agent')
  })

  it('ничего не привязано — направление неизвестно', () => {
    expect(transactionDirection({ contractType: null, engagementId: null, dealType: null })).toBeNull()
  })

  it('прямой договор (группа direct, агентство не сторона) — направление неизвестно, а не ошибка', () => {
    expect(transactionDirection({ contractType: 'rent_apartment', engagementId: null, dealType: null })).toBeNull()
  })
})
