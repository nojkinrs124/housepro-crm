import { describe, it, expect } from 'vitest'
import { decidePropertyStatusFix } from '@/features/properties/lib/property-status-fix'

/**
 * Регрессия к аудиту 26.10.2026 (P0-2): кнопка «Исправить» на панели
 * «Чего не хватает» чинила только «Сдано без договора» и молча ничего не
 * делала для «Договор есть, а объект числится свободным».
 */
describe('decidePropertyStatusFix', () => {
  it('подписанный договор + «Доступно» → объект становится сданным', () => {
    const d = decidePropertyStatusFix({
      status: 'available',
      hasActiveRentContract: true,
      hasSignedRentContract: true,
    })
    expect(d).toEqual({ kind: 'update', nextStatus: 'rented' })
  })

  it('«Сдано» без действующего договора → возвращается в «Доступно»', () => {
    const d = decidePropertyStatusFix({
      status: 'rented',
      hasActiveRentContract: false,
      hasSignedRentContract: false,
    })
    expect(d).toEqual({ kind: 'update', nextStatus: 'available' })
  })

  it('черновик договора не делает объект сданным — только объясняет причину', () => {
    const d = decidePropertyStatusFix({
      status: 'available',
      hasActiveRentContract: true,
      hasSignedRentContract: false,
    })
    expect(d.kind).toBe('noop')
    if (d.kind === 'noop') expect(d.message).toMatch(/ещё не подписан/)
  })

  it('сданный объект с подписанным договором — менять нечего', () => {
    const d = decidePropertyStatusFix({
      status: 'rented',
      hasActiveRentContract: true,
      hasSignedRentContract: true,
    })
    expect(d.kind).toBe('noop')
  })

  it('проданный объект не трогаем, даже если договор аренды есть', () => {
    const d = decidePropertyStatusFix({
      status: 'sold',
      hasActiveRentContract: true,
      hasSignedRentContract: true,
    })
    expect(d.kind).toBe('noop')
  })

  it('неактивный и зарезервированный статусы не перезаписываются', () => {
    for (const status of ['inactive', 'reserved']) {
      const d = decidePropertyStatusFix({
        status,
        hasActiveRentContract: true,
        hasSignedRentContract: true,
      })
      expect(d.kind).toBe('noop')
    }
  })

  it('без договоров и без статуса «сдано» — менять нечего', () => {
    const d = decidePropertyStatusFix({
      status: 'available',
      hasActiveRentContract: false,
      hasSignedRentContract: false,
    })
    expect(d.kind).toBe('noop')
  })
})
