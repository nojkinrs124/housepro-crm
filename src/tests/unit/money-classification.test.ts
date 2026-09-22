import { describe, it, expect } from 'vitest'
import { isAgencyRevenue, isAgencyExpense, toPaymentStatus } from '@/features/accounting/utils/money-classification'

describe('isAgencyRevenue', () => {
  it('арендный платёж и депозит — транзит, не доход агентства', () => {
    expect(isAgencyRevenue('tenant_payment', 'income')).toBe(false)
    expect(isAgencyRevenue('deposit', 'income')).toBe(false)
  })

  it('комиссия и вознаграждение за управление — доход агентства', () => {
    expect(isAgencyRevenue('agency_fee', 'income')).toBe(true)
    expect(isAgencyRevenue('management_fee', 'income')).toBe(true)
  })

  it('пользовательская категория без кода по умолчанию — доход', () => {
    expect(isAgencyRevenue(null, 'income')).toBe(true)
  })

  it('расход никогда не доход, даже с income-кодом по ошибке данных', () => {
    expect(isAgencyRevenue('agency_fee', 'expense')).toBe(false)
  })
})

describe('isAgencyExpense', () => {
  it('выплата собственнику — не расход агентства', () => {
    expect(isAgencyExpense('owner_payout', 'expense', 'agency')).toBe(false)
  })

  it('расход за счёт собственника — не расход агентства', () => {
    expect(isAgencyExpense('cleaning', 'expense', 'owner')).toBe(false)
  })

  it('расход за счёт агентства — расход агентства', () => {
    expect(isAgencyExpense('utilities', 'expense', 'agency')).toBe(true)
    expect(isAgencyExpense('utilities', 'expense', null)).toBe(true)
  })

  it('income не может быть расходом', () => {
    expect(isAgencyExpense('utilities', 'income', 'agency')).toBe(false)
  })
})

describe('toPaymentStatus', () => {
  const today = '2026-09-23'

  it('completed → paid', () => {
    expect(toPaymentStatus('completed', null, today)).toBe('paid')
  })

  it('planned без срока или со сроком в будущем → pending', () => {
    expect(toPaymentStatus('planned', null, today)).toBe('pending')
    expect(toPaymentStatus('planned', '2026-10-01', today)).toBe('pending')
  })

  it('planned со сроком в прошлом → overdue', () => {
    expect(toPaymentStatus('planned', '2026-09-01', today)).toBe('overdue')
  })

  it('cancelled → cancelled', () => {
    expect(toPaymentStatus('cancelled', null, today)).toBe('cancelled')
  })
})
