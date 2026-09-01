import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// Месячная сетка показов. Компонент серверный: интерактива здесь нет —
// перелистывание месяцев сделано обычными ссылками (?month=YYYY-MM), поэтому
// вид работает без JS, шарится ссылкой и не тянет клиентский бандл.

export interface CalendarShowing {
 id: string
 scheduled_at: string
 status: string
 duration_min: number | null
 propertyTitle: string | null
 contactName: string | null
 agentName: string | null
}

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

const STATUS_DOT: Record<string, string> = {
 planned: 'var(--hp-info)',
 completed: 'var(--hp-good)',
 cancelled: 'var(--hp-sub)',
 no_show: 'var(--hp-danger)',
}

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

export function monthRange(month: Date): { from: string; to: string } {
 const from = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1))
 const to = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1))
 return { from: from.toISOString(), to: to.toISOString() }
}

export function ShowingsCalendar({
 month,
 showings,
}: {
 month: Date
 showings: CalendarShowing[]
}) {
 const firstDay = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1))
 const daysInMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate()
 const leading = mondayIndex(firstDay)
 const totalCells = Math.ceil((leading + daysInMonth) / 7) * 7

 const byDay = new Map<number, CalendarShowing[]>()
 for (const showing of showings) {
 const date = new Date(showing.scheduled_at)
 if (Number.isNaN(date.getTime())) continue
 if (date.getUTCMonth() !== month.getUTCMonth() || date.getUTCFullYear() !== month.getUTCFullYear()) continue
 const day = date.getUTCDate()
 const list = byDay.get(day) ?? []
 list.push(showing)
 byDay.set(day, list)
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
 <Link
 href={`/showings/calendar?month=${monthKey(prev)}`}
 className="flex items-center gap-1 px-3 py-2 border border-[var(--hp-border)] rounded-[var(--hp-radius)] text-sm text-[var(--hp-ink)] hover:border-[var(--hp-sub)] transition-colors"
 >
 <ChevronLeft className="w-4 h-4" />
 Назад
 </Link>
 <Link
 href="/showings/calendar"
 className="px-3 py-2 border border-[var(--hp-border)] rounded-[var(--hp-radius)] text-sm text-[var(--hp-ink)] hover:border-[var(--hp-sub)] transition-colors"
 >
 Сегодня
 </Link>
 <Link
 href={`/showings/calendar?month=${monthKey(next)}`}
 className="flex items-center gap-1 px-3 py-2 border border-[var(--hp-border)] rounded-[var(--hp-radius)] text-sm text-[var(--hp-ink)] hover:border-[var(--hp-sub)] transition-colors"
 >
 Вперёд
 <ChevronRight className="w-4 h-4" />
 </Link>
 </div>
 </div>

 <div className="overflow-x-auto">
 <div className="min-w-[640px] border border-[var(--hp-border)] bg-[var(--hp-surface)]">
 <div className="grid grid-cols-7 border-b border-[var(--hp-border)]">
 {WEEKDAYS.map((day) => (
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
 <div
 className={`text-xs mb-1 ${
 isToday
 ? 'font-bold text-[var(--hp-accent)]'
 : 'text-[var(--hp-sub)]'
 }`}
 >
 {dayNumber}
 </div>
 <div className="space-y-1">
 {items.slice(0, 3).map((item) => (
 <Link
 key={item.id}
 href={`/showings/${item.id}`}
 className="flex items-start gap-1.5 text-[11px] leading-tight text-[var(--hp-ink)] hover:bg-[var(--hp-neutral-tint)] px-1 py-0.5 transition-colors"
 >
 <span
 className="w-1.5 h-1.5 rounded-full shrink-0 mt-1"
 style={{ background: STATUS_DOT[item.status] ?? 'var(--hp-sub)' }}
 />
 <span className="min-w-0">
 <span className="font-semibold">
 {new Date(item.scheduled_at).toLocaleTimeString('ru-RU', {
 hour: '2-digit',
 minute: '2-digit',
 })}
 </span>{' '}
 <span className="break-words">{item.propertyTitle ?? item.contactName ?? 'Показ'}</span>
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

 <div className="flex items-center gap-4 flex-wrap text-xs text-[var(--hp-sub)]">
 {Object.entries({ planned: 'Запланирован', completed: 'Состоялся', cancelled: 'Отменён', no_show: 'Не пришёл' }).map(
 ([key, label]) => (
 <span key={key} className="flex items-center gap-1.5">
 <span className="w-2 h-2 rounded-full" style={{ background: STATUS_DOT[key] }} />
 {label}
 </span>
 )
 )}
 </div>
 </div>
 )
}
