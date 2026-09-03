import { describe, it, expect } from 'vitest'
import { validateSchemeFields, shouldRefetchRate, schemeFields } from '@/features/plans/services/plan-terms'

describe('shouldRefetchRate — ставка фиксируется на момент подписания', () => {
  it('новый договор берёт ставку из справочника', () => {
    expect(shouldRefetchRate('plan-1', null)).toBe(true)
  })

  it('правка договора с тем же тарифом ставку НЕ перечитывает', () => {
    // Иначе подорожание тарифа задним числом переписало бы расчёты по
    // действующим договорам — это прямое нарушение FR-007.
    expect(shouldRefetchRate('plan-1', { plan_id: 'plan-1', plan_rate: 10 })).toBe(false)
  })

  it('смена тарифа в договоре ставку перечитывает', () => {
    expect(shouldRefetchRate('plan-2', { plan_id: 'plan-1', plan_rate: 10 })).toBe(true)
  })

  it('без тарифа перечитывать нечего', () => {
    expect(shouldRefetchRate(null, { plan_id: 'plan-1', plan_rate: 10 })).toBe(false)
    expect(shouldRefetchRate(undefined, null)).toBe(false)
  })
})

describe('validateSchemeFields — согласованность схемы расчёта', () => {
  it('договор управления обязан нести схему', () => {
    const err = validateSchemeFields({ contract_type: 'property_management' })
    expect(err).toContain('Выберите схему расчёта')
  })

  it('схема у постороннего типа договора отклоняется', () => {
    const err = validateSchemeFields({ contract_type: 'rent_apartment', settlement_scheme: 'percent' })
    expect(err).toContain('только в договоре управления')
  })

  it('субаренда — тоже управление, схема ей положена', () => {
    expect(validateSchemeFields({
      contract_type: 'sublease', settlement_scheme: 'fixed',
      owner_fixed_amount: 40000, owner_payout_day: 5,
    })).toBeNull()
  })

  it('фиксированная выплата без суммы — договор, по которому нечего считать', () => {
    const err = validateSchemeFields({ contract_type: 'property_management', settlement_scheme: 'fixed', owner_payout_day: 5 })
    expect(err).toContain('ежемесячную выплату')
  })

  it('фиксированная выплата без дня — обязательство не наступает', () => {
    const err = validateSchemeFields({ contract_type: 'property_management', settlement_scheme: 'fixed', owner_fixed_amount: 40000 })
    expect(err).toContain('день выплаты')
  })

  it('процентная схема полна сама по себе', () => {
    expect(validateSchemeFields({ contract_type: 'property_management', settlement_scheme: 'percent' })).toBeNull()
  })
})

describe('schemeFields — что попадает в договор', () => {
  it('процентная схема не тащит за собой сумму и день выплаты', () => {
    const f = schemeFields({
      contract_type: 'property_management', settlement_scheme: 'percent',
      owner_fixed_amount: 40000, owner_payout_day: 5,
    })
    expect(f).toEqual({ settlement_scheme: 'percent', owner_fixed_amount: null, owner_payout_day: null })
  })

  it('фиксированная схема сохраняет обе величины', () => {
    const f = schemeFields({
      contract_type: 'property_management', settlement_scheme: 'fixed',
      owner_fixed_amount: 40000, owner_payout_day: 5,
    })
    expect(f).toEqual({ settlement_scheme: 'fixed', owner_fixed_amount: 40000, owner_payout_day: 5 })
  })
})
