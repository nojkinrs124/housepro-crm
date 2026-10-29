import { describe, it, expect } from 'vitest'
import { primaryStageAction, type StageActionContext } from '@/features/deals/config/stage-actions'
import { DIRECTIONS, isTerminal } from '@/features/directions/config/directions'

const base: StageActionContext = { dealId: 'd1', direction: 'rent_agent', stage: 'sourcing', propertyId: 'p1', clientContactId: 'c1', contracts: [], collections: [] }
const at = (direction: string, stage: string, extra: Partial<StageActionContext> = {}) =>
  primaryStageAction({ ...base, direction, stage, ...extra })

describe('главная кнопка стадии сделки (решение владельца 29.10.2026)', () => {
  it('у каждой незавершённой стадии всех направлений есть ровно одно действие', () => {
    for (const d of DIRECTIONS) {
      for (const s of d.stages) {
        const a = at(d.value, s.value)
        if (s.value === 'cancelled' || isTerminal(d.value, s.value)) continue
        expect(a, `${d.value}:${s.value}`).not.toBeNull()
        expect(a!.label.length).toBeGreaterThan(3)
      }
    }
  })
  it('завершённая и отменённая — без кнопки', () => {
    expect(at('rent_agent', 'completed')).toBeNull()
    expect(at('management', 'in_service')).toBeNull()
    expect(at('rent_agent', 'cancelled')).toBeNull()
  })
  it('аренда: путь из примера владельца', () => {
    expect(at('rent_agent', 'sourcing')!.label).toBe('Назначить встречу')
    expect(at('rent_agent', 'agency_contract')!.label).toBe('Создать агентский договор')
    expect(at('rent_agent', 'agency_contract')!.href).toContain('type=agency_owner')
    expect(at('rent_agent', 'preparation')!.href).toBe('/properties/p1/edit')
    expect(at('rent_agent', 'showings')!.code).toBe('showing')
    expect(at('rent_agent', 'tenant_check')!.label).toBe('Оформить договор найма')
    expect(at('rent_agent', 'move_in')!.label).toBe('Начислить комиссию')
  })
  it('договор: нет → создать, черновик → открыть, подписан → чек-лист', () => {
    expect(at('rent_agent', 'agency_contract', { contracts: [{ id: 'k1', contract_type: 'agency_owner', status: 'draft' }] })!.href).toBe('/contracts/k1')
    expect(at('rent_agent', 'agency_contract', { contracts: [{ id: 'k1', contract_type: 'agency_owner', status: 'signed' }] })!.code).toBe('checklist')
  })
  it('подбор: подборка есть — открыть, нет — собрать', () => {
    expect(at('tenant_search', 'searching')!.code).toBe('collection_create')
    expect(at('tenant_search', 'searching', { collections: [{ id: 'col', sent_at: null }] })!.href).toBe('/collections/col')
  })
  it('подготовка без объекта ведёт указать объект', () => {
    expect(at('sale', 'preparation', { propertyId: null })!.code).toBe('property_pick')
  })
})
