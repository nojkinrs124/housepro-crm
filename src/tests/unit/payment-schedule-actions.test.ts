import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSupabaseMock } from '../helpers/supabase-mock'

const mockCreateClient = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

/**
 * generatePaymentScheduleAction — построение графика начислений по договору
 * (src/features/accounting/actions/payment-schedule.actions.ts).
 *
 * Регрессия на P0-1 из аудита 22.10.2026: депозит должен уходить в отдельную
 * категорию 'deposit', а не в 'tenant_payment' (иначе он попадает в базу
 * процента агентства при расчёте с собственником).
 */

const contract = {
  id: 'contract-1',
  contract_number: 'АР-2026-001',
  contract_type: 'rent_apartment',
  start_date: '2026-10-01',
  end_date: '2027-09-30',
  amount: 50000,
  deposit: 50000,
  deal_id: 'deal-1',
  property_id: 'prop-1',
  status: 'signed',
  indexation_percent: null,
  indexation_period_months: null,
}

function baseTables(overrides: Record<string, { data?: unknown; error?: { message: string } | null }> = {}) {
  return {
    contracts: { data: contract },
    // Нет уже полученного депозита, нет уже существующего графика.
    accounting_transactions: { data: [] },
    accounting_categories: {
      data: [
        { id: 'cat-deposit', code: 'deposit' },
        { id: 'cat-rent', code: 'tenant_payment' },
      ],
    },
    management_engagements: { data: null },
    ...overrides,
  }
}

function formWithBasics(extra: Record<string, string> = {}) {
  const formData = new FormData()
  formData.set('periodicity', 'monthly')
  formData.set('include_deposit', 'on')
  formData.set('deposit_amount', '50000')
  for (const [k, v] of Object.entries(extra)) formData.set(k, v)
  return formData
}

describe('generatePaymentScheduleAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('депозит получает категорию deposit, а не tenant_payment', async () => {
    const { supabase } = createSupabaseMock({ tables: baseTables() })
    mockCreateClient.mockResolvedValue(supabase)

    const { generatePaymentScheduleAction } = await import('@/features/accounting/actions/payment-schedule.actions')

    const result = await generatePaymentScheduleAction('contract-1', null, formWithBasics())
    expect(result.success).toBe(true)

    const txnBuilder = supabase.from('accounting_transactions') as unknown as { insert: ReturnType<typeof vi.fn> }
    expect(txnBuilder.insert).toHaveBeenCalled()
    const insertedRows = txnBuilder.insert.mock.calls[0][0] as Array<{ category_id: string | null; description: string }>
    const depositRow = insertedRows.find((r) => r.description.toLowerCase().includes('депозит'))
    expect(depositRow).toBeDefined()
    expect(depositRow!.category_id).toBe('cat-deposit')

    const rentRows = insertedRows.filter((r) => r !== depositRow)
    expect(rentRows.every((r) => r.category_id === 'cat-rent')).toBe(true)
  })

  it('если депозит уже получен по этому договору — второй раз в график не попадает', async () => {
    const { supabase } = createSupabaseMock({
      tables: baseTables({
        // receivedDeposit ищется через select().eq()...ilike(description, %депозит%).limit(1) —
        // отдаём непустой результат.
        accounting_transactions: { data: [{ id: 'paid-deposit-1' }] },
      }),
    })
    mockCreateClient.mockResolvedValue(supabase)

    const { generatePaymentScheduleAction } = await import('@/features/accounting/actions/payment-schedule.actions')
    // Та же таблица accounting_transactions отдаёт непустой массив и на
    // «депозит уже получен», и на «график уже существует» — чтобы дойти до
    // вставки, разрешаем пересоздание явно.
    const result = await generatePaymentScheduleAction('contract-1', null, formWithBasics({ replace: 'on' }))
    expect(result.success).toBe(true)

    const txnBuilder = supabase.from('accounting_transactions') as unknown as { insert: ReturnType<typeof vi.fn> }
    const insertedRows = txnBuilder.insert.mock.calls[0][0] as Array<{ description: string }>
    const depositRow = insertedRows.find((r) => r.description.toLowerCase().includes('депозит'))
    expect(depositRow).toBeUndefined()
  })

  it('не создаёт график дважды без отметки «пересоздать»', async () => {
    const { supabase } = createSupabaseMock({
      tables: baseTables({
        // existing graph с ненулевыми строками.
        accounting_transactions: { data: [{ id: 'existing-row-1', status: 'planned' }] },
      }),
    })
    mockCreateClient.mockResolvedValue(supabase)

    const { generatePaymentScheduleAction } = await import('@/features/accounting/actions/payment-schedule.actions')
    const result = await generatePaymentScheduleAction('contract-1', null, formWithBasics())
    expect(result.error).toContain('уже есть график')
  })

  it('пересоздание графика удаляет только плановые (status=planned), не оплаченные строки', async () => {
    const { supabase } = createSupabaseMock({
      tables: baseTables({
        accounting_transactions: {
          data: [
            { id: 'planned-row-1', status: 'planned' },
            { id: 'completed-row-1', status: 'completed' },
          ],
        },
      }),
    })
    mockCreateClient.mockResolvedValue(supabase)

    const { generatePaymentScheduleAction } = await import('@/features/accounting/actions/payment-schedule.actions')
    const result = await generatePaymentScheduleAction('contract-1', null, formWithBasics({ replace: 'on' }))
    expect(result.success).toBe(true)

    const txnBuilder = supabase.from('accounting_transactions') as unknown as { delete: ReturnType<typeof vi.fn>; in: ReturnType<typeof vi.fn> }
    expect(txnBuilder.delete).toHaveBeenCalled()
    // Удаление ограничено списком planned id-шников, не затрагивая completed.
    const inCall = txnBuilder.in.mock.calls.find((c) => Array.isArray(c[1]))
    expect(inCall?.[1]).toEqual(['planned-row-1'])
  })

  it('договор не найден — ошибка', async () => {
    const { supabase } = createSupabaseMock({ tables: baseTables({ contracts: { data: null, error: { message: 'not found' } } }) })
    mockCreateClient.mockResolvedValue(supabase)

    const { generatePaymentScheduleAction } = await import('@/features/accounting/actions/payment-schedule.actions')
    const result = await generatePaymentScheduleAction('contract-1', null, formWithBasics())
    expect(result.error).toBe('Договор не найден')
  })

  it('без суммы платежа — ошибка', async () => {
    const { supabase } = createSupabaseMock({
      tables: baseTables({ contracts: { data: { ...contract, amount: 0 } } }),
    })
    mockCreateClient.mockResolvedValue(supabase)

    const { generatePaymentScheduleAction } = await import('@/features/accounting/actions/payment-schedule.actions')
    const formData = formWithBasics()
    formData.set('amount', '0')
    const result = await generatePaymentScheduleAction('contract-1', null, formData)
    expect(result.error).toContain('сумму')
  })
})
