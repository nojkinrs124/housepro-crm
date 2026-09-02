import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// Месячная сетка календаря CRM: показы, дедлайны задач и плановые платежи.
// Компонент серверный: интерактива здесь нет — перелистывание месяцев и выбор
// типов событий сделаны обычными ссылками (?month=YYYY-MM&kind=…), поэтому вид
// работает без JS, шарится ссылкой и не тянет клиентский бандл.

export type EventKind = 'showing' | 'task' | 'payment'
export type EventTone = 'info' | 'good' | 'warn' | 'danger' | 'neutral'

export interface CalendarEvent {
  id: string
  kind: EventKind
  /** ISO-дата события; для задач и платежей время не показывается */
  at: string
  title: string
  href: string
  tone: EventTone
  /** Задачи и платежи привязаны к дню, а не к часу */
  allDay?: boolean
}

export const TONE_COLOR: Record<EventTone, string> = {
  info:    'var(--hp-info)',
  good:    'var(--hp-good)',
  warn:    'var(--hp-warn)',
  danger:  'var(--hp-danger)',
  neutral: 'var(--hp-sub)',
}

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

/** Понедельник как первый день недели: воскресенье в JS — 0. */
function mondayIndex(date: Date): number {
  return (date.getUTCDay() + 6) % 7
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export function parseMonth(raw: string | undefined): Date {
  const match = raw?.match(/^(\d{4})-(\d{2})$/)
  if (!match) {
    const now = new Date()
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  }
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1))
}

export function monthRange(month: Date): { from: string; to: string; fromDay: string; toDay: string } {
  const from = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1))
  const to = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1))
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    // Колонка due_date у платежей — date, а не timestamptz: сравнивать нужно днём
    fromDay: from.toISOString().slice(0, 10),
    toDay: to.toISOString().slice(0, 10),
  }
}

export function CalendarMonth({
  month,
  events,
  basePath,
  query = {},
}: {
  month: Date
  events: CalendarEvent[]
  /** Куда ведут стрелки месяцев */
  basePath: string
  /** Параметры, которые нужно сохранить при перелистывании (например kind) */
  query?: Record<string, string | undefined>
}) {
  const firstDay = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1))
  const daysInMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate()
  const leading = mondayIndex(firstDay)
  const totalCells = Math.ceil((leading + daysInMonth) / 7) * 7

  const byDay = new Map<number, CalendarEvent[]>()
  for (const event of events) {
    const date = new Date(event.at)
    if (Number.isNaN(date.getTime())) continue
    if (date.getUTCMonth() !== month.getUTCMonth() || date.getUTCFullYear() !== month.getUTCFullYear()) continue
    const day = date.getUTCDate()
    const list = byDay.get(day) ?? []
    list.push(event)
    byDay.set(day, list)
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => a.at.localeCompare(b.at))
  }

  const href = (m: Date | null) => {
    const params = new URLSearchParams()
    if (m) params.set('month', monthKey(m))
    for (const [key, value] of Object.entries(query)) {
      if (value) params.set(key, value)
    }
    const qs = params.toString()
    return basePath + (qs ? `?${qs}` : '')
  }

  const prev = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1))
  const next = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1))
  const today = new Date()
  const isCurrentMonth =
    today.getUTCMonth() === month.getUTCMonth() && today.getUTCFullYear() === month.getUTCFullYear()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-bold text-[var(--hp-ink)] text-[17px] capitalize">
          {month.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
        </h2>
        <div className="flex items-center gap-2">
          <Link href={href(prev)} className="hp-chip">
            <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
            Назад
          </Link>
          <Link href={href(null)} className="hp-chip">Сегодня</Link>
          <Link href={href(next)} className="hp-chip">
            Вперёд
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[640px] border border-[var(--hp-border)] bg-[var(--hp-surface)]">
          <div className="grid grid-cols-7 border-b border-[var(--hp-border)]">
            {WEEKDAYS.map(day => (
              <div key={day} className="px-2 py-2 text-xs font-semibold text-[var(--hp-sub)] text-center">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {Array.from({ length: totalCells }, (_, index) => {
              const dayNumber = index - leading + 1
              const inMonth = dayNumber >= 1 && dayNumber <= daysInMonth
              const items = inMonth ? byDay.get(dayNumber) ?? [] : []
              const isToday = inMonth && isCurrentMonth && today.getUTCDate() === dayNumber

              return (
                <div
                  key={index}
                  className={`min-h-[92px] border-r border-b border-[var(--hp-border-soft)] p-1.5 ${
                    inMonth ? '' : 'bg-[var(--hp-neutral-tint)]'
                  }`}
                >
                  {inMonth && (
                    <>
                      <div className={`text-xs mb-1 ${isToday ? 'font-bold text-[var(--hp-accent)]' : 'text-[var(--hp-sub)]'}`}>
                        {dayNumber}
                      </div>
                      <div className="space-y-1">
                        {items.slice(0, 3).map(item => (
                          <Link
                            key={`${item.kind}-${item.id}`}
                            href={item.href}
                            className="flex items-start gap-1.5 text-[11px] leading-tight text-[var(--hp-ink)] hover:bg-[var(--hp-neutral-tint)] px-1 py-0.5 transition-colors"
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0 mt-1"
                              style={{ background: TONE_COLOR[item.tone] }}
                            />
                            <span className="min-w-0">
                              {!item.allDay && (
                                <span className="font-semibold">
                                  {new Date(item.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}{' '}
                              <span className="break-words">{item.title}</span>
                            </span>
                          </Link>
                        ))}
                        {items.length > 3 && (
                          <span className="block text-[11px] text-[var(--hp-sub)] px-1">
                            ещё {items.length - 3}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
