import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { planTasksFor, type Regulation } from '@/features/management/services/regulation.service'

type Client = SupabaseClient<Database>

/** Договоры найма, которые считаются действующими для целей регламента. */
const ACTIVE_RENT_STATUSES = ['generated', 'signed', 'completed']
const RENT_TYPES = ['rent_apartment', 'rent_commercial']

export interface GenerationSummary {
  engagements: number
  created: number
  /** Задача уже была — нормальный исход повторного прогона. */
  skipped: number
  /** Вставка не удалась по другой причине: это видно в ответе крона. */
  failed: number
}

/**
 * Заводит задачи по регламенту обслуживания на сегодня.
 *
 * Живёт в ежедневном кроне `/api/cron/generate-recurring-transactions`, а не в
 * своём: на тарифе Hobby частота кронов ограничена, и лишнее задание в
 * vercel.json приводит к тому, что Vercel МОЛЧА отбрасывает весь деплой
 * (см. scripts/checks/vercel-cron.mjs).
 *
 * Дубли при повторном прогоне держит уникальный индекс по
 * (обслуживание, правило, срок). Здесь дополнительно отбираются уже
 * существующие задачи — чтобы не делать вставок, которые всё равно упадут.
 */
export async function generateRegulationTasks(
  supabase: Client,
  today: string = new Date().toISOString().slice(0, 10),
): Promise<GenerationSummary> {
  const { data: engagements } = await supabase
    .from('management_engagements')
    .select('id, organization_id, property_id, plan_id, started_at, property:properties(manager_id, title)')
    .is('ended_at', null)
    .eq('status', 'active')

  if (!engagements || engagements.length === 0) {
    return { engagements: 0, created: 0, skipped: 0, failed: 0 }
  }

  const planIds = [...new Set(engagements.map(e => e.plan_id).filter((v): v is string => !!v))]
  const propertyIds = [...new Set(engagements.map(e => e.property_id))]
  const engagementIds = engagements.map(e => e.id)

  const [{ data: regulations }, { data: rentContracts }, { data: existing }] = await Promise.all([
    planIds.length
      ? supabase.from('management_regulations')
          .select('plan_id, code, title, description, period, day_of_month, lead_days, priority')
          .in('plan_id', planIds).eq('is_active', true).order('sort_order')
      : Promise.resolve({ data: [] }),
    supabase.from('contracts')
      .select('property_id, end_date, status')
      .in('property_id', propertyIds)
      .in('contract_type', RENT_TYPES)
      .in('status', ACTIVE_RENT_STATUSES),
    // Уже созданные регламентные задачи: чтобы не пытаться вставить то, что
    // индекс всё равно не пропустит.
    supabase.from('tasks')
      .select('engagement_id, regulation_code, due_date')
      .in('engagement_id', engagementIds)
      .not('regulation_code', 'is', null),
  ])

  const byPlan = new Map<string, Regulation[]>()
  for (const r of regulations ?? []) {
    if (!r.plan_id) continue
    const list = byPlan.get(r.plan_id) ?? []
    list.push({
      code: r.code,
      title: r.title,
      description: r.description,
      period: r.period as Regulation['period'],
      dayOfMonth: r.day_of_month,
      leadDays: r.lead_days,
      priority: r.priority,
    })
    byPlan.set(r.plan_id, list)
  }

  // Ближайшее окончание действующего договора найма по объекту.
  const rentEndByProperty = new Map<string, string>()
  for (const c of rentContracts ?? []) {
    if (!c.property_id || !c.end_date) continue
    const current = rentEndByProperty.get(c.property_id)
    if (!current || c.end_date < current) rentEndByProperty.set(c.property_id, c.end_date)
  }

  const done = new Set(
    (existing ?? []).map(t => `${t.engagement_id}:${t.regulation_code}:${t.due_date}`),
  )

  let created = 0
  let skipped = 0
  let failed = 0

  for (const engagement of engagements) {
    const regs = engagement.plan_id ? byPlan.get(engagement.plan_id) ?? [] : []
    if (regs.length === 0) continue

    const property = Array.isArray(engagement.property) ? engagement.property[0] : engagement.property

    const planned = planTasksFor(
      regs,
      {
        startedAt: engagement.started_at,
        rentEndDate: rentEndByProperty.get(engagement.property_id) ?? null,
      },
      today,
    )

    for (const task of planned) {
      const key = `${engagement.id}:${task.regulationCode}:${task.dueDate}`
      if (done.has(key)) { skipped++; continue }

      // Вставки поштучно, а не пачкой: при одновременном прогоне пачка упала бы
      // целиком из-за одной уже существующей строки, и вместе с ней потерялись
      // бы остальные задачи дня.
      const { error } = await supabase.from('tasks').insert({
        title: property?.title ? `${task.title} — ${property.title}` : task.title,
        description: task.description,
        status: 'todo',
        priority: task.priority,
        due_date: task.dueDate,
        deadline: task.dueDate,
        engagement_id: engagement.id,
        regulation_code: task.regulationCode,
        property_id: engagement.property_id,
        assigned_to: property?.manager_id ?? null,
        organization_id: engagement.organization_id,
      })

      if (error) {
        // 23505 — уникальный индекс: задача уже есть. Это нормальный исход
        // повторного прогона, а не сбой, и путать его с настоящей ошибкой
        // нельзя: иначе в ответе крона не видно, что что-то действительно
        // не записалось.
        if (error.code === '23505') skipped++
        else failed++
      } else {
        created++
        done.add(key)
      }
    }
  }

  return { engagements: engagements.length, created, skipped, failed }
}
