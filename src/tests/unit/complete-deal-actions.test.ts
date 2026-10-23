import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSupabaseMock } from '../helpers/supabase-mock'

const mockCreateClient = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

const advanceDealStage = vi.fn()
vi.mock('@/lib/deal-automation', () => ({ advanceDealStage }))

const dispatchWebhook = vi.fn()
vi.mock('@/lib/webhooks', () => ({ dispatchWebhook }))

const revalidateSiteForProperty = vi.fn()
vi.mock('@/features/site/lib/revalidate', () => ({ revalidateSiteForProperty }))

/**
 * completeDealAction — оформление сделки одним действием
 * (src/features/deals/actions/complete-deal.actions.ts).
 *
 * Регрессия на находки аудита 22.10.2026:
 *  — P1-6/0.2: повторный вызов на сделке с уже существующим договором того же
 *    типа не создаёт второй договор и не дублирует комиссию (защищена уникальным
 *    индексом contracts(deal_id, contract_type), миграция 20261022120000);
 *  — P0-1: залог в графике начислений уходит в категорию 'deposit', а не
 *    'tenant_payment' — через единый сервис charges.ts;
 *  — порядок: договор создаётся первым, остальные шаги (график, задача,
 *    статус объекта, комиссия) не фатальны при ошибке.
 */

const deal = {
  id: 'deal-1',
  deal_type: 'rent_agent',
  status: 'contract',
  amount: 50000,
  plan_id: 'plan-1',
  owner_contact_id: 'owner-1',
  client_contact_id: 'client-1',
  owner_representative_id: null,
  client_representative_id: null,
  property_id: 'prop-1',
  property: { id: 'prop-1', property_type: 'apartment', status: 'available' },
  client_contact: null,
}

function baseTables(overrides: Record<string, { data?: unknown; error?: { message: string } | null }> = {}) {
  return {
    deals: { data: deal },
    service_plans: { data: { rate: 50, charge_type: 'deal_percent', title: 'Базовый' } },
    // Нет существующего договора — основной путь: создаём договор.
    contracts: { data: null },
    accounting_categories: { data: { id: 'cat-agency_fee', code: 'agency_fee' } },
    accounting_transactions: { data: [] },
    management_engagements: { data: null },
    tasks: { data: null },
    properties: { data: null },
    ...overrides,
  }
}

function formWithBasics(extra: Record<string, string> = {}) {
  const formData = new FormData()
  formData.set('start_date', '2026-10-01')
  formData.set('amount', '50000')
  for (const [k, v] of Object.entries(extra)) formData.set(k, v)
  return formData
}

describe('completeDealAction — идемпотентность', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('повторный вызов на сделке, у которой уже есть договор этого типа, не создаёт второй договор', async () => {
    const { supabase } = createSupabaseMock({
      tables: baseTables({
        // На этот раз договор уже существует — ключевой сценарий P1-6.
        contracts: { data: { id: 'contract-existing', contract_number: 'АР-2026-001', status: 'signed' } },
      }),
    })
    mockCreateClient.mockResolvedValue(supabase)

    const { completeDealAction } = await import('@/features/deals/actions/complete-deal.actions')
    const result = await completeDealAction('deal-1', null, formWithBasics())

    expect(result.error).toContain('уже есть договор')

    // insert на contracts не должен вызываться вовсе.
    const contractsBuilder = supabase.from('contracts') as unknown as { insert: ReturnType<typeof vi.fn> }
    expect(contractsBuilder.insert).not.toHaveBeenCalled()
  })

  it('повторный вызов не дублирует комиссию (вторая попытка уже блокируется на шаге договора)', async () => {
    const { supabase } = createSupabaseMock({
      tables: baseTables({
        contracts: { data: { id: 'contract-existing', contract_number: 'АР-2026-001', status: 'signed' } },
      }),
    })
    mockCreateClient.mockResolvedValue(supabase)

    const { completeDealAction } = await import('@/features/deals/actions/complete-deal.actions')
    await completeDealAction('deal-1', null, formWithBasics({ with_commission: 'on' }))

    const txnBuilder = supabase.from('accounting_transactions') as unknown as { insert: ReturnType<typeof vi.fn> }
    // Экшен завершается ошибкой на шаге «договор уже есть» — комиссия вообще
    // не пытается вставиться, потому что до неё дело не доходит.
    expect(txnBuilder.insert).not.toHaveBeenCalled()
  })
})

describe('completeDealAction — первое оформление создаёт договор, затем остальное', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  /**
   * Существующий договор ищется через maybeSingle() ПЕРЕД созданием, а сам
   * созданный договор читается через single() сразу после insert() — два
   * разных мок-метода одного и того же builder'а, поэтому «нет договора,
   * потом есть» настраивается явным переопределением обоих.
   */
  function noExistingContractThenCreated(contractsBuilder: {
    maybeSingle: ReturnType<typeof vi.fn>
    single: ReturnType<typeof vi.fn>
  }) {
    contractsBuilder.maybeSingle.mockResolvedValue({ data: null, error: null })
    contractsBuilder.single.mockResolvedValue({
      data: { id: 'contract-1', contract_number: 'АР-2026-001' },
      error: null,
    })
  }

  it('создаёт договор первым шагом', async () => {
    const { supabase } = createSupabaseMock({ tables: baseTables() })
    mockCreateClient.mockResolvedValue(supabase)

    const contractsBuilder = supabase.from('contracts') as unknown as {
      insert: ReturnType<typeof vi.fn>
      maybeSingle: ReturnType<typeof vi.fn>
      single: ReturnType<typeof vi.fn>
    }
    noExistingContractThenCreated(contractsBuilder)

    const { completeDealAction } = await import('@/features/deals/actions/complete-deal.actions')

    await expect(completeDealAction('deal-1', null, formWithBasics())).rejects.toThrow('NEXT_REDIRECT')

    expect(contractsBuilder.insert).toHaveBeenCalledTimes(1)
    const insertedContract = contractsBuilder.insert.mock.calls[0][0]
    expect(insertedContract.deal_id).toBe('deal-1')
  })

  it('залог в графике начислений получает категорию deposit, а не tenant_payment', async () => {
    const { supabase } = createSupabaseMock({
      tables: baseTables({
        accounting_categories: {
          data: [
            { id: 'cat-deposit', code: 'deposit' },
            { id: 'cat-rent', code: 'tenant_payment' },
          ],
        },
      }),
    })
    mockCreateClient.mockResolvedValue(supabase)

    const contractsBuilder = supabase.from('contracts') as unknown as {
      insert: ReturnType<typeof vi.fn>
      maybeSingle: ReturnType<typeof vi.fn>
      single: ReturnType<typeof vi.fn>
    }
    noExistingContractThenCreated(contractsBuilder)

    const { completeDealAction } = await import('@/features/deals/actions/complete-deal.actions')

    const formData = formWithBasics({
      with_schedule: 'on',
      with_deposit: 'on',
      periodicity: 'monthly',
    })
    formData.set('deposit', '50000')
    formData.set('end_date', '2027-09-30')

    await expect(completeDealAction('deal-1', null, formData)).rejects.toThrow('NEXT_REDIRECT')

    const txnBuilder = supabase.from('accounting_transactions') as unknown as { insert: ReturnType<typeof vi.fn> }
    expect(txnBuilder.insert).toHaveBeenCalled()
    // insertCharges вставляет массив строк — первая строка, депозит, должна
    // получить категорию deposit, а не tenant_payment (регрессия P0-1).
    const insertedRows = txnBuilder.insert.mock.calls[0][0] as Array<{ category_id: string | null; description: string }>
    const depositRow = insertedRows.find((r) => r.description.toLowerCase().includes('депозит'))
    expect(depositRow).toBeDefined()
    expect(depositRow!.category_id).toBe('cat-deposit')
    expect(depositRow!.category_id).not.toBe('cat-rent')
  })

  it('без собственника в сделке, которой он нужен — ошибка, договор не создаётся', async () => {
    const { supabase } = createSupabaseMock({
      tables: baseTables({
        deals: { data: { ...deal, owner_contact_id: null } },
      }),
    })
    mockCreateClient.mockResolvedValue(supabase)

    const { completeDealAction } = await import('@/features/deals/actions/complete-deal.actions')
    const result = await completeDealAction('deal-1', null, formWithBasics())
    expect(result.error).toContain('собственник')

    const contractsBuilder = supabase.from('contracts') as unknown as { insert: ReturnType<typeof vi.fn> }
    expect(contractsBuilder.insert).not.toHaveBeenCalled()
  })

  it('без даты начала — ошибка', async () => {
    const { supabase } = createSupabaseMock({ tables: baseTables() })
    mockCreateClient.mockResolvedValue(supabase)

    const { completeDealAction } = await import('@/features/deals/actions/complete-deal.actions')
    const formData = new FormData()
    const result = await completeDealAction('deal-1', null, formData)
    expect(result.error).toContain('дату начала')
  })

  it('сделка не найдена — ошибка', async () => {
    const { supabase } = createSupabaseMock({ tables: baseTables({ deals: { data: null } }) })
    mockCreateClient.mockResolvedValue(supabase)

    const { completeDealAction } = await import('@/features/deals/actions/complete-deal.actions')
    const result = await completeDealAction('deal-1', null, formWithBasics())
    expect(result.error).toBe('Сделка не найдена')
  })

  it('блокирует при недостаточных правах роли', async () => {
    const { supabase } = createSupabaseMock({ role: 'agent', tables: baseTables() })
    mockCreateClient.mockResolvedValue(supabase)

    const { completeDealAction } = await import('@/features/deals/actions/complete-deal.actions')
    const result = await completeDealAction('deal-1', null, formWithBasics())
    expect(result.error).toBeDefined()
  })
})

describe('completeDealAction — вторая комиссия по сделке не создаётся', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('если комиссия по этой сделке уже начислена — вторую не вставляет', async () => {
    const { supabase } = createSupabaseMock({
      tables: baseTables({
        accounting_categories: { data: { id: 'cat-agency_fee', code: 'agency_fee' } },
        // existingFee ищется через select().eq().eq().limit().maybeSingle() —
        // отдаём непустой результат.
        accounting_transactions: { data: [{ id: 'existing-fee-1' }] },
      }),
    })
    mockCreateClient.mockResolvedValue(supabase)

    const contractsBuilder = supabase.from('contracts') as unknown as {
      insert: ReturnType<typeof vi.fn>
      maybeSingle: ReturnType<typeof vi.fn>
      single: ReturnType<typeof vi.fn>
    }
    contractsBuilder.maybeSingle.mockResolvedValue({ data: null, error: null })
    contractsBuilder.single.mockResolvedValue({
      data: { id: 'contract-1', contract_number: 'АР-2026-001' },
      error: null,
    })

    const { completeDealAction } = await import('@/features/deals/actions/complete-deal.actions')
    const formData = formWithBasics({ with_commission: 'on' })

    await expect(completeDealAction('deal-1', null, formData)).rejects.toThrow('NEXT_REDIRECT')

    const txnBuilder = supabase.from('accounting_transactions') as unknown as { insert: ReturnType<typeof vi.fn> }
    // Комиссия не должна быть вставлена во второй раз.
    const commissionInsert = txnBuilder.insert.mock.calls.find(
      (c) => !Array.isArray(c[0]) && c[0]?.description?.includes('Вознаграждение агентства'),
    )
    expect(commissionInsert).toBeUndefined()
  })
})
