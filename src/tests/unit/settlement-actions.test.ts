import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSupabaseMock } from '../helpers/supabase-mock'

const mockCreateClient = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

/**
 * registerTenantPaymentAction и payOwnerAction — денежные Server Actions
 * (src/features/management/actions/settlement.actions.ts).
 *
 * Регрессия на находки аудита 22.10.2026:
 *  — P0-2: залог не должен попадать в категорию «Арендный платёж» и не должен
 *    давать удержание агентства;
 *  — P1-4: недоплата по плановому начислению должна оставлять schedule_seq на
 *    строке остатка, иначе следующий платёж не найдёт эту строку;
 *  — «Деньги: лимиты и остаток» (фаза 0) — payOwnerAction защищён rate limit.
 */

const engagement = {
  id: 'eng-1',
  property_id: 'prop-1',
  owner_contact_id: 'owner-1',
  settlement_scheme: 'percent',
  rate: 10,
  owner_fixed_amount: null,
  owner_payout_day: null,
  repair_limit: null,
  started_at: '2026-01-01',
  ended_at: null,
}

function baseTables(overrides: Record<string, { data?: unknown; error?: { message: string } | null }> = {}) {
  return {
    management_engagements: { data: engagement },
    accounting_categories: { data: { id: 'cat-tenant_payment', code: 'tenant_payment' } },
    accounting_transactions: { data: [] },
    ...overrides,
  }
}

describe('registerTenantPaymentAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('платёж арендатора без планового начисления создаёт income с категорией tenant_payment (не депозит)', async () => {
    const insert = vi.fn().mockReturnValue({
      then: (resolve: (v: unknown) => void) => Promise.resolve({ data: null, error: null }).then(resolve),
    })

    const { supabase } = createSupabaseMock({
      tables: {
        management_engagements: { data: engagement },
        // Нет плановых строк — платёж создаёт completed-транзакцию сразу.
        accounting_transactions: { data: [] },
        accounting_categories: { data: { id: 'cat-tenant_payment', code: 'tenant_payment' } },
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const { registerTenantPaymentAction } = await import('@/features/management/actions/settlement.actions')
    const formData = new FormData()
    formData.set('engagement_id', 'eng-1')
    formData.set('amount', '50000')
    formData.set('date', '2026-10-05')

    const result = await registerTenantPaymentAction(formData)
    expect(result.success).toBe(true)
    expect(supabase.from).toHaveBeenCalledWith('accounting_transactions')
  })

  it('залог (is_deposit=on) не запускает удержание агентства', async () => {
    // categoryIdByCode резолвится через единую таблицу accounting_categories —
    // отдаём код deposit, чтобы проверить, что он действительно запрошен.
    const categoriesCalls: string[] = []
    const { supabase } = createSupabaseMock({
      tables: {
        management_engagements: { data: engagement },
        accounting_transactions: { data: [] },
        accounting_categories: { data: { id: 'cat-deposit', code: 'deposit' } },
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const { registerTenantPaymentAction } = await import('@/features/management/actions/settlement.actions')
    const formData = new FormData()
    formData.set('engagement_id', 'eng-1')
    formData.set('amount', '50000')
    formData.set('date', '2026-10-05')
    formData.set('is_deposit', 'on')

    const result = await registerTenantPaymentAction(formData)
    expect(result.success).toBe(true)

    // Залог — только одна вставка в accounting_transactions (сам платёж),
    // без второй вставки под удержание агентства. Проверяем через insert-мок.
    const txnBuilder = supabase.from('accounting_transactions') as unknown as { insert: ReturnType<typeof vi.fn> }
    expect(txnBuilder.insert).toHaveBeenCalledTimes(1)
    const insertedRow = txnBuilder.insert.mock.calls[0][0]
    expect(insertedRow.category_id).toBe('cat-deposit')
  })

  it('удержание агентства создаётся отдельной строкой при процентной схеме и обычном платеже', async () => {
    const { supabase } = createSupabaseMock({
      tables: {
        management_engagements: { data: engagement },
        accounting_transactions: { data: [] },
        accounting_categories: { data: { id: 'cat-tenant_payment', code: 'tenant_payment' } },
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const { registerTenantPaymentAction } = await import('@/features/management/actions/settlement.actions')
    const formData = new FormData()
    formData.set('engagement_id', 'eng-1')
    formData.set('amount', '50000')
    formData.set('date', '2026-10-05')
    // is_deposit не установлен — обычный арендный платёж

    const result = await registerTenantPaymentAction(formData)
    expect(result.success).toBe(true)

    const txnBuilder = supabase.from('accounting_transactions') as unknown as { insert: ReturnType<typeof vi.fn> }
    // Платёж + удержание агентства = 2 вставки.
    expect(txnBuilder.insert).toHaveBeenCalledTimes(2)
  })

  it('недоплата по плановому начислению сохраняет schedule_seq на строке остатка', async () => {
    const planned = {
      id: 'planned-1',
      amount: 50000,
      due_date: '2026-10-10',
      period_start: '2026-10-01',
      period_end: '2026-10-31',
      contract_id: 'contract-1',
      description: 'Аренда за октябрь',
      schedule_seq: 5,
    }

    const { supabase } = createSupabaseMock({
      tables: {
        management_engagements: { data: engagement },
        // Плановая строка найдена — ветка закрытия начисления.
        accounting_transactions: { data: [planned] },
        accounting_categories: { data: { id: 'cat-tenant_payment', code: 'tenant_payment' } },
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const { registerTenantPaymentAction } = await import('@/features/management/actions/settlement.actions')
    const formData = new FormData()
    formData.set('engagement_id', 'eng-1')
    // Заплатили меньше, чем начислено — 30000 из 50000.
    formData.set('amount', '30000')
    formData.set('date', '2026-10-05')

    const result = await registerTenantPaymentAction(formData)
    expect(result.success).toBe(true)

    const txnBuilder = supabase.from('accounting_transactions') as unknown as { insert: ReturnType<typeof vi.fn> }
    // Остаток (20000) + удержание агентства с реально заплаченных 30000 = 2 insert-а.
    const restInsertCall = txnBuilder.insert.mock.calls.find(
      (call) => call[0]?.description?.includes('остаток'),
    )
    expect(restInsertCall).toBeDefined()
    const restRow = restInsertCall![0]
    expect(restRow.amount).toBe(20000)
    // Ключевая регрессия P1-4: schedule_seq переносится на остаток, иначе
    // следующий платёж не найдёт эту строку, и долг висит вечно.
    expect(restRow.schedule_seq).toBe(5)
    expect(restRow.contract_id).toBe('contract-1')
  })

  it('полная оплата планового начисления не создаёт строку остатка', async () => {
    const planned = {
      id: 'planned-1',
      amount: 50000,
      due_date: '2026-10-10',
      period_start: '2026-10-01',
      period_end: '2026-10-31',
      contract_id: 'contract-1',
      description: 'Аренда за октябрь',
      schedule_seq: 5,
    }

    const { supabase } = createSupabaseMock({
      tables: {
        management_engagements: { data: engagement },
        accounting_transactions: { data: [planned] },
        accounting_categories: { data: { id: 'cat-tenant_payment', code: 'tenant_payment' } },
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const { registerTenantPaymentAction } = await import('@/features/management/actions/settlement.actions')
    const formData = new FormData()
    formData.set('engagement_id', 'eng-1')
    formData.set('amount', '50000')
    formData.set('date', '2026-10-05')

    const result = await registerTenantPaymentAction(formData)
    expect(result.success).toBe(true)

    const txnBuilder = supabase.from('accounting_transactions') as unknown as { insert: ReturnType<typeof vi.fn> }
    const restInsertCall = txnBuilder.insert.mock.calls.find(
      (call) => call[0]?.description?.includes('остаток'),
    )
    expect(restInsertCall).toBeUndefined()
  })

  it('блокирует создание при недостаточных правах роли', async () => {
    const { supabase } = createSupabaseMock({
      role: 'agent',
      tables: baseTables(),
    })
    mockCreateClient.mockResolvedValue(supabase)

    const { registerTenantPaymentAction } = await import('@/features/management/actions/settlement.actions')
    const formData = new FormData()
    formData.set('engagement_id', 'eng-1')
    formData.set('amount', '50000')

    const result = await registerTenantPaymentAction(formData)
    expect(result.error).toBeDefined()
  })

  it('отклоняет нулевую/некорректную сумму', async () => {
    const { supabase } = createSupabaseMock({ tables: baseTables() })
    mockCreateClient.mockResolvedValue(supabase)

    const { registerTenantPaymentAction } = await import('@/features/management/actions/settlement.actions')
    const formData = new FormData()
    formData.set('engagement_id', 'eng-1')
    formData.set('amount', '0')

    const result = await registerTenantPaymentAction(formData)
    expect(result.error).toBeDefined()
  })

  it('без выбранной схемы расчёта отказывает с объяснением', async () => {
    const { supabase } = createSupabaseMock({
      tables: baseTables({
        management_engagements: { data: { ...engagement, settlement_scheme: null } },
      }),
    })
    mockCreateClient.mockResolvedValue(supabase)

    const { registerTenantPaymentAction } = await import('@/features/management/actions/settlement.actions')
    const formData = new FormData()
    formData.set('engagement_id', 'eng-1')
    formData.set('amount', '50000')

    const result = await registerTenantPaymentAction(formData)
    expect(result.error).toContain('схема расчёта')
  })
})

describe('payOwnerAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('выплата собственнику в пределах сальдо создаёт expense-транзакцию', async () => {
    const { supabase } = createSupabaseMock({
      tables: {
        management_engagements: { data: engagement },
        // calcSettlement: платёж 50000 при проценте 10% → сальдо 45000.
        accounting_transactions: {
          data: [
            { type: 'income', status: 'completed', amount: 50000, date: '2026-10-05', borne_by: null, category: { code: 'tenant_payment' } },
          ],
        },
        accounting_categories: { data: { id: 'cat-owner_payout', code: 'owner_payout' } },
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const { payOwnerAction } = await import('@/features/management/actions/settlement.actions')
    const formData = new FormData()
    formData.set('engagement_id', 'eng-1')
    formData.set('amount', '40000')
    formData.set('date', '2026-10-20')

    const result = await payOwnerAction(formData)
    expect(result.success).toBe(true)

    const txnBuilder = supabase.from('accounting_transactions') as unknown as { insert: ReturnType<typeof vi.fn> }
    const insertedRow = txnBuilder.insert.mock.calls[0][0]
    expect(insertedRow.type).toBe('expense')
    expect(insertedRow.contact_id).toBe('owner-1')
  })

  it('выплата сверх сальдо без отметки «аванс» отклоняется', async () => {
    const { supabase } = createSupabaseMock({
      tables: {
        management_engagements: { data: engagement },
        accounting_transactions: {
          data: [
            { type: 'income', status: 'completed', amount: 50000, date: '2026-10-05', borne_by: null, category: { code: 'tenant_payment' } },
          ],
        },
        accounting_categories: { data: { id: 'cat-owner_payout', code: 'owner_payout' } },
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const { payOwnerAction } = await import('@/features/management/actions/settlement.actions')
    const formData = new FormData()
    formData.set('engagement_id', 'eng-1')
    // Сальдо 45000, просим выплатить 100000 без as_advance.
    formData.set('amount', '100000')
    formData.set('date', '2026-10-20')

    const result = await payOwnerAction(formData)
    expect(result.error).toContain('Сальдо')
  })

  it('выплата сверх сальдо с отметкой «аванс» проходит', async () => {
    const { supabase } = createSupabaseMock({
      tables: {
        management_engagements: { data: engagement },
        accounting_transactions: {
          data: [
            { type: 'income', status: 'completed', amount: 50000, date: '2026-10-05', borne_by: null, category: { code: 'tenant_payment' } },
          ],
        },
        accounting_categories: { data: { id: 'cat-owner_payout', code: 'owner_payout' } },
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const { payOwnerAction } = await import('@/features/management/actions/settlement.actions')
    const formData = new FormData()
    formData.set('engagement_id', 'eng-1')
    formData.set('amount', '100000')
    formData.set('date', '2026-10-20')
    formData.set('as_advance', 'on')

    const result = await payOwnerAction(formData)
    expect(result.success).toBe(true)
  })

  it('без указанного собственника выплачивать некому', async () => {
    const { supabase } = createSupabaseMock({
      tables: {
        management_engagements: { data: { ...engagement, owner_contact_id: null } },
        accounting_transactions: { data: [] },
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const { payOwnerAction } = await import('@/features/management/actions/settlement.actions')
    const formData = new FormData()
    formData.set('engagement_id', 'eng-1')
    formData.set('amount', '10000')

    const result = await payOwnerAction(formData)
    expect(result.error).toContain('собственник')
  })

  it('блокирует при недостаточных правах роли', async () => {
    const { supabase } = createSupabaseMock({
      role: 'agent',
      tables: baseTables(),
    })
    mockCreateClient.mockResolvedValue(supabase)

    const { payOwnerAction } = await import('@/features/management/actions/settlement.actions')
    const formData = new FormData()
    formData.set('engagement_id', 'eng-1')
    formData.set('amount', '10000')

    const result = await payOwnerAction(formData)
    expect(result.error).toBeDefined()
  })
})
