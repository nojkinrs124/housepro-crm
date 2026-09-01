import { describe, it, expect } from 'vitest'
import { buildCalendar, buildSingleEventIcs, addMinutes } from '@/lib/calendar/ics'

const baseEvent = {
  uid: 'showing-1@housepro',
  start: new Date('2026-09-15T10:00:00Z'),
  end: new Date('2026-09-15T10:30:00Z'),
  summary: 'Показ квартиры',
}

describe('buildCalendar', () => {
  it('возвращает валидный каркас VCALENDAR с CRLF', () => {
    const ics = buildCalendar([baseEvent])
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
    expect(ics).toContain('DTSTART:20260915T100000Z')
    expect(ics).toContain('DTEND:20260915T103000Z')
  })

  it('экранирует запятые и точки с запятой в тексте', () => {
    const ics = buildCalendar([{ ...baseEvent, location: 'Москва, ул. Ленина; д. 1' }])
    expect(ics).toContain('LOCATION:Москва\\, ул. Ленина\\; д. 1')
  })

  it('переводы строк в описании становятся \\n', () => {
    const ics = buildCalendar([{ ...baseEvent, description: 'Первая\nВторая' }])
    expect(ics).toContain('DESCRIPTION:Первая\\nВторая')
  })

  it('складывает длинные строки короче 76 октетов', () => {
    const ics = buildCalendar([{ ...baseEvent, summary: 'Очень длинное название показа '.repeat(6) }])
    const encoder = new TextEncoder()
    for (const line of ics.split('\r\n')) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75)
    }
  })

  it('добавляет напоминание только когда его попросили', () => {
    expect(buildCalendar([baseEvent])).not.toContain('BEGIN:VALARM')
    expect(buildCalendar([{ ...baseEvent, reminderMinutes: 60 }])).toContain('TRIGGER:-PT60M')
  })

  it('пробрасывает статус отменённого события', () => {
    expect(buildCalendar([{ ...baseEvent, status: 'CANCELLED' }])).toContain('STATUS:CANCELLED')
  })

  it('пустой список даёт валидный, но пустой календарь', () => {
    const ics = buildCalendar([])
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).not.toContain('BEGIN:VEVENT')
  })
})

describe('buildSingleEventIcs', () => {
  it('содержит ровно одно событие', () => {
    const ics = buildSingleEventIcs(baseEvent)
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1)
  })
})

describe('addMinutes', () => {
  it('сдвигает время на нужное число минут', () => {
    expect(addMinutes(new Date('2026-09-15T10:00:00Z'), 45).toISOString()).toBe('2026-09-15T10:45:00.000Z')
  })
})
