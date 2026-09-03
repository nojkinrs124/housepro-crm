import { describe, it, expect, vi } from 'vitest'
import { advanceDealStage } from '@/lib/deal-automation'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

/**
 * advanceDealStage() не ходит через createClient() — принимает клиента параметром,
 * поэтому мок собираем прицельно под два вызова, которые он делает:
 * select('status, deal_type') и update({ status }).
 *
 * Направление обязательно: автоматизация переводит работу по вехе («подписан
 * договор»), а какой стадии эта веха соответствует, зависит от направления —
 * в аренде это `agency_contract`, в управлении `mgmt_contract`.
 */
function makeDealClient(currentStatus: string | null, direction = 'rent_agent') {
  const updateEq = vi.fn().mockResolvedValue({ data: null, error: null })
  const update = vi.fn(() => ({ eq: updateEq }))

  const selectSingle = vi.fn().mockResolvedValue({
    data: currentStatus ? { status: currentStatus, deal_type: direction } : null,
    error: null,
  })
  const selectEq = vi.fn(() => ({ single: selectSingle }))
  const select = vi.fn(() => ({ eq: selectEq }))

  const from = vi.fn(() => ({ select, update }))
  return { from, update, updateEq }
}

type Client = SupabaseClient<Database>

describe('advanceDealStage', () => {
  it('двигает работу вперёд по воронке своего направления', async () => {
    const client = makeDealClient('agency_contract', 'rent_agent')
    await advanceDealStage(client as unknown as Client, 'deal-1', 'payment')

    // Веха «оплата» в аренде — это стадия заселения.
    expect(client.update).toHaveBeenCalledWith({ status: 'move_in' })
    expect(client.updateEq).toHaveBeenCalledWith('id', 'deal-1')
  })

  it('в управлении та же веха ведёт на свою стадию', async () => {
    const client = makeDealClient('sourcing', 'management')
    await advanceDealStage(client as unknown as Client, 'deal-1', 'contract')

    expect(client.update).toHaveBeenCalledWith({ status: 'mgmt_contract' })
  })

  it('в подборе для арендатора договор идёт раньше поиска', async () => {
    const client = makeDealClient('inquiry', 'tenant_search')
    await advanceDealStage(client as unknown as Client, 'deal-1', 'contract')

    expect(client.update).toHaveBeenCalledWith({ status: 'search_contract' })
  })

  it('не двигает работу назад', async () => {
    const client = makeDealClient('move_in', 'rent_agent')
    await advanceDealStage(client as unknown as Client, 'deal-1', 'contract')

    expect(client.update).not.toHaveBeenCalled()
  })

  it('не трогает завершённую работу', async () => {
    const client = makeDealClient('completed', 'rent_agent')
    await advanceDealStage(client as unknown as Client, 'deal-1', 'payment')

    expect(client.update).not.toHaveBeenCalled()
  })

  it('не трогает работу в обслуживании — это терминал управления', async () => {
    const client = makeDealClient('in_service', 'management')
    await advanceDealStage(client as unknown as Client, 'deal-1', 'payment')

    expect(client.update).not.toHaveBeenCalled()
  })

  it('не трогает отменённую работу', async () => {
    const client = makeDealClient('cancelled', 'rent_agent')
    await advanceDealStage(client as unknown as Client, 'deal-1', 'contract')

    expect(client.update).not.toHaveBeenCalled()
  })

  it('ничего не делает, если работа не найдена', async () => {
    const client = makeDealClient(null)
    await advanceDealStage(client as unknown as Client, 'missing-deal', 'payment')

    expect(client.update).not.toHaveBeenCalled()
  })

  it('ничего не делает при неизвестном направлении', async () => {
    const client = makeDealClient('sourcing', 'subrent')
    await advanceDealStage(client as unknown as Client, 'deal-1', 'contract')

    expect(client.update).not.toHaveBeenCalled()
  })
})
