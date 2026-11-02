// Кто ведёт диалог в чате Авито — бот или человек.
//
// Проблема: клиент пишет в мессенджер Авито, бот отвечает. Но владелец отвечает
// и сам — из приложения Авито, с того же аккаунта агентства. Для API Авито эти
// два случая неотличимы: у любого исходящего сообщения author_id = аккаунт
// агентства (см. avito-api.service.ts → fetchAvitoMessages), а признака «это
// отправил бот» в ответе мессенджера нет вовсе. В результате бот продолжал
// отвечать клиенту поверх живого диалога человека — в чате звучали два голоса,
// и последнее слово оставалось не всегда за человеком.
//
// Отличаем свои сообщения по собственной записи: отправляя ответ, бот пишет его
// в ленту общения с external_id `avito-bot:<chatId>:<messageId>`, где
// messageId — id из ответа Авито (sendAvitoMessage). На следующем опросе любое
// исходящее сообщение чата, которое не помечено так, написал человек.
//
// Отдельной таблицы «бот на паузе» не нужно: состояние выводится из ленты
// общения при каждом прогоне, поэтому разъехаться с реальностью ему негде.
// Окно (по умолчанию сутки) — после него человек считается закончившим диалог,
// и бот снова подхватывает вернувшегося клиента. Значение меняется переменной
// окружения AVITO_TAKEOVER_WINDOW_HOURS, пересборка не нужна.
//
// Файл чистый: ни Supabase, ни fetch — чтобы правила проверялись тестами без базы.

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { AvitoMessage } from './avito-api.service'

/** Префикс external_id сообщений, которые отправил бот: `avito-bot:<chatId>:<messageId>`. */
export const BOT_MESSAGE_PREFIX = 'avito-bot:'

/** Префикс события «бот передал диалог человеку»: `avito-escalated:<chatId>:<ts>`. */
export const BOT_ESCALATION_PREFIX = 'avito-escalated:'

/**
 * Формат до 02.11.2026: `bot-<chatId>-<ts>`, где ts — время отправки, а не id
 * сообщения Авито. По id такие записи сопоставить нельзя, поэтому свои старые
 * ответы узнаём по телу сообщения. Нужно только на период перехода.
 */
const LEGACY_BOT_PREFIX = 'bot-'

/** Сколько диалог считается «человеческим» после последнего ответа человека. */
export const DEFAULT_TAKEOVER_WINDOW_MINUTES = 24 * 60

export function botMessageExternalId(chatId: string, messageId: string): string {
  return `${BOT_MESSAGE_PREFIX}${chatId}:${messageId}`
}

export function escalationExternalId(chatId: string, timestamp = Date.now()): string {
  return `${BOT_ESCALATION_PREFIX}${chatId}:${timestamp}`
}

export function takeoverWindowMinutes(): number {
  const raw = Number(process.env.AVITO_TAKEOVER_WINDOW_HOURS)
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_TAKEOVER_WINDOW_MINUTES
  return raw * 60
}

export interface BotAuthoredIndex {
  /** id сообщений Авито, которые отправил бот. */
  ids: Set<string>
  /** Тексты ответов бота в старом формате — id у них не настоящие. */
  bodies: Set<string>
  /** Когда бот последний раз передавал диалог человеку. */
  escalatedAt: Date | null
}

export interface CommunicationRow {
  external_id: string | null
  body: string | null
  occurred_at: string | null
}

/**
 * Разбирает записи ленты общения этого чата и собирает из них признаки
 * «это писал бот». Записи других чатов и входящие сообщения игнорируются.
 */
export function buildBotAuthoredIndex(rows: CommunicationRow[], chatId: string): BotAuthoredIndex {
  const ids = new Set<string>()
  const bodies = new Set<string>()
  let escalatedAt: Date | null = null

  const messagePrefix = `${BOT_MESSAGE_PREFIX}${chatId}:`
  const legacyPrefix = `${LEGACY_BOT_PREFIX}${chatId}-`
  const escalationPrefix = `${BOT_ESCALATION_PREFIX}${chatId}:`

  for (const row of rows) {
    const externalId = row.external_id ?? ''

    if (externalId.startsWith(messagePrefix)) {
      const messageId = externalId.slice(messagePrefix.length)
      if (messageId) ids.add(messageId)
      continue
    }
    if (externalId.startsWith(legacyPrefix)) {
      if (row.body) bodies.add(row.body)
      continue
    }
    if (externalId.startsWith(escalationPrefix) && row.occurred_at) {
      const at = new Date(row.occurred_at)
      if (Number.isFinite(at.getTime()) && (!escalatedAt || at > escalatedAt)) escalatedAt = at
    }
  }

  return { ids, bodies, escalatedAt }
}

/** Сообщение написал бот (а не человек с того же аккаунта). */
export function isBotAuthored(message: AvitoMessage, index: BotAuthoredIndex): boolean {
  if (index.ids.has(message.id)) return true
  // Старые ответы бота: id в ленте не совпадает с id Авито, узнаём по тексту.
  return Boolean(message.text) && index.bodies.has(message.text as string)
}

/** Последнее исходящее сообщение, которое написал человек. */
export function lastHumanMessage(messages: AvitoMessage[], index: BotAuthoredIndex): AvitoMessage | null {
  const outgoing = messages
    .filter((m) => m.isOutgoing && m.text)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))

  for (let i = outgoing.length - 1; i >= 0; i--) {
    if (!isBotAuthored(outgoing[i], index)) return outgoing[i]
  }
  return null
}

export type TakeoverReason = 'human' | 'escalated'

export interface TakeoverDecision {
  /** true — бот молчит: диалог ведёт человек. */
  silent: boolean
  reason: TakeoverReason | null
  /** Когда человек последний раз отвечал в этом чате (ISO), если это его диалог. */
  since: string | null
}

/**
 * Решение «отвечать или промолчать» на новое входящее сообщение клиента.
 *
 * Молчим, если человек отвечал в этом чате не позже окна (`windowMs`) назад —
 * значит диалог живой и ведёт его человек. Передача диалога человеку самим ботом
 * (`escalate_to_human`) считается так же: клиенту сказали «подключится
 * сотрудник», и бот не должен тут же отвечать вместо него.
 */
export function decideTakeover(params: {
  messages: AvitoMessage[]
  index: BotAuthoredIndex
  windowMs: number
  now?: Date
}): TakeoverDecision {
  const now = params.now ?? new Date()
  const human = lastHumanMessage(params.messages, params.index)

  if (human) {
    const at = new Date(human.createdAt)
    if (Number.isFinite(at.getTime()) && now.getTime() - at.getTime() <= params.windowMs) {
      return { silent: true, reason: 'human', since: at.toISOString() }
    }
  }

  const escalatedAt = params.index.escalatedAt
  if (escalatedAt && now.getTime() - escalatedAt.getTime() <= params.windowMs) {
    return { silent: true, reason: 'escalated', since: escalatedAt.toISOString() }
  }

  return { silent: false, reason: null, since: null }
}

/**
 * Читает ленту общения лида и собирает признаки ботовых сообщений этого чата.
 * 200 записей достаточно: дальше окна в сутки дело всё равно не идёт.
 */
export async function loadBotAuthoredIndex(leadId: string, chatId: string): Promise<BotAuthoredIndex> {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('communications')
    .select('external_id, body, occurred_at')
    .eq('lead_id', leadId)
    .eq('channel', 'avito')
    .not('external_id', 'is', null)
    .order('occurred_at', { ascending: false })
    .limit(200)

  return buildBotAuthoredIndex((data ?? []) as CommunicationRow[], chatId)
}
