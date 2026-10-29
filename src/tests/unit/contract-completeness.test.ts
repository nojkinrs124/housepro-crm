import { describe, it, expect } from 'vitest'
import { checkContractCompleteness, defaultContractDates } from '@/features/contracts/config/completeness'

const OWNER = '11111111-1111-1111-1111-111111111111'
const CLIENT = '22222222-2222-2222-2222-222222222222'
const PROP = '33333333-3333-3333-3333-333333333333'
const full = {
  contract_type: 'rent_apartment', owner_contact_id: OWNER, client_contact_id: CLIENT, property_id: PROP,
  amount: 35000, deposit: 35000, start_date: '2026-11-01', end_date: '2027-09-30',
}

describe('checkContractCompleteness (QA 28.10.2026: B-01, B-04, A-11, A-12)', () => {
  it('полный договор найма проходит', () => {
    expect(checkContractCompleteness(full)).toBeNull()
  })
  it('пустой договор не проходит — первая ошибка про сторону', () => {
    expect(checkContractCompleteness({ contract_type: 'rent_apartment' })?.field).toBe('owner_contact_id')
  })
  it('залог 0 допустим, отрицательный — нет', () => {
    expect(checkContractCompleteness({ ...full, deposit: 0 })).toBeNull()
    expect(checkContractCompleteness({ ...full, deposit: null })).toBeNull()
    expect(checkContractCompleteness({ ...full, deposit: -5 })?.field).toBe('deposit')
  })
  it('без дат договор найма не создаётся', () => {
    expect(checkContractCompleteness({ ...full, start_date: null })?.field).toBe('start_date')
    expect(checkContractCompleteness({ ...full, end_date: null })?.field).toBe('end_date')
  })
  it('дата окончания раньше начала — ошибка', () => {
    const r = checkContractCompleteness({ ...full, start_date: '2027-06-10', end_date: '2027-01-10' })
    expect(r?.field).toBe('end_date')
  })
  it('купле-продаже дата окончания не нужна', () => {
    expect(checkContractCompleteness({ ...full, contract_type: 'sale', end_date: null })).toBeNull()
  })
  it('агентскому с собственником не нужны клиент и объект', () => {
    expect(checkContractCompleteness({
      contract_type: 'agency_owner', owner_contact_id: OWNER, amount: 8750,
      start_date: '2026-11-01', end_date: '2027-09-30',
    })).toBeNull()
  })
  it('агентскому с собственником нужен собственник', () => {
    const r = checkContractCompleteness({ contract_type: 'agency_owner', amount: 8750, start_date: '2026-11-01', end_date: '2027-09-30' })
    expect(r?.field).toBe('owner_contact_id')
    expect(r?.message).toMatch(/собственник/i)
  })
  it('сумма обязательна и больше нуля, кроме управления', () => {
    expect(checkContractCompleteness({ ...full, amount: null })?.field).toBe('amount')
    expect(checkContractCompleteness({ ...full, amount: 0 })?.field).toBe('amount')
    expect(checkContractCompleteness({
      contract_type: 'property_management', owner_contact_id: OWNER, property_id: PROP,
      amount: null, start_date: '2026-11-01', end_date: '2027-10-31',
    })).toBeNull()
  })
})

describe('defaultContractDates', () => {
  it('наём — 11 месяцев без дня', () => {
    expect(defaultContractDates('rent_apartment', '2026-10-29')).toEqual({ start_date: '2026-10-29', end_date: '2027-09-28' })
  })
  it('управление — год без дня', () => {
    expect(defaultContractDates('property_management', '2026-10-29').end_date).toBe('2027-10-28')
  })
  it('продажа — без даты окончания', () => {
    expect(defaultContractDates('sale', '2026-10-29').end_date).toBeNull()
  })
})
