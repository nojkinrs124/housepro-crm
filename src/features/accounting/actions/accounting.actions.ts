'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type {
  AccountingTransactionStatus,
  AccountingTransactionType,
  AccountingPaymentMethod,
  AccountingStats,
} from '@/types/database'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseAmount(raw: unknown): number | null {
  const v = String(raw ?? '').replace(/\s/g, '').replace(',', '.')
  const n = parseFloat(v)
  return isNaN(n) || n <= 0 ? null : n
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getAccountingStats(): Promise<AccountingStats> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {
    totalIncome: 0, totalExpense: 0, profit: 0,
    incomeThisMonth: 0, expenseThisMonth: 0, profitThisMonth: 0,
    plannedIncome: 0, plannedExpense: 0,
  }

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)

  const { data } = await supabase
    .from('accounting_transactions')
    .select('type, amount, status, date')

  const rows = (data ?? []) as Array<{ type: string; amount: number; status: string; date: string }>

  const sum = (arr: typeof rows) => arr.reduce((a, r) => a + Number(r.amount ?? 0), 0)

  const completed = rows.filter(r => r.status === 'completed')
  const planned   = rows.filter(r => r.status === 'planned')
  const thisMonth = completed.filter(r => r.date >= monthStart && r.date <= monthEnd)

  const totalIncome   = sum(completed.filter(r => r.type === 'income'))
  const totalExpense  = sum(completed.filter(r => r.type === 'expense'))
  const incomeThisMonth  = sum(thisMonth.filter(r => r.type === 'income'))
  const expenseThisMonth = sum(thisMonth.filter(r => r.type === 'expense'))

  return {
    totalIncome,
    totalExpense,
    profit: totalIncome - totalExpense,
    incomeThisMonth,
    expenseThisMonth,
    profitThisMonth: incomeThisMonth - expenseThisMonth,
    plannedIncome:  sum(planned.filter(r => r.type === 'income')),
    plannedExpense: sum(planned.filter(r => r.type === 'expense')),
  }
}

// ─── Monthly P&L for chart ────────────────────────────────────────────────────

export async function getMonthlyPnL(months = 12) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const since = new Date()
  since.setMonth(since.getMonth() - months + 1)
  since.setDate(1)

  const { data } = await supabase
    .from('accounting_transactions')
    .select('type, amount, date')
    .eq('status', 'completed')
    .gte('date', since.toISOString().slice(0, 10))
    .order('date', { ascending: true })

  const rows = (data ?? []) as Array<{ type: string; amount: number; date: string }>

  const map = new Map<string, { month: string; income: number; expense: number; profit: number }>()

  for (const r of rows) {
    const key = r.date.slice(0, 7) // YYYY-MM
    if (!map.has(key)) {
      const [y, m] = key.split('-')
      const label = new Date(Number(y), Number(m) - 1, 1)
        .toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' })
      map.set(key, { month: label, income: 0, expense: 0, profit: 0 })
    }
    const entry = map.get(key)!
    if (r.type === 'income')  entry.income  += Number(r.amount)
    else                      entry.expense += Number(r.amount)
    entry.profit = entry.income - entry.expense
  }

  return Array.from(map.values())
}

// ─── Category breakdown ───────────────────────────────────────────────────────

export async function getCategoryBreakdown(type: AccountingTransactionType, period?: 'month' | 'year') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  let query = supabase
    .from('accounting_transactions')
    .select('amount, category:accounting_categories(id, name, color)')
    .eq('type', type)
    .eq('status', 'completed')

  if (period === 'month') {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
    query = query.gte('date', start)
  } else if (period === 'year') {
    const start = `${new Date().getFullYear()}-01-01`
    query = query.gte('date', start)
  }

  const { data } = await query
  const rows = (data ?? []) as unknown as Array<{ amount: number; category: { id: string; name: string; color: string } | null }>

  const map = new Map<string, { name: string; color: string; value: number }>()
  for (const r of rows) {
    const key  = r.category?.id ?? 'other'
    const name = r.category?.name ?? 'Без категории'
    const color= r.category?.color ?? '#94A3B8'
    const entry = map.get(key) ?? { name, color, value: 0 }
    entry.value += Number(r.amount)
    map.set(key, entry)
  }

  return Array.from(map.values()).sort((a, b) => b.value - a.value)
}

// ─── CRUD transactions ────────────────────────────────────────────────────────

export async function createTransactionAction(_prevState: unknown, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const type       = formData.get('type') as AccountingTransactionType
  const rawAmount  = formData.get('amount')
  const amount     = parseAmount(rawAmount)
  const date       = formData.get('date') as string
  const categoryId = formData.get('category_id') as string | null
  const description= formData.get('description') as string | null
  const status     = (formData.get('status') ?? 'completed') as AccountingTransactionStatus
  const method     = formData.get('payment_method') as AccountingPaymentMethod | null
  const dueDate    = formData.get('due_date') as string | null
  const contractId = formData.get('contract_id') as string | null
  const dealId     = formData.get('deal_id') as string | null
  const contactId  = formData.get('contact_id') as string | null
  const employeeId = formData.get('employee_id') as string | null

  if (!type || !['income', 'expense'].includes(type)) return { error: 'Тип транзакции обязателен' }
  if (!amount) return { error: 'Укажите корректную сумму (больше 0)' }
  if (!date)   return { error: 'Дата обязательна' }

  const payload = {
    type,
    amount,
    date,
    status,
    created_by: user.id,
    ...(categoryId  && { category_id:     categoryId }),
    ...(description && { description }),
    ...(method      && { payment_method:  method }),
    ...(dueDate     && { due_date:        dueDate }),
    ...(contractId  && { contract_id:     contractId }),
    ...(dealId      && { deal_id:         dealId }),
    ...(contactId   && { contact_id:      contactId }),
    ...(employeeId  && { employee_id:     employeeId }),
  }

  const { data, error } = await supabase
    .from('accounting_transactions')
    .insert(payload)
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/accounting')
  revalidatePath('/analytics')
  redirect(`/accounting/transactions/${data.id}`)
}

export async function updateTransactionAction(id: string, _prevState: unknown, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const rawAmount = formData.get('amount')
  const amount    = parseAmount(rawAmount)
  if (!amount) return { error: 'Укажите корректную сумму' }

  const date = formData.get('date') as string
  if (!date) return { error: 'Дата обязательна' }

  const categoryId = formData.get('category_id') as string | null
  const description= formData.get('description') as string | null
  const status     = formData.get('status') as AccountingTransactionStatus
  const method     = formData.get('payment_method') as AccountingPaymentMethod | null
  const dueDate    = formData.get('due_date') as string | null
  const contractId = formData.get('contract_id') as string | null
  const dealId     = formData.get('deal_id') as string | null
  const contactId  = formData.get('contact_id') as string | null
  const employeeId = formData.get('employee_id') as string | null

  const payload: Record<string, unknown> = {
    amount, date, status,
    category_id:    categoryId  || null,
    description:    description || null,
    payment_method: method      || null,
    due_date:       dueDate     || null,
    contract_id:    contractId  || null,
    deal_id:        dealId      || null,
    contact_id:     contactId   || null,
    employee_id:    employeeId  || null,
  }

  const { error } = await supabase
    .from('accounting_transactions')
    .update(payload)
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/accounting')
  revalidatePath(`/accounting/transactions/${id}`)
  redirect(`/accounting/transactions/${id}`)
}

export async function deleteTransactionAction(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { error } = await supabase
    .from('accounting_transactions')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/accounting')
  return { success: true }
}
