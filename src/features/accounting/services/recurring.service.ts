import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

/**
 * Общая логика генерации транзакций по периодическим правилам (аренда офиса,
 * зарплаты, подписки). Используется в двух контекстах:
 * - `generateRecurringTransactionsAction` (recurring.actions.ts) — ручной вызов
 *   в рамках сессии пользователя, клиент с RLS видит только его организацию.
 * - `/api/cron/generate-recurring-transactions` — ежедневный cron (см. vercel.json),
 *   admin-клиент без RLS, обрабатывает правила всех организаций разом.
 *
 * За один вызов на правило генерируется максимум одна транзакция (следующая
 * просроченная дата). При ежедневном запуске крона это штатно — правило
 * "догоняет" реальность за несколько последовательных запусков, если вдруг
 * пропустило период (например, крон был выключен).
 */

interface RecurringRuleRow {
  id: string
  type: string
  amount: number
  category_id: string | null
  employee_id: string | null
  name: string
  frequency: string
  day_of_month: number | null
  start_date: string
  last_generated_date: string | null
  created_by: string | null
  organization_id: string | null
}

export function getNextDate(from: string, frequency: string, dayOfMonth: number | null): string {
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

export async function generateDueRecurringTransactions(
  supabase: SupabaseClient<Database>
): Promise<{ generated: number }> {
  const today = new Date().toISOString().slice(0, 10)

  const { data: rules } = await supabase
    .from('accounting_recurring_rules')
    .select('id, type, amount, category_id, employee_id, name, frequency, day_of_month, start_date, last_generated_date, created_by, organization_id')
    .eq('is_active', true)
    .or(`end_date.is.null,end_date.gte.${today}`)

  if (!rules || rules.length === 0) return { generated: 0 }

  let generated = 0

  for (const rule of rules as RecurringRuleRow[]) {
    // Транзакция без организации не вставится: колонка обязательная. Правило
    // без организации — испорченная строка; пропускаем её вслух, а не роняем
    // весь ежедневный крон на первой такой.
    if (!rule.organization_id) {
      console.error(`[recurring] Правило ${rule.id} без организации — пропущено`)
      continue
    }

    const lastDate = rule.last_generated_date ?? rule.start_date
    const next = getNextDate(lastDate, rule.frequency, rule.day_of_month)

    if (next <= today) {
      const { error: insertError } = await supabase.from('accounting_transactions').insert({
        type:               rule.type,
        amount:             rule.amount,
        date:               next,
        category_id:        rule.category_id,
        employee_id:        rule.employee_id,
        recurring_rule_id:  rule.id,
        description:        rule.name,
        status:             'planned',
        created_by:         rule.created_by,
        organization_id:    rule.organization_id,
      })
      if (insertError) {
        console.error(`[recurring] Не удалось создать транзакцию по правилу ${rule.id}:`, insertError.message)
        continue
      }

      await supabase
        .from('accounting_recurring_rules')
        .update({ last_generated_date: next })
        .eq('id', rule.id)
      generated++
    }
  }

  return { generated }
}
