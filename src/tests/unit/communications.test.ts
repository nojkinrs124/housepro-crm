import { describe, it, expect } from 'vitest'
import { parseTelephonyPayload, describeCall } from '@/lib/communications/telephony'
import { parseWhatsappPayload, chatIdToPhone, phoneToChatId } from '@/lib/communications/whatsapp'

describe('parseTelephonyPayload — Манго', () => {
  it('разбирает входящий состоявшийся звонок', () => {
    const call = parseTelephonyPayload('mango', {
      entry_id: 'abc123',
      call_direction: 1,
      from: { number: '79991234567' },
      to: { number: '73912000000', extension: '101' },
      timestamp: 1789000000,
      talk_time: 95,
    })

    expect(call?.direction).toBe('inbound')
    expect(call?.counterpartyPhone).toBe('79991234567')
    expect(call?.status).toBe('answered')
    expect(call?.durationSec).toBe(95)
    expect(call?.agentExtension).toBe('101')
  })

  it('звонок без разговора считается пропущенным', () => {
    const call = parseTelephonyPayload('mango', {
      entry_id: 'abc124',
      call_direction: 1,
      from: { number: '79991234567' },
      talk_time: 0,
    })
    expect(call?.status).toBe('missed')
  })

  it('исходящий определяется по call_direction = 2', () => {
    const call = parseTelephonyPayload('mango', {
      entry_id: 'abc125',
      call_direction: 2,
      from: { number: '73912000000' },
      to: { number: '79995554433' },
      talk_time: 12,
    })
    expect(call?.direction).toBe('outbound')
    expect(call?.counterpartyPhone).toBe('79995554433')
  })

  it('без идентификатора звонка возвращает null', () => {
    expect(parseTelephonyPayload('mango', { call_direction: 1 })).toBeNull()
  })
})

describe('parseTelephonyPayload — UIS', () => {
  it('берёт номер клиента и первую запись разговора', () => {
    const call = parseTelephonyPayload('uis', {
      call_session_id: 55501,
      direction: 'in',
      contact_phone_number: '79001112233',
      virtual_phone_number: '73912111111',
      talk_duration: 40,
      start_time: '2026-09-01 12:30:00',
      call_records: [{ link: 'https://rec.example/1.mp3' }],
    })

    expect(call?.counterpartyPhone).toBe('79001112233')
    expect(call?.recordingUrl).toBe('https://rec.example/1.mp3')
    expect(call?.occurredAt.startsWith('2026-09-01')).toBe(true)
  })
})

describe('parseTelephonyPayload — Zadarma', () => {
  it('маппит disposition в статус CRM', () => {
    const call = parseTelephonyPayload('zadarma', {
      pbx_call_id: 'in_123',
      event: 'NOTIFY_END',
      caller_id: '79005554433',
      called_did: '73912222222',
      duration: 0,
      disposition: 'no answer',
      call_start: '2026-09-01 09:00:00',
    })
    expect(call?.status).toBe('missed')
    expect(call?.direction).toBe('inbound')
  })

  it('исходящий распознаётся по имени события', () => {
    const call = parseTelephonyPayload('zadarma', {
      pbx_call_id: 'out_1',
      event: 'NOTIFY_OUT_END',
      caller_id: '101',
      called_did: '79005554433',
      duration: 30,
      disposition: 'answered',
    })
    expect(call?.direction).toBe('outbound')
    expect(call?.counterpartyPhone).toBe('79005554433')
  })
})

describe('describeCall', () => {
  it('описывает пропущенный и состоявшийся звонок по-разному', () => {
    const base = {
      externalId: '1', direction: 'inbound' as const, counterpartyPhone: null,
      fromNumber: null, toNumber: null, occurredAt: '', recordingUrl: null, agentExtension: null,
    }
    expect(describeCall({ ...base, status: 'missed', durationSec: 0 })).toContain('пропущен')
    expect(describeCall({ ...base, status: 'answered', durationSec: 125 })).toContain('2 мин')
  })
})

describe('parseWhatsappPayload', () => {
  it('Wazzup: разбирает пачку сообщений', () => {
    const messages = parseWhatsappPayload('wazzup', {
      messages: [
        {
          messageId: 'w1',
          chatId: '79991234567',
          text: 'Здравствуйте!',
          dateTime: '2026-09-01T10:00:00Z',
          contact: { name: 'Иван' },
        },
      ],
    })
    expect(messages).toHaveLength(1)
    expect(messages[0].direction).toBe('inbound')
    expect(messages[0].counterpartyPhone).toBe('+79991234567')
    expect(messages[0].senderName).toBe('Иван')
  })

  it('Wazzup: isEcho помечает наше собственное сообщение', () => {
    const [message] = parseWhatsappPayload('wazzup', {
      messages: [{ messageId: 'w2', chatId: '79991234567', text: 'Ответ', isEcho: true }],
    })
    expect(message.direction).toBe('outbound')
  })

  it('Green API: игнорирует статусы доставки', () => {
    expect(parseWhatsappPayload('green_api', { typeWebhook: 'outgoingMessageStatus' })).toHaveLength(0)
  })

  it('Green API: разбирает входящее текстовое сообщение', () => {
    const [message] = parseWhatsappPayload('green_api', {
      typeWebhook: 'incomingMessageReceived',
      idMessage: 'g1',
      timestamp: 1789000000,
      senderData: { chatId: '79991234567@c.us', senderName: 'Пётр' },
      messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Привет' } },
    })
    expect(message.text).toBe('Привет')
    expect(message.counterpartyPhone).toBe('+79991234567')
  })

  it('неизвестный провайдер даёт пустой список', () => {
    expect(parseWhatsappPayload('unknown', {})).toEqual([])
  })
})

describe('chatId helpers', () => {
  it('преобразует chatId в телефон и обратно', () => {
    expect(chatIdToPhone('79991234567@c.us')).toBe('+79991234567')
    expect(phoneToChatId('+7 (999) 123-45-67', 'green_api')).toBe('79991234567@c.us')
    expect(phoneToChatId('+7 (999) 123-45-67', 'wazzup')).toBe('79991234567')
  })
})
