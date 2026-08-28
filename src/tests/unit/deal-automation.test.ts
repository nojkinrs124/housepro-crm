import { describe, it, expect, vi } from 'vitest'
import { advanceDealStage } from '@/lib/deal-automation'

/**
 * advanceDealStage() не ходит через createClient() — принимает клиента параметром,
 * поэтому мок собираем прицельно под два вызова, которые он делает: select('status')
 * и update({ status }).
 */
function makeDealClient(currentStatus: string | null) {
  const updateEq = vi.fn().mockResolvedValue({ data: null, error: null })
  const update = vi.fn(() => ({ eq: updateEq }))

  const selectSingle = vi.fn().mockResolvedValue({
    data: currentStatus ? { status: currentStatus } : null,
    error: null,
  })
  const selectEq = vi.fn(() => ({ single: selectSingle }))
  const select = vi.fn(() => ({ eq: selectEq }))

  const from = vi.fn(() => ({ select, update }))
  return { from, update, updateEq }
}

describe('advanceDealStage', () => {
  it('двигает сделку вперёд по воронке', async () => {
    const client = makeDealClient('contract')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await advanceDealStage(client as any, 'deal-1', 'payment')

    expect(client.update).toHaveBeenCalledWith({ status: 'payment' })
    expect(client.updateEq).toHaveBeenCalledWith('id', 'deal-1')
  })

  it('не двигает сделку назад', async () => {
    const client = makeDealClient('payment')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await advanceDealStage(client as any, 'deal-1', 'contract')

    expect(client.update).not.toHaveBeenCalled()
  })

  it('не трогает завершённую сделку', async () => {
    const client = makeDealClient('completed')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await advanceDealStage(client as any, 'deal-1', 'payment')

    expect(client.update).not.toHaveBeenCalled()
  })

  it('не трогает отменённую сделку', async () => {
    const client = makeDealClient('cancelled')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await advanceDealStage(client as any, 'deal-1', 'contract')

    expect(client.update).not.toHaveBeenCalled()
  })

  it('ничего не делает, если сделка не найдена', async () => {
    const client = makeDealClient(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await advanceDealStage(client as any, 'missing-deal', 'payment')

    expect(client.update).not.toHaveBeenCalled()
  })
})
