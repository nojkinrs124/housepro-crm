import { describe, it, expect } from 'vitest'
import { NOTIFICATIONS, buildNotification, type NotificationEvent } from '@/lib/telegram/notify'

const EVENTS = Object.keys(NOTIFICATIONS) as NotificationEvent[]

describe('реестр уведомлений бота', () => {
  it('у каждого события есть название и шаблон', () => {
    expect(EVENTS.length).toBeGreaterThan(0)
    for (const event of EVENTS) {
      expect(NOTIFICATIONS[event].label.length, event).toBeGreaterThan(0)
      expect(typeof NOTIFICATIONS[event].build, event).toBe('function')
    }
  })

  it('«новый лид»: имя, телефон, источник и ссылка в карточку', () => {
    const text = buildNotification('new_lead', {
      id: 'lead-1',
      full_name: 'Петров',
      phone: '89120000000',
      source: 'website',
    })

    expect(text).toContain('Петров')
    expect(text).toContain('89120000000')
    expect(text).toContain('/leads/lead-1')
    expect(text).not.toContain('null')
    expect(text).not.toContain('undefined')
  })

  it('«новый лид» без необязательных полей не оставляет пустых строк', () => {
    const text = buildNotification('new_lead', { id: 'lead-2' })
    const lines = text.split('\n')

    expect(lines.every((line) => line.trim().length > 0)).toBe(true)
    expect(text).toContain('/leads/lead-2')
  })

  it('эскалация Авито: причина и клиент на месте', () => {
    const text = buildNotification('avito_escalation', {
      leadId: 'lead-3',
      reason: 'клиент просит обсудить цену',
      clientName: 'Анна',
      propertyTitle: '2к на Ленина 10',
    })

    expect(text).toContain('Анна')
    expect(text).toContain('2к на Ленина 10')
    expect(text).toContain('обсудить цену')
    expect(text).toContain('/leads/lead-3')
  })

  it('в шаблонах только разрешённые HTML-теги, без висячих угловых скобок', () => {
    // Telegram parse_mode=HTML молча ломает сообщение на невалидном теге —
    // уведомление теряется целиком, и владелец его просто не видит.
    // Проверяем разбором, а не заменой строки: каждый фрагмент вида <...>
    // обязан быть разрешённым тегом, а угловые скобки вне тегов запрещены.
    const allowedTag = /^<\/?(b|i|code|a)(\s[^>]*)?>$/
    for (const event of EVENTS) {
      const text = buildNotification(event, {} as never)
      const completeTags = [...text.matchAll(/<[^>]*>/g)].map((match) => match[0])
      for (const tag of completeTags) {
        expect(allowedTag.test(tag), `${event}: недопустимый тег ${tag}`).toBe(true)
      }
      const angleChars = (text.match(/[<>]/g) ?? []).length
      const angleCharsInTags = completeTags.reduce(
        (sum, tag) => sum + (tag.match(/[<>]/g) ?? []).length,
        0,
      )
      expect(angleChars, `${event}: угловая скобка вне тега`).toBe(angleCharsInTags)
    }
  })
})
