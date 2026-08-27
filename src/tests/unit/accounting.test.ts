import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSupabaseMock } from '../helpers/supabase-mock'

const mockCreateClient = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

describe('createContractPaymentAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('создаёт income-транзакцию, привязанную к договору, без редиректа', async () => {
    const { supabase } = createSupabaseMock({ data: { id: 'txn-1' }, error: null })
    mockCreateClient.mockResolvedValue(supabase)

    const { createContractPaymentAction } = await import('@/features/accounting/actions/accounting.actions')
    const formData = new FormData()
    formData.set('amount', '50000')
    formData.set('due_date', '2026-09-01')

    const result = await createContractPaymentAction('contract-1', null, formData)
    expect(result).toEqual({ success: true })
    expect(supabase.from).toHaveBeenCalledWith('accounting_transactions')
  })

  it('отклоняет нулевую/некорректную сумму', async () => {
    const { supabase } = createSupabaseMock({ data: null, error: null })
    mockCreateClient.mockResolvedValue(supabase)

    const { createContractPaymentAction } = await import('@/features/accounting/actions/accounting.actions')
    const formData = new FormData()
    formData.set('amount', '0')

    const result = await createContractPaymentAction('contract-1', null, formData)
    expect(result.error).toBeDefined()
  })

  it('блокирует создание при недостаточных правах роли', async () => {
    const { supabase } = createSupabaseMock({ data: { id: 'txn-1' }, error: null, role: 'agent' })
    mockCreateClient.mockResolvedValue(supabase)

    const { createContractPaymentAction } = await import('@/features/accounting/actions/accounting.actions')
    const formData = new FormData()
    formData.set('amount', '50000')

    const result = await createContractPaymentAction('contract-1', null, formData)
    expect(result.error).toBeDefined()
  })
})

describe('completeTransactionAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('отмечает транзакцию оплаченной', async () => {
    const { supabase } = createSupabaseMock({ data: { id: 'txn-1', contract_id: 'contract-1' }, error: null })
    mockCreateClient.mockResolvedValue(supabase)

    const { completeTransactionAction } = await import('@/features/accounting/actions/accounting.actions')
    const result = await completeTransactionAction('txn-1')
    expect(result).toEqual({ success: true })
  })

  it('блокирует при недостаточных правах роли', async () => {
    const { supabase } = createSupabaseMock({ data: { id: 'txn-1' }, error: null, role: 'agent' })
    mockCreateClient.mockResolvedValue(supabase)

    const { completeTransactionAction } = await import('@/features/accounting/actions/accounting.actions')
    const result = await completeTransactionAction('txn-1')
    expect((result as { error?: string } | undefined)?.error).toBeDefined()
  })
})

describe('deleteTransactionAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('удаляет транзакцию под ролью admin', async () => {
    const { supabase } = createSupabaseMock({ data: { contract_id: null }, error: null })
    mockCreateClient.mockResolvedValue(supabase)

    const { deleteTransactionAction } = await import('@/features/accounting/actions/accounting.actions')
    const result = await deleteTransactionAction('txn-1')
    expect(result).toEqual({ success: true })
  })

  it('блокирует удаление для роли agent (delete доступен только admin)', async () => {
    const { supabase } = createSupabaseMock({ data: { contract_id: null }, error: null, role: 'agent' })
    mockCreateClient.mockResolvedValue(supabase)

    const { deleteTransactionAction } = await import('@/features/accounting/actions/accounting.actions')
    const result = await deleteTransactionAction('txn-1')
    expect((result as { error?: string } | undefined)?.error).toBeDefined()
  })
})
