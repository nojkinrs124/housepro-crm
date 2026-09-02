/**
 * Тонкий клиент к официальному API Авито (api.avito.ru).
 *
 * ВАЖНО про реальные возможности этого API (проверено живыми запросами
 * на аккаунт агентства 28.08.2026):
 * - OAuth2 client_credentials (/token) — работает, токен живёт 24 часа.
 * - core/v1/items — работает, отдаёт список и статус уже существующих объявлений
 *   (id, status, url, price...), НО не создаёт новые объявления — публичного
 *   эндпоинта "создать объявление" у Авито нет.
 * - autoload/v1/accounts/{id}/reports/... — на момент проверки отвечал 404
 *   ("This route is temporarily unavailable"). Публикация объектов реально
 *   происходит через XML-фид «Автозагрузки», который Авито сам периодически
 *   опрашивает — эндпоинты отчётов здесь дергаются "best effort": если Авито
 *   их не отдаёт, синхронизация статуса просто покажет это как ошибку, а не
 *   обвалит весь флоу.
 *
 * Ни один вызов отсюда не публикует объявление напрямую — публикация происходит
 * только через фид (см. src/app/api/avito/feed/[token]/route.ts), который Авито
 * вычитывает по расписанию, настроенному в личном кабинете пользователя.
 */

const AVITO_API_BASE = 'https://api.avito.ru'

export class AvitoApiError extends Error {
  constructor(message: string, public status?: number, public body?: unknown) {
    super(message)
    this.name = 'AvitoApiError'
  }
}

export interface AvitoTokenResult {
  accessToken: string
  expiresInSeconds: number
}

export async function fetchAvitoAccessToken(clientId: string, clientSecret: string): Promise<AvitoTokenResult> {
  const res = await fetch(`${AVITO_API_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
    cache: 'no-store',
  })

  const body = await res.json().catch(() => null)

  if (!res.ok || !body?.access_token) {
    throw new AvitoApiError(
      body?.error_description || body?.message || 'Не удалось получить токен Авито — проверьте client_id/client_secret',
      res.status,
      body
    )
  }

  return { accessToken: body.access_token as string, expiresInSeconds: Number(body.expires_in ?? 86400) }
}

export interface AvitoAutoloadReportItem {
  /** Наш внутренний id объекта — то же значение, что мы отдаём в <Id> в фиде. */
  adId?: string
  avitoItemId?: string
  status?: string
  error?: string
}

export interface AvitoAutoloadReport {
  found: boolean
  items: AvitoAutoloadReportItem[]
  raw?: unknown
}

/**
 * Пытается получить последний отчёт автозагрузки. Авито может отдавать 404,
 * если автозагрузка ещё ни разу не настраивалась/не запускалась на аккаунте —
 * это не ошибка нашего кода, а нормальное состояние "пока нечего показать".
 */
export async function fetchAvitoAutoloadLastReport(userId: string, accessToken: string): Promise<AvitoAutoloadReport> {
  const res = await fetch(`${AVITO_API_BASE}/autoload/v1/accounts/${userId}/reports/last_report/`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })

  if (!res.ok) {
    return { found: false, items: [] }
  }

  const body = await res.json().catch(() => null)
  if (!body) return { found: false, items: [] }

  // Формат ответа Авито для отчётов автозагрузки не зафиксирован публично —
  // разбираем защитно, перебирая правдоподобные варианты названий полей.
  const rawItems: unknown[] = Array.isArray(body?.items) ? body.items
    : Array.isArray(body?.report?.items) ? body.report.items
    : Array.isArray(body) ? body
    : []

  const items: AvitoAutoloadReportItem[] = rawItems.map((raw) => {
    const r = raw as Record<string, unknown>
    return {
      adId: (r.AdId ?? r.adId ?? r.ad_id ?? r.customId ?? r.custom_id) as string | undefined,
      avitoItemId: (r.AvitoId ?? r.avitoId ?? r.avito_id ?? r.itemId ?? r.item_id ?? r.id) as string | undefined,
      status: (r.Status ?? r.status) as string | undefined,
      error: (r.Error ?? r.error ?? r.errorMessage ?? r.error_message) as string | undefined,
    }
  })

  return { found: true, items, raw: body }
}

// ─────────────────────────────────────────────────────────────────────────────
// Мессенджер Авито
// ─────────────────────────────────────────────────────────────────────────────
// В отличие от публикации объявлений (её у API нет — только фид автозагрузки),
// мессенджер у Авито полноценный: чаты и сообщения читаются, ответ отправляется.
// Именно отсюда приходит основная часть лидов, и раньше они целиком оставались
// вне CRM — агент отвечал в приложении Авито, а в системе не оставалось следа.
//
// Требует scope messenger:read и messenger:write у приложения Авито.

export interface AvitoChat {
  id: string
  /** Идентификатор объявления, по которому пишет клиент. */
  itemId: string | null
  itemTitle: string | null
  itemUrl: string | null
  /** Имя собеседника, как его показывает Авито. */
  userName: string | null
  userId: string | null
  lastMessageText: string | null
  lastMessageAt: string | null
  unreadCount: number
}

export interface AvitoMessage {
  id: string
  chatId: string
  authorId: string | null
  /** true — сообщение написали мы. */
  isOutgoing: boolean
  text: string | null
  createdAt: string
}

function unixToIso(value: unknown): string {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return new Date().toISOString()
  return new Date(n > 1e12 ? n : n * 1000).toISOString()
}

/**
 * Список чатов аккаунта. unreadOnly=true отдаёт только чаты с непрочитанными
 * сообщениями — для крона это единственное, что нужно опрашивать.
 */
export async function fetchAvitoChats(
  userId: string,
  accessToken: string,
  opts?: { unreadOnly?: boolean; limit?: number }
): Promise<AvitoChat[]> {
  const params = new URLSearchParams({
    limit: String(opts?.limit ?? 50),
    ...(opts?.unreadOnly ? { unread_only: 'true' } : {}),
  })

  const res = await fetch(`${AVITO_API_BASE}/messenger/v2/accounts/${userId}/chats?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })

  const body = await res.json().catch(() => null)
  if (!res.ok) {
    throw new AvitoApiError(
      body?.error?.message ?? `Авито вернул ${res.status} на список чатов`,
      res.status,
      body
    )
  }

  const chats = Array.isArray(body?.chats) ? body.chats : []

  return chats.map((raw: Record<string, unknown>) => {
    const context = (raw.context ?? {}) as Record<string, unknown>
    const value = (context.value ?? {}) as Record<string, unknown>
    const lastMessage = (raw.last_message ?? {}) as Record<string, unknown>
    const content = (lastMessage.content ?? {}) as Record<string, unknown>
    // users содержит обе стороны; собеседник — тот, чей id не равен нашему.
    const users = Array.isArray(raw.users) ? (raw.users as Record<string, unknown>[]) : []
    const peer = users.find((u) => String(u.id) !== String(userId))

    return {
      id: String(raw.id ?? ''),
      itemId: value.id ? String(value.id) : null,
      itemTitle: value.title ? String(value.title) : null,
      itemUrl: value.url ? String(value.url) : null,
      userName: peer?.name ? String(peer.name) : null,
      userId: peer?.id ? String(peer.id) : null,
      lastMessageText: content.text ? String(content.text) : null,
      lastMessageAt: lastMessage.created ? unixToIso(lastMessage.created) : null,
      unreadCount: Number(raw.unread_count ?? 0),
    }
  })
}

/** Сообщения чата, свежие сверху (как их отдаёт Авито). */
export async function fetchAvitoMessages(
  userId: string,
  accessToken: string,
  chatId: string,
  limit = 30
): Promise<AvitoMessage[]> {
  const res = await fetch(
    `${AVITO_API_BASE}/messenger/v3/accounts/${userId}/chats/${chatId}/messages/?limit=${limit}`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' }
  )

  const body = await res.json().catch(() => null)
  if (!res.ok) {
    throw new AvitoApiError(
      body?.error?.message ?? `Авито вернул ${res.status} на сообщения чата`,
      res.status,
      body
    )
  }

  const messages = Array.isArray(body?.messages) ? body.messages : Array.isArray(body) ? body : []

  return messages.map((raw: Record<string, unknown>) => {
    const content = (raw.content ?? {}) as Record<string, unknown>
    return {
      id: String(raw.id ?? ''),
      chatId,
      authorId: raw.author_id ? String(raw.author_id) : null,
      isOutgoing: String(raw.author_id ?? '') === String(userId),
      text: content.text ? String(content.text) : null,
      createdAt: unixToIso(raw.created),
    }
  })
}

/** Помечает чат прочитанным, чтобы крон не забирал его снова и снова. */
export async function markAvitoChatRead(userId: string, accessToken: string, chatId: string): Promise<void> {
  await fetch(`${AVITO_API_BASE}/messenger/v1/accounts/${userId}/chats/${chatId}/read`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(() => {
    // Не критично: при сбое чат просто будет обработан ещё раз, а дедупликация
    // по external_id не даст задвоить сообщения в ленте.
  })
}
