import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type { DealFacts } from '@/features/directions/services/transitions'

/**
 * advanceDealStage() не ходит через createClient() — принимает клиента параметром.
 * Факты о сделке он берёт через collectDealFacts(), который здесь подменён:
 * тест задаёт стадию, направление и данные, а проверяет только один вызов —
 * update({ status }) на таблице deals.
 *
 * Направление обязательно: автоматизация переводит работу по вехе («подписан
 * договор»), а какой стадии эта веха соответствует, зависит от направления —
 * в аренде это `agency_contract`, в управлении `mgmt_contract`.
 */
const collectDealFacts = vi.fn<(...args: unknown[]) => Promise<DealFacts | null>>()

vi.mock('@/features/directions/services/transitions', async importOriginal => {
  const original = await importOriginal<typeof import('@/features/directions/services/transitions')>()
  return { ...original, collectDealFacts }
})

const { advanceDealStage } = await import('@/lib/deal-automation')

function facts(status: string, direction = 'rent_agent', extra: Partial<DealFacts> = {}): DealFacts {
  return {
    id: 'deal-1',
    deal_type: direction,
    status,
    property_id: null,
    plan_id: null,
    stage_progress: {},
    signedContractTypes: new Set(),
    hasSettlementScheme: false,
    photoCount: 0,
    isPublished: false,
    hasIncome: false,
    advanceAmount: null,
    expectedCloseDate: null,
    hasCollection: false,
    collectionSent: false,
    hasEngagement: false,
    ...extra,
  }
}

function makeClient() {
  const updateEq = vi.fn().mockResolvedValue({ data: null, error: null })
  const update = vi.fn(() => ({ eq: updateEq }))
  const from = vi.fn(() => ({ update }))
  return { from, update, updateEq }
}

type Client = SupabaseClient<Database>

describe('advanceDealStage', () => {
  beforeEach(() => collectDealFacts.mockReset())

  it('двигает работу вперёд по воронке своего направления, когда предусловия выполнены', async () => {
    // Чек-лист «Проверка и договор найма» закрыт, договор найма подписан.
    collectDealFacts.mockResolvedValue(facts('tenant_check', 'rent_agent', {
      stage_progress: { tenant_check: ['passport', 'solvency', 'owner_ok', 'contract'] },
      signedContractTypes: new Set(['rent_apartment']),
    }))
    const client = makeClient()
    await advanceDealStage(client as unknown as Client, 'deal-1', 'payment')

    // Веха «оплата» в аренде — это стадия заселения.
    expect(client.update).toHaveBeenCalledWith({ status: 'move_in' })
    expect(client.updateEq).toHaveBeenCalledWith('id', 'deal-1')
  })

  it('не двигает, если предусловие целевой стадии не выполнено по данным', async () => {
    // Договор найма только сформирован, не подписан — заселения нет.
    collectDealFacts.mockResolvedValue(facts('tenant_check', 'rent_agent', {
      stage_progress: { tenant_check: ['passport', 'solvency', 'owner_ok', 'contract'] },
    }))
    const client = makeClient()
    await advanceDealStage(client as unknown as Client, 'deal-1', 'payment')

    expect(client.update).not.toHaveBeenCalled()
  })

  it('не двигает, если чек-лист текущей стадии не закрыт', async () => {
    collectDealFacts.mockResolvedValue(facts('tenant_check', 'rent_agent', {
      signedContractTypes: new Set(['rent_apartment']),
    }))
    const client = makeClient()
    await advanceDealStage(client as unknown as Client, 'deal-1', 'payment')

    expect(client.update).not.toHaveBeenCalled()
  })

  it('в управлении та же веха ведёт на свою стадию', async () => {
    collectDealFacts.mockResolvedValue(facts('meeting', 'management', {
      stage_progress: { meeting: ['visited', 'services_told', 'plan_agreed', 'scheme_agreed'] },
      plan_id: 'plan-1',
      hasSettlementScheme: true,
    }))
    const client = makeClient()
    await advanceDealStage(client as unknown as Client, 'deal-1', 'contract')

    expect(client.update).toHaveBeenCalledWith({ status: 'mgmt_contract' })
  })

  it('в подборе для арендатора договор идёт раньше поиска', async () => {
    collectDealFacts.mockResolvedValue(facts('inquiry', 'tenant_search', {
      stage_progress: { inquiry: ['needs', 'budget', 'entity', 'commission'] },
    }))
    const client = makeClient()
    await advanceDealStage(client as unknown as Client, 'deal-1', 'contract')

    expect(client.update).toHaveBeenCalledWith({ status: 'search_contract' })
  })

  it('не двигает работу назад', async () => {
    collectDealFacts.mockResolvedValue(facts('move_in', 'rent_agent'))
    const client = makeClient()
    await advanceDealStage(client as unknown as Client, 'deal-1', 'contract')

    expect(client.update).not.toHaveBeenCalled()
  })

  it('не трогает завершённую работу', async () => {
    collectDealFacts.mockResolvedValue(facts('completed', 'rent_agent'))
    const client = makeClient()
    await advanceDealStage(client as unknown as Client, 'deal-1', 'payment')

    expect(client.update).not.toHaveBeenCalled()
  })

  it('не трогает работу в обслуживании — это терминал управления', async () => {
    collectDealFacts.mockResolvedValue(facts('in_service', 'management'))
    const client = makeClient()
    await advanceDealStage(client as unknown as Client, 'deal-1', 'payment')

    expect(client.update).not.toHaveBeenCalled()
  })

  it('не трогает отменённую работу', async () => {
    collectDealFacts.mockResolvedValue(facts('cancelled', 'rent_agent'))
    const client = makeClient()
    await advanceDealStage(client as unknown as Client, 'deal-1', 'contract')

    expect(client.update).not.toHaveBeenCalled()
  })

  it('ничего не делает, если работа не найдена', async () => {
    collectDealFacts.mockResolvedValue(null)
    const client = makeClient()
    await advanceDealStage(client as unknown as Client, 'missing-deal', 'payment')

    expect(client.update).not.toHaveBeenCalled()
  })

  it('ничего не делает при неизвестном направлении', async () => {
    collectDealFacts.mockResolvedValue(facts('sourcing', 'subrent'))
    const client = makeClient()
    await advanceDealStage(client as unknown as Client, 'deal-1', 'contract')

    expect(client.update).not.toHaveBeenCalled()
  })
})
