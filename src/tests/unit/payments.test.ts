import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSupabaseMock } from '../helpers/supabase-mock'

// ─── Мок Supabase клиента ─────────────────────────────────────────────────────
const mockCreateClient = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

describe('createPaymentAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('создаёт платёж с валидными данными и перенаправляет на /payments', async () => {
    const { supabase } = createSupabaseMock({
      data: { id: 'pay-1', amount: 50000, payment_status: 'pending' },
      error: null,
    })
    mockCreateClient.mockResolvedValue(supabase)

    const { createPaymentAction } = await import('@/features/payments/actions/payments.actions')
    const formData = new FormData()
    formData.set('amount', '50000')
    formData.set('payment_type', 'rent')

    // При успехе createPaymentAction вызывает redirect('/payments'), который
    // в Next.js реализован через выброс специального исключения NEXT_REDIRECT —
    // это нормальное поведение Server Action, а не ошибка.
    await expect(createPaymentAction(formData)).rejects.toThrow('NEXT_REDIRECT:/payments')
    expect(supabase.from).toHaveBeenCalledWith('payments')
  })

  it('отклоняет нулевую сумму', async () => {
    const { supabase } = createSupabaseMock({ data: null, error: null })
    mockCreateClient.mockResolvedValue(supabase)

    const { createPaymentAction } = await import('@/features/payments/actions/payments.actions')
    const formData = new FormData()
    formData.set('amount', '0')
    formData.set('payment_type', 'rent')

    const result = await createPaymentAction(formData)
    expect(result?.error).toBeDefined()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('отклоняет отрицательную сумму', async () => {
    const { supabase } = createSupabaseMock({ data: null, error: null })
    mockCreateClient.mockResolvedValue(supabase)

    const { createPaymentAction } = await import('@/features/payments/actions/payments.actions')
    const formData = new FormData()
    formData.set('amount', '-5000')
    formData.set('payment_type', 'rent')

    const result = await createPaymentAction(formData)
    expect(result?.error).toBeDefined()
  })

  it('возвращает error если не авторизован', async () => {
    const { supabase } = createSupabaseMock({ user: null })
    mockCreateClient.mockResolvedValue(supabase)

    const { createPaymentAction } = await import('@/features/payments/actions/payments.actions')
    const formData = new FormData()
    formData.set('amount', '50000')
    formData.set('payment_type', 'rent')

    const result = await createPaymentAction(formData)
    expect(result?.error).toBe('Не авторизован')
  })

  it('возвращает error от Supabase', async () => {
    const { supabase } = createSupabaseMock({
      data: null,
      error: { message: 'DB connection failed' },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const { createPaymentAction } = await import('@/features/payments/actions/payments.actions')
    const formData = new FormData()
    formData.set('amount', '50000')
    formData.set('payment_type', 'rent')

    const result = await createPaymentAction(formData)
    expect(result?.error).toBe('DB connection failed')
  })
})

describe('updatePaymentStatusAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('принимает валидный статус', async () => {
    const { supabase } = createSupabaseMock({ data: {}, error: null })
    mockCreateClient.mockResolvedValue(supabase)

    const { updatePaymentStatusAction } = await import('@/features/payments/actions/payments.actions')
    const result = await updatePaymentStatusAction('pay-1', 'paid')
    expect(result).toEqual({ success: true })
  })

  it('отклоняет невалидный статус', async () => {
    const { supabase } = createSupabaseMock({ data: {}, error: null })
    mockCreateClient.mockResolvedValue(supabase)

    const { updatePaymentStatusAction } = await import('@/features/payments/actions/payments.actions')
    const result = await updatePaymentStatusAction('pay-1', 'unknown_status')
    expect(result?.error).toContain('Недопустимый статус')
  })

  it('принимает все валидные статусы', async () => {
    for (const status of ['pending', 'paid', 'partial', 'overdue', 'cancelled']) {
      const { supabase } = createSupabaseMock({ data: {}, error: null })
      mockCreateClient.mockResolvedValue(supabase)
      vi.resetModules()

      const { updatePaymentStatusAction } = await import('@/features/payments/actions/payments.actions')
      const result = await updatePaymentStatusAction('pay-1', status)
      expect(result?.error).toBeUndefined()
    }
  })
})

describe('getPaymentStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('возвращает нули если не авторизован', async () => {
    const { supabase } = createSupabaseMock({ user: null })
    mockCreateClient.mockResolvedValue(supabase)

    const { getPaymentStats } = await import('@/features/payments/actions/payments.actions')
    const result = await getPaymentStats()

    expect(result.totalPaid).toBe(0)
    expect(result.pending).toBe(0)
    expect(result.overdue).toBe(0)
    expect(result.overdueCount).toBe(0)
  })
})
