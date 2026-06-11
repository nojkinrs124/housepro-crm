'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { PaymentStatus } from '@/types/database'
import { PaymentCreateSchema, PaymentUpdateSchema } from '@/lib/schemas'

const VALID_PAYMENT_STATUSES: PaymentStatus[] = ['pending', 'paid', 'partial', 'overdue', 'cancelled']

export async function createPaymentAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const parsed = PaymentCreateSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first.message, fields: parsed.error.flatten().fieldErrors }
  }

  const { contract_id, amount, payment_type, due_date, notes } = parsed.data
  const isOverdue = due_date ? new Date(due_date) < new Date() : false

  const payload = {
    amount,
    payment_type: payment_type || 'rent',
    payment_status: (isOverdue ? 'overdue' : 'pending') as PaymentStatus,
    created_by: user.id,
    ...(contract_id && { contract_id }),
    ...(due_date && { due_date }),
    ...(notes && { notes }),
  }

  const { error } = await supabase.from('payments').insert(payload)
  if (error) return { error: error.message }

  revalidatePath('/payments')
  if (contract_id) revalidatePath(`/contracts/${contract_id}`)
  revalidatePath('/analytics', 'page')

  return { success: true }
}

export async function updatePaymentAction(paymentId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const parsed = PaymentUpdateSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first.message, fields: parsed.error.flatten().fieldErrors }
  }

  const payload: Record<string, unknown> = { ...parsed.data }
  if (parsed.data.payment_status === 'paid') {
    payload.payment_date = new Date().toISOString()
  }

  const { error } = await supabase.from('payments').update(payload).eq('id', paymentId)
  if (error) return { error: error.message }

  revalidatePath('/payments')
  return { success: true }
}

export async function markPaidAction(paymentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { data: updated, error } = await supabase
    .from('payments')
    .update({
      payment_status: 'paid' as PaymentStatus,
      payment_date: new Date().toISOString(),
    })
    .eq('id', paymentId)
    .neq('payment_status', 'paid')
    .select('id')
    .single()

  if (error) return { error: error.message }
  if (!updated) return { error: 'Платёж уже отмечен как оплаченный' }

  revalidatePath('/payments')
  revalidatePath(`/payments/${paymentId}`)
  return { success: true }
}

export async function updatePaymentStatusAction(paymentId: string, status: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  if (!VALID_PAYMENT_STATUSES.includes(status as PaymentStatus)) {
    return { error: `Недопустимый статус платежа: ${status}` }
  }

  const update: { payment_status: PaymentStatus; payment_date?: string } = {
    payment_status: status as PaymentStatus,
  }
  if (status === 'paid') {
    update.payment_date = new Date().toISOString()
  }

  const { error } = await supabase.from('payments').update(update).eq('id', paymentId)
  if (error) return { error: error.message }

  revalidatePath('/payments')
  return { success: true }
}

export async function deletePaymentAction(paymentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { data: userRole } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!userRole || !['admin', 'manager'].includes(userRole.role)) {
    return { error: 'Недостаточно прав для удаления платежа' }
  }

  const { data: payment } = await supabase
    .from('payments')
    .select('contract_id')
    .eq('id', paymentId)
    .single()

  const { error } = await supabase.from('payments').delete().eq('id', paymentId)
  if (error) return { error: error.message }

  revalidatePath('/payments')
  if (payment?.contract_id) {
    revalidatePath(`/contracts/${payment.contract_id}`)
  }
  return { success: true }
}

export async function getPaymentStats() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { totalPaid: 0, paidThisMonth: 0, pending: 0, overdue: 0, overdueCount: 0 }
  }

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  const [allResult, monthPaidResult, overdueResult] = await Promise.all([
    supabase.from('payments').select('amount, payment_status'),
    supabase.from('payments').select('amount').eq('payment_status', 'paid').gte('payment_date', monthStart),
    supabase.from('payments').select('amount').eq('payment_status', 'overdue'),
  ])

  const sum = (rows: Array<{ amount: number }> | null) =>
    (rows ?? []).reduce((acc, r) => acc + Number(r.amount ?? 0), 0)

  const allData = allResult.data ?? []
  const monthPaidData = monthPaidResult.data ?? []
  const overdueData = overdueResult.data ?? []

  return {
    totalPaid: sum(allData.filter(r => r.payment_status === 'paid')),
    paidThisMonth: sum(monthPaidData),
    pending: sum(allData.filter(r => r.payment_status === 'pending')),
    overdue: sum(overdueData),
    overdueCount: overdueData.length,
  }
}
