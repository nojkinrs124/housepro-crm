import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSupabaseMock } from '../helpers/supabase-mock'

const mockCreateClient = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

// advanceDealStage дёргает отдельный модуль с динамическим импортом —
// подменяем его, чтобы applyBankStatementAction не тянул за собой весь
// автоматный слой переходов по сделке.
const advanceDealStage = vi.fn()
vi.mock('@/lib/deal-automation', () => ({ advanceDealStage }))

/**
 * applyBankStatementAction — применение сверки банковской выписки
 * (src/features/accounting/actions/bank-import.actions.ts).
 *
 * Регрессия на P0-3 из аудита 22.10.2026: раньше item.amount игнорировался,
 * и начисление закрывалось плановой суммой — частичная оплата завышала доход.
 * Теперь используется фактическая сумма из выписки, а остаток уходит отдельной
 * плановой строкой.
 */

const planned = {
  id: 'planned-1',
  amount: 50000,
  deal_id: 'deal-1',
  contract_id: 'contract-1',
  property_id: 'prop-1',
  engagement_id: 'eng-1',
  category_id: 'cat-1',
  description: 'Аренда за октябрь',
  due_date: '2026-10-10',
  schedule_seq: 3,
  period_start: '2026-10-01',
  period_end: '2026-10-31',
}

function makeApplyMocks(overrides: { plannedData?: unknown; updatedData?: unknown } = {}) {
  const { supabase } = createSupabaseMock({
    tables: {
      // Первый select (планового начисления) и update используют одну таблицу —
      // мок supabase-mock отдаёт заданные data/single на любой вызов .from('accounting_transactions'),
      // поэтому настраиваем single отдельно для select, а update проверяем через insert/update-моки ниже.
      accounting_transactions: { data: overrides.plannedData ?? planned, single: overrides.plannedData ?? planned },
    },
  })
  return supabase
}

describe('applyBankStatementAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('использует фактическую сумму из выписки (item.amount), а не плановую сумму начисления', async () => {
    const supabase = makeApplyMocks()
    // maybeSingle для select планового начисления возвращает planned (status planned).
    // maybeSingle для update возвращает { id, deal_id } — настраиваем явно.
    const txnBuilder = supabase.from('accounting_transactions') as unknown as {
      maybeSingle: ReturnType<typeof vi.fn>
      update: ReturnType<typeof vi.fn>
      insert: ReturnType<typeof vi.fn>
    }
    let call = 0
    txnBuilder.maybeSingle.mockImplementation(() => {
      call += 1
      // 1-й вызов — select планового начисления, 2-й — update().select().maybeSingle().
      if (call === 1) return Promise.resolve({ data: planned, error: null })
      return Promise.resolve({ data: { id: 'planned-1', deal_id: 'deal-1' }, error: null })
    })

    mockCreateClient.mockResolvedValue(supabase)

    const { applyBankStatementAction } = await import('@/features/accounting/actions/bank-import.actions')

    // Начислено 50000, по выписке реально пришло 30000 (частичная оплата).
    const result = await applyBankStatementAction([
      { transactionId: 'planned-1', paidOn: '2026-10-12', amount: 30000, documentNumber: 'ПП-1' },
    ])

    expect(result.success).toBe(true)
    expect(result.applied).toBe(1)

    // update() должен быть вызван с amount = 30000 (факт из выписки), а не 50000 (план).
    const updateCall = txnBuilder.update.mock.calls[0][0]
    expect(updateCall.amount).toBe(30000)
    expect(updateCall.status).toBe('completed')
  })

  it('частичная оплата создаёт остаток отдельной плановой строкой, а не закрывает начисление целиком', async () => {
    const supabase = makeApplyMocks()
    const txnBuilder = supabase.from('accounting_transactions') as unknown as {
      maybeSingle: ReturnType<typeof vi.fn>
      update: ReturnType<typeof vi.fn>
      insert: ReturnType<typeof vi.fn>
    }
    let call = 0
    txnBuilder.maybeSingle.mockImplementation(() => {
      call += 1
      if (call === 1) return Promise.resolve({ data: planned, error: null })
      return Promise.resolve({ data: { id: 'planned-1', deal_id: 'deal-1' }, error: null })
    })
    mockCreateClient.mockResolvedValue(supabase)

    const { applyBankStatementAction } = await import('@/features/accounting/actions/bank-import.actions')

    await applyBankStatementAction([
      { transactionId: 'planned-1', paidOn: '2026-10-12', amount: 30000, documentNumber: 'ПП-1' },
    ])

    // Остаток 20000 должен уйти отдельной insert-строкой со статусом planned
    // и тем же schedule_seq (иначе следующий платёж не найдёт эту строку).
    const restCall = txnBuilder.insert.mock.calls.find((c) => c[0]?.description?.includes('остаток'))
    expect(restCall).toBeDefined()
    expect(restCall![0].amount).toBe(20000)
    expect(restCall![0].status).toBe('planned')
    expect(restCall![0].schedule_seq).toBe(3)
  })

  it('полная оплата по выписке не создаёт строку остатка', async () => {
    const supabase = makeApplyMocks()
    const txnBuilder = supabase.from('accounting_transactions') as unknown as {
      maybeSingle: ReturnType<typeof vi.fn>
      update: ReturnType<typeof vi.fn>
      insert: ReturnType<typeof vi.fn>
    }
    let call = 0
    txnBuilder.maybeSingle.mockImplementation(() => {
      call += 1
      if (call === 1) return Promise.resolve({ data: planned, error: null })
      return Promise.resolve({ data: { id: 'planned-1', deal_id: 'deal-1' }, error: null })
    })
    mockCreateClient.mockResolvedValue(supabase)

    const { applyBankStatementAction } = await import('@/features/accounting/actions/bank-import.actions')

    const result = await applyBankStatementAction([
      { transactionId: 'planned-1', paidOn: '2026-10-12', amount: 50000, documentNumber: 'ПП-1' },
    ])

    expect(result.success).toBe(true)
    const restCall = txnBuilder.insert.mock.calls.find((c) => c[0]?.description?.includes('остаток'))
    expect(restCall).toBeUndefined()
  })

  it('нулевая или отсутствующая сумма из выписки пропускает строку, не отмечает оплаченной', async () => {
    const supabase = makeApplyMocks()
    mockCreateClient.mockResolvedValue(supabase)

    const { applyBankStatementAction } = await import('@/features/accounting/actions/bank-import.actions')

    const result = await applyBankStatementAction([
      { transactionId: 'planned-1', paidOn: '2026-10-12', amount: 0, documentNumber: 'ПП-1' },
    ])

    expect(result.error).toBeDefined()
  })

  it('пустой список платежей отклоняется', async () => {
    const { supabase } = createSupabaseMock({})
    mockCreateClient.mockResolvedValue(supabase)

    const { applyBankStatementAction } = await import('@/features/accounting/actions/bank-import.actions')
    const result = await applyBankStatementAction([])
    expect(result.error).toBe('Не выбрано ни одного платежа')
  })

  it('не авторизован — ранний выход', async () => {
    const { supabase } = createSupabaseMock({ user: null })
    mockCreateClient.mockResolvedValue(supabase)

    const { applyBankStatementAction } = await import('@/features/accounting/actions/bank-import.actions')
    const result = await applyBankStatementAction([
      { transactionId: 'planned-1', paidOn: '2026-10-12', amount: 30000, documentNumber: null },
    ])
    expect(result.error).toBe('Не авторизован')
  })
})
