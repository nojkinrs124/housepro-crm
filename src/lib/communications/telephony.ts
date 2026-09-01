// Разбор вебхуков телефонии в общий вид.
//
// Поддерживаются Манго Телеком, UIS/Comagic, Zadarma и «generic» — простой
// формат для самописных интеграций и АТС, которых здесь нет.
//
// Адаптеры намеренно терпимы к отсутствующим полям: у провайдеров разные
// наборы событий (начало / ответ / завершение), и запись о звонке должна
// создаться даже по первому из них, а затем дополниться по external_id.

export type TelephonyProvider = 'mango' | 'uis' | 'zadarma' | 'generic'

export const TELEPHONY_PROVIDERS: TelephonyProvider[] = ['mango', 'uis', 'zadarma', 'generic']

export const TELEPHONY_PROVIDER_LABELS: Record<TelephonyProvider, string> = {
  mango: 'Манго Телеком',
  uis: 'UIS / Comagic',
  zadarma: 'Zadarma',
  generic: 'Другая АТС (простой формат)',
}

export interface ParsedCall {
  /** Идентификатор звонка у провайдера — ключ идемпотентности. */
  externalId: string
  direction: 'inbound' | 'outbound'
  /** Номер клиента (не наш внутренний). */
  counterpartyPhone: string | null
  fromNumber: string | null
  toNumber: string | null
  occurredAt: string
  durationSec: number | null
  /** answered | missed | busy | failed — в терминах CRM, не провайдера. */
  status: string
  recordingUrl: string | null
  /** Внутренний номер сотрудника, если провайдер его прислал. */
  agentExtension: string | null
}

function str(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  return s === '' ? null : s
}

function int(value: unknown): number | null {
  const n = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(n) ? n : null
}

/** Провайдеры шлют время секундами Unix, миллисекундами или строкой ISO. */
function toIso(value: unknown): string {
  const raw = str(value)
  if (!raw) return new Date().toISOString()

  if (/^\d{10}$/.test(raw)) return new Date(Number(raw) * 1000).toISOString()
  if (/^\d{13}$/.test(raw)) return new Date(Number(raw)).toISOString()

  const parsed = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T'))
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
}

function pick(payload: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    const value = key.split('.').reduce<unknown>((acc, part) => {
      if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[part]
      return undefined
    }, payload)
    if (value !== undefined && value !== null && String(value).trim() !== '') return value
  }
  return undefined
}

function parseMango(payload: Record<string, unknown>): ParsedCall | null {
  const externalId = str(pick(payload, 'entry_id', 'call_id', 'seq'))
  if (!externalId) return null

  // У Манго call_direction: 1 — входящий, 2 — исходящий.
  const directionRaw = int(pick(payload, 'call_direction', 'direction'))
  const direction = directionRaw === 2 ? 'outbound' : 'inbound'

  const from = str(pick(payload, 'from.number', 'from_number', 'from'))
  const to = str(pick(payload, 'to.number', 'to_number', 'to'))
  const disconnectReason = int(pick(payload, 'disconnect_reason'))
  const duration = int(pick(payload, 'talk_time', 'duration'))

  return {
    externalId,
    direction,
    counterpartyPhone: direction === 'inbound' ? from : to,
    fromNumber: from,
    toNumber: to,
    occurredAt: toIso(pick(payload, 'timestamp', 'create_time')),
    durationSec: duration,
    // disconnect_reason 1110 у Манго — «разговор состоялся»; надёжнее
    // ориентироваться на время разговора, оно есть у всех вариантов события.
    status: (duration ?? 0) > 0 || disconnectReason === 1110 ? 'answered' : 'missed',
    recordingUrl: str(pick(payload, 'recording_url', 'record_url')),
    agentExtension: str(pick(payload, 'to.extension', 'from.extension', 'extension')),
  }
}

function parseUis(payload: Record<string, unknown>): ParsedCall | null {
  const externalId = str(pick(payload, 'call_session_id', 'id', 'call_id'))
  if (!externalId) return null

  const directionRaw = str(pick(payload, 'direction'))?.toLowerCase()
  const direction = directionRaw === 'out' || directionRaw === 'outbound' ? 'outbound' : 'inbound'
  const counterparty = str(pick(payload, 'contact_phone_number', 'numa', 'caller_number'))
  const virtual = str(pick(payload, 'virtual_phone_number', 'called_number'))
  const duration = int(pick(payload, 'talk_duration', 'duration', 'total_duration'))

  // Массив записей разговора: берём первую — вторая появляется при переводах.
  const records = pick(payload, 'call_records')
  const recordingUrl = Array.isArray(records)
    ? str((records[0] as Record<string, unknown> | undefined)?.link ?? records[0])
    : str(records)

  return {
    externalId,
    direction,
    counterpartyPhone: counterparty,
    fromNumber: direction === 'inbound' ? counterparty : virtual,
    toNumber: direction === 'inbound' ? virtual : counterparty,
    occurredAt: toIso(pick(payload, 'start_time', 'finish_time', 'date_time')),
    durationSec: duration,
    status: (duration ?? 0) > 0 ? 'answered' : 'missed',
    recordingUrl,
    agentExtension: str(pick(payload, 'employee_id', 'employee.id')),
  }
}

function parseZadarma(payload: Record<string, unknown>): ParsedCall | null {
  const externalId = str(pick(payload, 'pbx_call_id', 'call_id_with_rec', 'call_id'))
  if (!externalId) return null

  const event = str(pick(payload, 'event')) ?? ''
  const direction = event.includes('OUT') ? 'outbound' : 'inbound'
  const caller = str(pick(payload, 'caller_id'))
  const called = str(pick(payload, 'called_did', 'destination', 'internal'))
  const duration = int(pick(payload, 'duration'))
  const disposition = str(pick(payload, 'disposition'))?.toLowerCase()

  const statusMap: Record<string, string> = {
    answered: 'answered',
    'no answer': 'missed',
    busy: 'busy',
    failed: 'failed',
    cancel: 'missed',
  }

  return {
    externalId,
    direction,
    counterpartyPhone: direction === 'inbound' ? caller : called,
    fromNumber: caller,
    toNumber: called,
    occurredAt: toIso(pick(payload, 'call_start')),
    durationSec: duration,
    status: (disposition && statusMap[disposition]) ?? ((duration ?? 0) > 0 ? 'answered' : 'missed'),
    recordingUrl: str(pick(payload, 'recording_url', 'call_id_with_rec_url')),
    agentExtension: str(pick(payload, 'internal')),
  }
}

/**
 * Простой формат для самописных интеграций:
 * { id, direction: 'inbound'|'outbound', phone, our_number, started_at,
 *   duration, status, recording_url, extension }
 */
function parseGeneric(payload: Record<string, unknown>): ParsedCall | null {
  const externalId = str(pick(payload, 'id', 'call_id', 'external_id'))
  if (!externalId) return null

  const direction = str(pick(payload, 'direction'))?.toLowerCase() === 'outbound' ? 'outbound' : 'inbound'
  const phone = str(pick(payload, 'phone', 'counterparty', 'client_phone'))
  const ourNumber = str(pick(payload, 'our_number', 'line'))
  const duration = int(pick(payload, 'duration', 'duration_sec'))

  return {
    externalId,
    direction,
    counterpartyPhone: phone,
    fromNumber: direction === 'inbound' ? phone : ourNumber,
    toNumber: direction === 'inbound' ? ourNumber : phone,
    occurredAt: toIso(pick(payload, 'started_at', 'timestamp', 'date')),
    durationSec: duration,
    status: str(pick(payload, 'status')) ?? ((duration ?? 0) > 0 ? 'answered' : 'missed'),
    recordingUrl: str(pick(payload, 'recording_url', 'record')),
    agentExtension: str(pick(payload, 'extension', 'agent')),
  }
}

export function parseTelephonyPayload(
  provider: string,
  payload: Record<string, unknown>
): ParsedCall | null {
  switch (provider) {
    case 'mango':
      return parseMango(payload)
    case 'uis':
      return parseUis(payload)
    case 'zadarma':
      return parseZadarma(payload)
    case 'generic':
      return parseGeneric(payload)
    default:
      return null
  }
}

/** Человекочитаемое описание звонка для ленты. */
export function describeCall(call: ParsedCall): string {
  const parts: string[] = []
  parts.push(call.direction === 'inbound' ? 'Входящий звонок' : 'Исходящий звонок')

  if (call.status === 'missed') parts.push('— пропущен')
  else if (call.status === 'busy') parts.push('— занято')
  else if (call.status === 'failed') parts.push('— не состоялся')
  else if (call.durationSec) {
    const minutes = Math.floor(call.durationSec / 60)
    const seconds = call.durationSec % 60
    parts.push(`— ${minutes > 0 ? `${minutes} мин ` : ''}${seconds} сек`)
  }

  return parts.join(' ')
}
