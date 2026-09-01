// WhatsApp через провайдеров-шлюзов: Wazzup24 и Green API.
//
// Прямая интеграция с WhatsApp Business API требует верификации бизнеса в Meta
// и в России практически недоступна, поэтому работаем через шлюзы — они же
// дают простые REST-эндпоинты и вебхуки.

export type WhatsappProvider = 'wazzup' | 'green_api'

export const WHATSAPP_PROVIDERS: WhatsappProvider[] = ['wazzup', 'green_api']

export const WHATSAPP_PROVIDER_LABELS: Record<WhatsappProvider, string> = {
  wazzup: 'Wazzup24',
  green_api: 'Green API',
}

export interface ParsedMessage {
  externalId: string
  direction: 'inbound' | 'outbound'
  /** Номер собеседника в произвольном формате провайдера. */
  counterpartyPhone: string | null
  senderName: string | null
  text: string | null
  occurredAt: string
  /** Ссылка на вложение, если сообщение не текстовое. */
  attachmentUrl: string | null
  status: string | null
}

function str(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  return s === '' ? null : s
}

function toIso(value: unknown): string {
  const raw = str(value)
  if (!raw) return new Date().toISOString()
  if (/^\d{10}$/.test(raw)) return new Date(Number(raw) * 1000).toISOString()
  if (/^\d{13}$/.test(raw)) return new Date(Number(raw)).toISOString()
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
}

/** chatId у шлюзов — «79991234567@c.us» либо просто номер. */
export function chatIdToPhone(chatId: string | null): string | null {
  if (!chatId) return null
  const digits = chatId.split('@')[0].replace(/\D/g, '')
  return digits === '' ? null : `+${digits}`
}

export function phoneToChatId(phone: string, provider: WhatsappProvider): string {
  const digits = phone.replace(/\D/g, '')
  return provider === 'green_api' ? `${digits}@c.us` : digits
}

/**
 * Вебхук Wazzup24: пакет сообщений в поле messages.
 * Возвращает массив — за один запрос может прийти несколько сообщений.
 */
function parseWazzup(payload: Record<string, unknown>): ParsedMessage[] {
  const messages = Array.isArray(payload.messages) ? payload.messages : []

  return messages
    .map((raw) => {
      const m = raw as Record<string, unknown>
      const externalId = str(m.messageId)
      if (!externalId) return null

      const contact = (m.contact ?? {}) as Record<string, unknown>
      // isEcho означает сообщение, отправленное нами (из WhatsApp-приложения
      // или другой системы) — оно тоже должно попасть в ленту.
      const isOutbound = m.isEcho === true || str(m.status) === 'sent'

      return {
        externalId,
        direction: isOutbound ? ('outbound' as const) : ('inbound' as const),
        counterpartyPhone: chatIdToPhone(str(m.chatId)),
        senderName: str(contact.name),
        text: str(m.text),
        occurredAt: toIso(m.dateTime),
        attachmentUrl: str(m.contentUri),
        status: str(m.status),
      }
    })
    .filter((m): m is ParsedMessage => m !== null)
}

/** Вебхук Green API: одно событие на запрос. */
function parseGreenApi(payload: Record<string, unknown>): ParsedMessage[] {
  const type = str(payload.typeWebhook)
  if (type !== 'incomingMessageReceived' && type !== 'outgoingMessageReceived' && type !== 'outgoingAPIMessageReceived') {
    // Статусы доставки и события инстанса в ленту не пишем — это шум.
    return []
  }

  const externalId = str(payload.idMessage)
  if (!externalId) return []

  const senderData = (payload.senderData ?? {}) as Record<string, unknown>
  const messageData = (payload.messageData ?? {}) as Record<string, unknown>
  const textData = (messageData.textMessageData ?? messageData.extendedTextMessageData ?? {}) as Record<string, unknown>
  const fileData = (messageData.fileMessageData ?? {}) as Record<string, unknown>

  return [
    {
      externalId,
      direction: type === 'incomingMessageReceived' ? 'inbound' : 'outbound',
      counterpartyPhone: chatIdToPhone(str(senderData.chatId)),
      senderName: str(senderData.senderName ?? senderData.chatName),
      text: str(textData.textMessage ?? textData.text ?? fileData.caption),
      occurredAt: toIso(payload.timestamp),
      attachmentUrl: str(fileData.downloadUrl),
      status: null,
    },
  ]
}

export function parseWhatsappPayload(provider: string, payload: Record<string, unknown>): ParsedMessage[] {
  switch (provider) {
    case 'wazzup':
      return parseWazzup(payload)
    case 'green_api':
      return parseGreenApi(payload)
    default:
      return []
  }
}

export interface SendResult {
  ok: boolean
  externalId?: string
  error?: string
}

/**
 * Отправка исходящего сообщения. Учётные данные приходят из
 * channel_integrations.credentials конкретной организации.
 */
export async function sendWhatsappMessage(
  provider: WhatsappProvider,
  credentials: Record<string, unknown>,
  phone: string,
  text: string
): Promise<SendResult> {
  try {
    if (provider === 'wazzup') {
      const apiKey = String(credentials.apiKey ?? '')
      const channelId = String(credentials.channelId ?? '')
      if (!apiKey || !channelId) return { ok: false, error: 'Не заданы apiKey и channelId Wazzup' }

      const res = await fetch('https://api.wazzup24.com/v3/message', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId,
          chatId: phoneToChatId(phone, 'wazzup'),
          chatType: 'whatsapp',
          text,
        }),
      })

      const body = (await res.json().catch(() => ({}))) as { messageId?: string; error?: string; description?: string }
      if (!res.ok) return { ok: false, error: body.description ?? body.error ?? `Wazzup вернул ${res.status}` }
      return { ok: true, externalId: body.messageId }
    }

    const instanceId = String(credentials.instanceId ?? '')
    const token = String(credentials.apiToken ?? '')
    if (!instanceId || !token) return { ok: false, error: 'Не заданы instanceId и apiToken Green API' }

    const res = await fetch(`https://api.green-api.com/waInstance${instanceId}/sendMessage/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: phoneToChatId(phone, 'green_api'), message: text }),
    })

    const body = (await res.json().catch(() => ({}))) as { idMessage?: string; message?: string }
    if (!res.ok) return { ok: false, error: body.message ?? `Green API вернул ${res.status}` }
    return { ok: true, externalId: body.idMessage }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Сбой отправки сообщения' }
  }
}
