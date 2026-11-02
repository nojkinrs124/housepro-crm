import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  botMessageExternalId,
  buildBotAuthoredIndex,
  decideTakeover,
  escalationExternalId,
  isBotAuthored,
  lastHumanMessage,
  takeoverWindowMinutes,
  DEFAULT_TAKEOVER_WINDOW_MINUTES,
} from '@/features/avito/services/avito-takeover'
import type { AvitoMessage } from '@/features/avito/services/avito-api.service'

const CHAT = 'chat-1'
const WINDOW = 24 * 60 * 60 * 1000

function msg(partial: Partial<AvitoMessage> & { id: string; createdAt: string }): AvitoMessage {
  return {
    chatId: CHAT,
    authorId: null,
    isOutgoing: false,
    text: 'текст',
    ...partial,
  }
}

const incoming = (id: string, createdAt: string, text = 'Здравствуйте, актуально?') =>
  msg({ id, createdAt, text, isOutgoing: false })

const outgoing = (id: string, createdAt: string, text = 'Да, актуально') =>
  msg({ id, createdAt, text, isOutgoing: true })

describe('бот отличает свои сообщения от сообщений человека', () => {
  it('external_id ответа бота собирается из чата и настоящего id сообщения Авито', () => {
    expect(botMessageExternalId('chat-1', '999')).toBe('avito-bot:chat-1:999')
  })

  it('разбирает новые записи, старый формат и передачу диалога человеку', () => {
    const index = buildBotAuthoredIndex(
      [
        { external_id: 'avito-bot:chat-1:101', body: 'Ответ бота', occurred_at: '2026-11-02T09:00:00Z' },
        { external_id: 'bot-chat-1-1700000000000', body: 'Старый ответ', occurred_at: '2026-11-01T09:00:00Z' },
        { external_id: 'avito-escalated:chat-1:1700000000000', body: 'Бот передал', occurred_at: '2026-11-02T08:00:00Z' },
        // Чужой чат и входящее сообщение в индекс попасть не должны.
        { external_id: 'avito-bot:chat-2:555', body: 'Другой чат', occurred_at: '2026-11-02T09:00:00Z' },
        { external_id: '777', body: 'Ответ бота', occurred_at: '2026-11-02T09:00:00Z' },
      ],
      CHAT
    )

    expect([...index.ids]).toEqual(['101'])
    expect([...index.bodies]).toEqual(['Старый ответ'])
    expect(index.escalatedAt?.toISOString()).toBe('2026-11-02T08:00:00.000Z')
  })

  it('сообщение бота узнаётся по id, старый ответ — по тексту, ответ человека — нет', () => {
    const index = buildBotAuthoredIndex(
      [{ external_id: 'bot-chat-1-1', body: 'Старый ответ', occurred_at: '2026-11-01T09:00:00Z' }],
      CHAT
    )
    index.ids.add('101')

    expect(isBotAuthored(outgoing('101', '2026-11-02T09:00:00Z', 'Что угодно'), index)).toBe(true)
    expect(isBotAuthored(outgoing('202', '2026-11-02T09:00:00Z', 'Старый ответ'), index)).toBe(true)
    expect(isBotAuthored(outgoing('303', '2026-11-02T09:00:00Z', 'Показ в 18:00'), index)).toBe(false)
  })

  it('последнее сообщение человека находится, даже если после него писал бот', () => {
    const index = buildBotAuthoredIndex([], CHAT)
    index.ids.add('bot-2')

    const human = lastHumanMessage(
      [
        outgoing('human-1', '2026-11-02T09:00:00Z', 'Я перезвоню'),
        outgoing('bot-2', '2026-11-02T09:10:00Z', 'Хорошо'),
      ],
      index
    )

    expect(human?.id).toBe('human-1')
  })
})

describe('бот молчит, когда диалог ведёт человек', () => {
  const now = new Date('2026-11-02T12:00:00Z')
  const index = buildBotAuthoredIndex([], CHAT)
  index.ids.add('bot-1')

  const base = { windowMs: WINDOW, now }

  it('первый ответ бота на обращение — отвечаем', () => {
    const decision = decideTakeover({
      ...base,
      messages: [incoming('in-1', '2026-11-02T11:59:00Z')],
      index,
    })
    expect(decision.silent).toBe(false)
    expect(decision.reason).toBeNull()
  })

  it('бот ответил, клиент написал снова — отвечаем', () => {
    const decision = decideTakeover({
      ...base,
      messages: [outgoing('bot-1', '2026-11-02T11:00:00Z'), incoming('in-2', '2026-11-02T11:59:00Z')],
      index,
    })
    expect(decision.silent).toBe(false)
  })

  it('человек ответил час назад — бот молчит', () => {
    const decision = decideTakeover({
      ...base,
      messages: [
        outgoing('bot-1', '2026-11-02T09:00:00Z'),
        outgoing('human-1', '2026-11-02T11:00:00Z', 'Добрый день, это Руслан'),
        incoming('in-2', '2026-11-02T11:58:00Z', 'Спасибо, тогда жду звонка'),
      ],
      index,
    })
    expect(decision).toEqual({ silent: true, reason: 'human', since: '2026-11-02T11:00:00.000Z' })
  })

  it('человек отвечал больше суток назад — бот снова подхватывает вернувшегося клиента', () => {
    const decision = decideTakeover({
      ...base,
      messages: [
        outgoing('human-1', '2026-11-01T09:00:00Z', 'Добрый день, это Руслан'),
        incoming('in-2', '2026-11-02T11:58:00Z', 'Здравствуйте, а ещё актуально?'),
      ],
      index,
    })
    expect(decision.silent).toBe(false)
  })

  it('бот сам передал диалог человеку — молчит, хотя сам же и отвечал', () => {
    const escalated = buildBotAuthoredIndex(
      [{ external_id: escalationExternalId(CHAT), body: 'Бот передал диалог человеку: скидка', occurred_at: '2026-11-02T10:00:00Z' }],
      CHAT
    )
    escalated.ids.add('bot-1')
    const decision = decideTakeover({
      ...base,
      messages: [outgoing('bot-1', '2026-11-02T09:30:00Z'), incoming('in-2', '2026-11-02T11:58:00Z')],
      index: escalated,
    })
    expect(decision).toEqual({ silent: true, reason: 'escalated', since: '2026-11-02T10:00:00.000Z' })
  })

  it('окно задаётся переменной окружения, иначе сутки', () => {
    const previous = process.env.AVITO_TAKEOVER_WINDOW_HOURS
    try {
      delete process.env.AVITO_TAKEOVER_WINDOW_HOURS
      expect(takeoverWindowMinutes()).toBe(DEFAULT_TAKEOVER_WINDOW_MINUTES)
      process.env.AVITO_TAKEOVER_WINDOW_HOURS = '2'
      expect(takeoverWindowMinutes()).toBe(120)
      process.env.AVITO_TAKEOVER_WINDOW_HOURS = 'чепуха'
      expect(takeoverWindowMinutes()).toBe(DEFAULT_TAKEOVER_WINDOW_MINUTES)
    } finally {
      if (previous === undefined) delete process.env.AVITO_TAKEOVER_WINDOW_HOURS
      else process.env.AVITO_TAKEOVER_WINDOW_HOURS = previous
    }
  })
})

describe('крон не обходит правило молчания', () => {
  const source = readFileSync(resolve(__dirname, '../../app/api/cron/avito-messenger/route.ts'), 'utf8')

  it('решение принимается через decideTakeover, а не по «есть входящее — отвечаем»', () => {
    expect(source).toContain('decideTakeover(')
    expect(source).toMatch(/humanOwnsDialog[\s\S]{0,400}runAvitoDialogTurn/)
  })

  it('ответ бота пишется в ленту с настоящим id — иначе следующий прогон примет его за ответ человека', () => {
    expect(source).toContain('botMessageExternalId(chat.id, sent.id)')
  })
})
