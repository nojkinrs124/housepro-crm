// Генерация iCalendar (RFC 5545) без зависимостей.
//
// Нужна в двух местах: подписной фид календаря агента (/api/ical/[token])
// и вложение .ics в письме клиенту о назначенном показе.
//
// Формат капризный: CRLF-переводы строк, экранирование запятых и точек с запятой,
// и обязательный фолдинг длинных строк на 75 октетов — иначе Google Calendar
// молча отбрасывает событие.

export interface CalendarEvent {
  /** Стабильный идентификатор: при повторной выгрузке событие обновляется, а не дублируется. */
  uid: string
  start: Date
  end: Date
  summary: string
  description?: string | null
  location?: string | null
  url?: string | null
  /** CONFIRMED / TENTATIVE / CANCELLED — отменённый показ исчезает из календаря. */
  status?: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED'
  /** За сколько минут напомнить. 0/undefined — без напоминания. */
  reminderMinutes?: number
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** UTC в формате 20260901T140000Z — часовые пояса намеренно не используем. */
function formatUtc(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  )
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/**
 * Фолдинг по 75 октетов. Считаем именно байты UTF-8, а не символы:
 * кириллица занимает два байта, и наивный срез по длине строки даёт
 * слишком длинные строки, которые часть клиентов отбрасывает.
 */
function foldLine(line: string): string {
  const encoder = new TextEncoder()
  if (encoder.encode(line).length <= 75) return line

  const chunks: string[] = []
  let current = ''
  let currentBytes = 0
  // Первая строка — 75 октетов, продолжения начинаются с пробела, значит 74.
  let limit = 75

  for (const char of line) {
    const size = encoder.encode(char).length
    if (currentBytes + size > limit) {
      chunks.push(current)
      current = ''
      currentBytes = 0
      limit = 74
    }
    current += char
    currentBytes += size
  }
  if (current !== '') chunks.push(current)

  return chunks.join('\r\n ')
}

function eventLines(event: CalendarEvent): string[] {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${formatUtc(new Date())}`,
    `DTSTART:${formatUtc(event.start)}`,
    `DTEND:${formatUtc(event.end)}`,
    `SUMMARY:${escapeText(event.summary)}`,
    `STATUS:${event.status ?? 'CONFIRMED'}`,
  ]

  if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`)
  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`)
  if (event.url) lines.push(`URL:${event.url}`)

  if (event.reminderMinutes && event.reminderMinutes > 0) {
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `TRIGGER:-PT${event.reminderMinutes}M`,
      `DESCRIPTION:${escapeText(event.summary)}`,
      'END:VALARM'
    )
  }

  lines.push('END:VEVENT')
  return lines
}

export function buildCalendar(events: CalendarEvent[], calendarName = 'HousePro CRM'): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HousePro CRM//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    // Подсказка клиенту, как часто перечитывать подписку: чаще 15 минут
    // Google всё равно не ходит, реже — показ успевает «протухнуть».
    'X-PUBLISHED-TTL:PT15M',
    'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
    ...events.flatMap(eventLines),
    'END:VCALENDAR',
  ]

  return `${lines.map(foldLine).join('\r\n')}\r\n`
}

/** Одно событие в виде готового .ics — для вложения в письмо. */
export function buildSingleEventIcs(event: CalendarEvent): string {
  return buildCalendar([event], event.summary)
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000)
}
