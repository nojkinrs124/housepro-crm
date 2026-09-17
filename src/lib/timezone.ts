/**
 * Часовой пояс агентства — единственный для всех дат интерфейса.
 *
 * Сервер на машине разработчика живёт в UTC+7, Vercel — в UTC, база хранит
 * `timestamptz`. Пока каждый слой считал «сегодня» и «11:00» в своём поясе,
 * показ, назначенный на 11:00, показывался как 18:00, а операция по умолчанию
 * датировалась вчерашним днём (сквозной проход 17.09.2026, SH-1/TK-1/AC-2).
 *
 * Правило: в базу — UTC (ISO), на экран и в поля форм — `APP_TZ`.
 * `process.env.TZ` выставляется в `instrumentation.ts`, поэтому `new Date()`
 * и `toLocale*` без явного пояса тоже считают по Москве; функции ниже нужны
 * там, где поведение должно не зависеть от окружения (тесты, edge, крон).
 *
 * Файл намеренно без 'use client' — нужен и серверу, и формам.
 */

export const APP_TZ = process.env.NEXT_PUBLIC_APP_TZ || 'Europe/Moscow'

const partsFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TZ,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hourCycle: 'h23',
})

function partsIn(date: Date): { y: number; mo: number; d: number; h: number; mi: number; s: number } {
  const p = Object.fromEntries(partsFmt.formatToParts(date).map(x => [x.type, x.value]))
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second }
}

/** Смещение пояса относительно UTC в минутах на момент `date`. */
function offsetMinutes(date: Date): number {
  const p = partsIn(date)
  const asUtc = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s)
  return Math.round((asUtc - date.getTime()) / 60000)
}

/** Сегодняшняя дата агентства в формате YYYY-MM-DD. */
export function todayIso(now: Date = new Date()): string {
  const p = partsIn(now)
  return `${p.y}-${String(p.mo).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`
}

/**
 * Значение поля `datetime-local` («2026-09-20T11:00», по времени агентства) →
 * ISO в UTC для записи в `timestamptz`. Пустое и уже полное ISO — как есть.
 */
export function localDateTimeToIso(value: string | null | undefined): string | null {
  if (!value) return null
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(value)) return new Date(value).toISOString()
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(value)
  if (!m) return null
  const [, y, mo, d, h = '0', mi = '0', s = '0'] = m
  // Считаем как UTC, затем сдвигаем на смещение пояса в этот момент.
  const guess = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s))
  const utc = guess.getTime() - offsetMinutes(guess) * 60000
  // Второй проход — на границе перехода на летнее время смещение могло измениться.
  const fixed = new Date(utc)
  return new Date(guess.getTime() - offsetMinutes(fixed) * 60000).toISOString()
}

/** ISO/timestamptz → значение для `datetime-local` по времени агентства. */
export function isoToLocalDateTime(value: string | Date | null | undefined): string {
  if (!value) return ''
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const p = partsIn(d)
  return `${p.y}-${String(p.mo).padStart(2, '0')}-${String(p.d).padStart(2, '0')}T${String(p.h).padStart(2, '0')}:${String(p.mi).padStart(2, '0')}`
}

/** Дата и время по поясу агентства: «20.09.2026, 11:00». */
export function formatDateTime(
  value: string | Date | null | undefined,
  opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' },
): string {
  if (!value) return '—'
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('ru-RU', { ...opts, timeZone: APP_TZ })
}

/** Только время по поясу агентства: «11:00». */
export function formatTime(value: string | Date | null | undefined): string {
  return formatDateTime(value, { hour: '2-digit', minute: '2-digit' })
}
