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

export interface AvitoItemStatus {
  status?: string
  url?: string
  startTime?: string
  finishTime?: string
}

/** Статус конкретного (уже опубликованного) объявления по его числовому id в Авито. */
export async function fetchAvitoItemStatus(userId: string, accessToken: string, avitoItemId: string): Promise<AvitoItemStatus | null> {
  const res = await fetch(`${AVITO_API_BASE}/core/v1/accounts/${userId}/items/${avitoItemId}/`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })
  if (!res.ok) return null
  const body = await res.json().catch(() => null)
  if (!body) return null
  return {
    status: body.status,
    url: body.url,
    startTime: body.start_time,
    finishTime: body.finish_time,
  }
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
