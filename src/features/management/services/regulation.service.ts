/**
 * Регламент обслуживания: когда какое плановое действие пора завести задачей.
 *
 * Даты считаются чистой функцией и проверяются тестом: пропущенное снятие
 * показаний — это неверный счёт, пропущенное окончание договора — потерянный
 * арендатор.
 *
 * Периодические правила привязаны к месяцу начала обслуживания, а не к
 * календарному году: объект, взятый в марте, проверяется в марте и сентябре,
 * а не в январе и июле.
 *
 * Файл намеренно без 'use client' и без 'use server'.
 */

export type RegulationPeriod = 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'on_event'

export interface Regulation {
  code: string
  title: string
  description?: string | null
  period: RegulationPeriod
  dayOfMonth: number | null
  leadDays: number
  priority: string
}

export const PERIOD_LABELS: Record<RegulationPeriod, string> = {
  monthly: 'Ежемесячно',
  quarterly: 'Раз в квартал',
  semiannual: 'Раз в полгода',
  annual: 'Раз в год',
  on_event: 'По событию',
}

const PERIOD_MONTHS: Record<Exclude<RegulationPeriod, 'on_event'>, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
}

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function shiftDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Срок, окно которого открыто на сегодня.
 *
 * Задача создаётся не в день срока, а за `leadDays` до него: показания снимают
 * заранее, а о конце договора думают за месяц. Возвращает дату срока или null,
 * если сегодня ни одно окно не открыто.
 */
export function dueWithinLeadWindow(
  regulation: Regulation,
  startedAt: string,
  today: string,
): string | null {
  if (regulation.period === 'on_event') return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startedAt) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return null

  const step = PERIOD_MONTHS[regulation.period]
  const day = Math.min(Math.max(regulation.dayOfMonth ?? 1, 1), 28)
  const [sy, sm] = startedAt.split('-').map(Number)

  let year = sy
  let month = sm
  for (let guard = 0; guard < 400; guard++) {
    const due = iso(year, month, day)
    // Сроки раньше начала обслуживания не наступали: объект тогда ещё не вели.
    if (due >= startedAt) {
      const windowOpens = shiftDays(due, -regulation.leadDays)
      if (today >= windowOpens && today <= due) return due
      // Ушли дальше сегодняшнего окна — дальше только более поздние сроки.
      if (windowOpens > today) return null
    }
    month += step
    while (month > 12) { month -= 12; year++ }
  }
  return null
}

/**
 * Срок по событию: окончание договора найма.
 *
 * Отдельно от календарных правил, потому что дата берётся из данных, а не из
 * периодичности. Без этого напоминания договор молча истекал бы.
 */
export function dueForEvent(
  regulation: Regulation,
  eventDate: string | null,
  today: string,
): string | null {
  if (regulation.period !== 'on_event' || !eventDate) return null
  if (today > eventDate) return null
  const windowOpens = shiftDays(eventDate, -regulation.leadDays)
  return today >= windowOpens ? eventDate : null
}

export interface PlannedTask {
  regulationCode: string
  title: string
  description: string | null
  dueDate: string
  priority: string
}

/**
 * Что нужно завести задачами по одному объекту на сегодня.
 *
 * Дубли не проверяются здесь: их не пускает уникальный индекс по
 * (обслуживание, правило, срок). Проверка в коде между чтением и вставкой не
 * спасает от двух одновременных прогонов крона.
 */
export function planTasksFor(
  regulations: Regulation[],
  context: { startedAt: string; rentEndDate: string | null },
  today: string = new Date().toISOString().slice(0, 10),
): PlannedTask[] {
  const planned: PlannedTask[] = []

  for (const regulation of regulations) {
    const due = regulation.period === 'on_event'
      ? dueForEvent(regulation, context.rentEndDate, today)
      : dueWithinLeadWindow(regulation, context.startedAt, today)

    if (!due) continue

    planned.push({
      regulationCode: regulation.code,
      title: regulation.title,
      description: regulation.description ?? null,
      dueDate: due,
      priority: regulation.priority,
    })
  }

  return planned
}
