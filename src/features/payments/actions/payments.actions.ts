'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createPaymentAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const contract_id  = formData.get('contract_id') as string | null
  const amountRaw    = formData.get('amount') as string
  const payment_type = formData.get('payment_type') as string
  const due_date     = formData.get('due_date') as string | null
  const notes        = (formData.get('notes') as string)?.trim() || null

  const amount = parseFloat(amountRaw)
  if (!amountRaw || isNaN(amount) || amount <= 0) {
    return { error: 'Укажите корректную сумму' }
  }

  const isOverdue = due_date ? new Date(due_date) < new Date() : false

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {
    amount,
    payment_type: payment_type || 'rent',
    payment_status: isOverdue ? 'overdue' : 'pending',
    created_by: user?.id,
  }
  if (contract_id) payload.contract_id = contract_id
  if (due_date)    payload.due_date = due_date
  if (notes)       payload.notes = notes

  const { error } = await supabase.from('payments').insert(payload)
  if (error) return { error: error.message }

  revalidatePath('/payments')
  if (contract_id) revalidatePath(`/contracts/${contract_id}`)

  return { success: true }
}

export async function markPaidAction(paymentId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('payments')
    .update({ payment_status: 'paid', payment_date: new Date().toISOString() } as never)  // eslint-disable-line
    .eq('id', paymentId)

  if (error) return { error: error.message }
  revalidatePath('/payments')
  return { success: true }
}

export async function updatePaymentStatusAction(paymentId: string, status: string) {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: any = { payment_status: status }
  if (status === 'paid') update.payment_date = new Date().toISOString()

  const { error } = await supabase.from('payments').update(update as never).eq('id', paymentId)
  if (error) return { error: error.message }
  revalidatePath('/payments')
  return { success: true }
}

export async function deletePaymentAction(paymentId: string) {
  const supabase = await createClient()

  const { data: payment } = await supabase
    .from('payments').select('contract_id').eq('id', paymentId).single()

  const { error } = await supabase.from('payments').delete().eq('id', paymentId)
  if (error) return { error: error.message }

  revalidatePath('/payments')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cid = (payment as any)?.contract_id
  if (cid) revalidatePath(`/contracts/${cid}`)
  return { success: true }
}

export async function getPaymentStats() {
  const supabase = await createClient()
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  const [all, monthPaid, overdue] = await Promise.all([
    supabase.from('payments').select('amount, payment_status'),
    supabase.from('payments').select('amount').eq('payment_status', 'paid').gte('payment_date', monthStart),
    supabase.from('payments').select('amount').eq('payment_status', 'overdue'),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sum = (rows: any[]) => rows.reduce((acc, r) => acc + Number(r.amount ?? 0), 0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allData = all.data ?? [] as any[]

  return {
    totalPaid:     sum(allData.filter((r: any) => r.payment_status === 'paid')),
    paidThisMonth: sum(monthPaid.data ?? []),
    pending:       sum(allData.filter((r: any) => r.payment_status === 'pending')),
    overdue:       sum(overdue.data ?? []),
    overdueCount:  (overdue.data ?? []).length,
  }
}
