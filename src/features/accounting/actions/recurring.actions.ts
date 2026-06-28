'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { AccountingTransactionType, AccountingFrequency } from '@/types/database'
import { requireOrgId } from '@/lib/org'

function parseAmount(raw: unknown): number | null {
  const v = String(raw ?? '').replace(/\s/g, '').replace(',', '.')
  const n = parseFloat(v)
  return isNaN(n) || n <= 0 ? null : n
}

export async function createRecurringRuleAction(_prevState: unknown, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const name        = (formData.get('name') as string)?.trim()
  const type        = formData.get('type') as AccountingTransactionType
  const amount      = parseAmount(formData.get('amount'))
  const categoryId  = formData.get('category_id') as string | null
  const frequency   = formData.get('frequency') as AccountingFrequency
  const dayOfMonth  = formData.get('day_of_month') ? Number(formData.get('day_of_month')) : null
  const startDate   = formData.get('start_date') as string
  const endDate     = formData.get('end_date') as string | null
  const employeeId  = formData.get('employee_id') as string | null
  const notes       = formData.get('notes') as string | null

  if (!name)   return { error: 'Название обязательно' }
  if (!amount) return { error: 'Укажите корректную сумму' }
  if (!startDate) return { error: 'Дата начала обязательна' }

  const { data, error } = await supabase
    .from('accounting_recurring_rules')
    .insert({
      name, type, amount, frequency,
      start_date: startDate,
      organization_id: orgId,
      ...(categoryId   && { category_id:  categoryId }),
      ...(dayOfMonth   && { day_of_month: dayOfMonth }),
      ...(endDate      && { end_date:     endDate }),
      ...(employeeId   && { employee_id:  employeeId }),
      ...(notes        && { notes }),
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  // Generate first transaction if start_date is today or past
  const today = new Date().toISOString().slice(0, 10)
  if (startDate <= today) {
    await supabase.from('accounting_transactions').insert({
      type, amount,
      date: startDate,
      category_id:        categoryId  || null,
      employee_id:        employeeId  || null,
      recurring_rule_id:  data.id,
      status:             'completed',
      description:        name,
      created_by:         user.id,
      organization_id:    orgId,
    })
    await supabase
      .from('accounting_recurring_rules')
      .update({ last_generated_date: startDate })
      .eq('id', data.id)
  }

  revalidatePath('/accounting/recurring')
  return { success: true, id: data.id }
}

export async function updateRecurringRuleAction(id: string, _prevState: unknown, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const name       = (formData.get('name') as string)?.trim()
  const amount     = parseAmount(formData.get('amount'))
  const categoryId = formData.get('category_id') as string | null
  const frequency  = formData.get('frequency') as AccountingFrequency
  const dayOfMonth = formData.get('day_of_month') ? Number(formData.get('day_of_month')) : null
  const endDate    = formData.get('end_date') as string | null
  const employeeId = formData.get('employee_id') as string | null
  const notes      = formData.get('notes') as string | null
  const isActive   = formData.get('is_active') === 'true'

  if (!name)   return { error: 'Название обязательно' }
  if (!amount) return { error: 'Укажите корректную сумму' }

  const { error } = await supabase
    .from('accounting_recurring_rules')
    .update({
      name, amount, frequency, is_active: isActive,
      category_id:  categoryId  || null,
      day_of_month: dayOfMonth  || null,
      end_date:     endDate     || null,
      employee_id:  employeeId  || null,
      notes:        notes       || null,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/accounting/recurring')
  return { success: true }
}

export async function deleteRecurringRuleAction(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { error } = await supabase
    .from('accounting_recurring_rules')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/accounting/recurring')
  return { success: true }
}

// Generate due transactions for all active rules
export async function generateRecurringTransactionsAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const today = new Date().toISOString().slice(0, 10)

  const { data: rules } = await supabase
    .from('accounting_recurring_rules')
    .select('*')
    .eq('is_active', true)
    .or(`end_date.is.null,end_date.gte.${today}`)

  if (!rules || rules.length === 0) return { generated: 0 }

  let generated = 0

  for (const rule of rules as Array<{
    id: string; type: string; amount: number; category_id: string | null;
    employee_id: string | null; name: string; frequency: string;
    day_of_month: number | null; start_date: string; last_generated_date: string | null;
  }>) {
    const lastDate = rule.last_generated_date ?? rule.start_date
    const next = getNextDate(lastDate, rule.frequency, rule.day_of_month)

    if (next <= today) {
      await supabase.from('accounting_transactions').insert({
        type:               rule.type,
        amount:             rule.amount,
        date:               next,
        category_id:        rule.category_id,
        employee_id:        rule.employee_id,
        recurring_rule_id:  rule.id,
        description:        rule.name,
        status:             'planned',
        created_by:         user.id,
        organization_id:    orgId,
      })
      await supabase
        .from('accounting_recurring_rules')
        .update({ last_generated_date: next })
        .eq('id', rule.id)
      generated++
    }
  }

  revalidatePath('/accounting')
  return { generated }
}

function getNextDate(from: string, frequency: string, dayOfMonth: number | null): string {
  const d = new Date(from)
  switch (frequency) {
    case 'daily':   d.setDate(d.getDate() + 1); break
    case 'weekly':  d.setDate(d.getDate() + 7); break
    case 'monthly':
      d.setMonth(d.getMonth() + 1)
      if (dayOfMonth) d.setDate(Math.min(dayOfMonth, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()))
      break
    case 'yearly':  d.setFullYear(d.getFullYear() + 1); break
  }
  return d.toISOString().slice(0, 10)
}
