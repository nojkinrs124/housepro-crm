import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

type Client = SupabaseClient<Database>

/** За сколько дней до срока выхода на основную сделку напоминать. */
const LEAD_DAYS = 5

/** Код напоминания — по нему же ищутся дубли при повторном прогоне крона. */
const REMINDER_KIND = 'preliminary-deadline'

/**
 * Напоминания о приближении срока выхода на основную сделку.
 *
 * Предварительный договор в продаже задаёт дату, к которой стороны обязаны выйти
 * на основную сделку. Просрочить её значит потерять задаток или получить спор —
 * а система до сих пор эту дату только хранила.
 *
 * Живёт в ежедневном кроне генерации (`/api/cron/generate-recurring-transactions`),
 * а не в своём: на тарифе Hobby частота кронов ограничена, и `npm run check:cron`
 * это стережёт. Задача создаётся один раз на сделку: повторный прогон находит
 * существующую по префиксу заголовка и ничего не дублирует.
 */
export async function createPreliminaryDeadlineTasks(
  supabase: Client,
  today: string = new Date().toISOString().slice(0, 10),
): Promise<{ created: number; skipped: number }> {
  const horizon = new Date(`${today}T00:00:00Z`)
  horizon.setUTCDate(horizon.getUTCDate() + LEAD_DAYS)
  const horizonStr = horizon.toISOString().slice(0, 10)

  // Сделки продажи, застрявшие на предварительном договоре, у которых срок
  // выхода на сделку уже на горизонте.
  const { data: deals } = await supabase
    .from('deals')
    .select('id, deal_number, organization_id, manager_id, property_id, expected_close_date')
    .eq('deal_type', 'sale')
    .eq('status', 'preliminary')
    .not('expected_close_date', 'is', null)
    .lte('expected_close_date', horizonStr)
    .gte('expected_close_date', today)

  if (!deals || deals.length === 0) return { created: 0, skipped: 0 }

  const dealIds = deals.map(d => d.id)

  // Уже созданные напоминания — ищем разом, а не запросом на каждую сделку.
  const { data: existing } = await supabase
    .from('tasks')
    .select('deal_id, title')
    .in('deal_id', dealIds)
    .like('title', `%${REMINDER_KIND}%`)

  const alreadyNotified = new Set((existing ?? []).map(t => t.deal_id))

  const rows = deals
    .filter(d => !alreadyNotified.has(d.id))
    .map(d => ({
      // Код вписан в заголовок, а не в отдельную колонку: колонки `source` у
      // задач нет, а заводить её ради одного напоминания — лишняя миграция.
      title: `Выйти на основную сделку до ${d.expected_close_date} [${REMINDER_KIND}]`,
      description:
        `По сделке ${d.deal_number ? `СД-${d.deal_number}` : d.id.slice(0, 8)} истекает срок ` +
        `предварительного договора. Просрочка — это спор о задатке, а не просто задержка.`,
      status: 'todo',
      priority: 'high',
      due_date: d.expected_close_date,
      deadline: d.expected_close_date,
      deal_id: d.id,
      property_id: d.property_id,
      assigned_to: d.manager_id,
      organization_id: d.organization_id,
    }))

  if (rows.length === 0) return { created: 0, skipped: deals.length }

  const { error } = await supabase.from('tasks').insert(rows)
  if (error) return { created: 0, skipped: deals.length }

  return { created: rows.length, skipped: deals.length - rows.length }
}
