/**
 * Простой rate limiter на основе in-memory Map.
 * Работает на single-instance (Vercel Serverless Function per region).
 * Для multi-instance production — заменить на Upstash Redis.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

interface RateLimitConfig {
  /** Максимум запросов за окно */
  limit: number
  /** Размер окна в секундах */
  windowSeconds: number
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
}

export function rateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now()
  const windowMs = config.windowSeconds * 1000

  const entry = store.get(key)

  // Окно истекло или запись новая
  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { success: true, remaining: config.limit - 1, resetAt: now + windowMs }
  }

  if (entry.count >= config.limit) {
    return { success: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return { success: true, remaining: config.limit - entry.count, resetAt: entry.resetAt }
}

// ─── Предустановленные лимиты ─────────────────────────────────────────────────

/** Мутации данных: 20 запросов в минуту на пользователя */
export function rateLimitMutation(userId: string, action: string): RateLimitResult {
  return rateLimit(`mutation:${userId}:${action}`, { limit: 20, windowSeconds: 60 })
}

/** Создание записей: 10 в минуту на пользователя (жёстче) */
export function rateLimitCreate(userId: string, entity: string): RateLimitResult {
  return rateLimit(`create:${userId}:${entity}`, { limit: 10, windowSeconds: 60 })
}

/** Поиск: 30 запросов в минуту */
export function rateLimitSearch(userId: string): RateLimitResult {
  return rateLimit(`search:${userId}`, { limit: 30, windowSeconds: 60 })
}
