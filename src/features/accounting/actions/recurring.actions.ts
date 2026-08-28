'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { AccountingTransactionType, AccountingFrequency } from '@/types/database'
import { requireOrgId } from '@/lib/org'
import { requirePermission } from '@/lib/permissions'
import { generateDueRecurringTransactions } from '../services/recurring.service'

function parseAmount(raw: unknown): number | null {
  const v = String(raw ?? '').replace(/\s/g, '').replace(',', '.')
  const n = parseFloat(v)
  return isNaN(n) || n <= 0 ? null : n
}

export async function createRecurringRuleAction(_prevState: unknown, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const permError = await requirePermission(user.id, 'accounting', 'create')
  if (permError) return permError

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

  const permError = await requirePermission(user.id, 'accounting', 'update')
  if (permError) return permError

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

  const permError = await requirePermission(user.id, 'accounting', 'delete')
  if (permError) return permError

  const { error } = await supabase
    .from('accounting_recurring_rules')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/accounting/recurring')
  return { success: true }
}

// Ручной запуск генерации (кнопка на /accounting/recurring). Основной механизм —
// ежедневный cron, см. /api/cron/generate-recurring-transactions. RLS клиента
// ограничивает видимость правил организацией текущего пользователя.
export async function generateRecurringTransactionsAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const permError = await requirePermission(user.id, 'accounting', 'create')
  if (permError) return permError

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const result = await generateDueRecurringTransactions(supabase)

  revalidatePath('/accounting')
  revalidatePath('/accounting/recurring')
  return result
}
