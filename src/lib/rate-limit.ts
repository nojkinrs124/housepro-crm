/**
 * Rate limiter на Upstash Redis (sliding window) — работает корректно в serverless
 * (Vercel Functions), в отличие от in-memory Map, которая сбрасывается на каждый cold start
 * и не шарит состояние между инстансами.
 *
 * Локально/в CI без UPSTASH_REDIS_REST_URL и UPSTASH_REDIS_REST_TOKEN — падаем обратно
 * на in-memory реализацию (с предупреждением в консоль один раз), чтобы не требовать
 * Upstash для `npm run dev`/`npm run build`/тестов. В production переменные обязательны —
 * см. Vercel Dashboard → Environment Variables.
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
}

interface RateLimitConfig {
  /** Максимум запросов за окно */
  limit: number
  /** Размер окна в секундах */
  windowSeconds: number
}

// ─── Upstash Redis (production) ────────────────────────────────────────────

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

let redis: Redis | null = null
let warnedFallback = false

if (UPSTASH_URL && UPSTASH_TOKEN) {
  redis = new Redis({ url: UPSTASH_URL, token: UPSTASH_TOKEN })
}

// Кэш инстансов Ratelimit по (limit, windowSeconds) — не создавать заново на каждый вызов
const limiterCache = new Map<string, Ratelimit>()

function getLimiter(config: RateLimitConfig): Ratelimit {
  const cacheKey = `${config.limit}:${config.windowSeconds}`
  const cached = limiterCache.get(cacheKey)
  if (cached) return cached

  const limiter = new Ratelimit({
    redis: redis as Redis,
    limiter: Ratelimit.slidingWindow(config.limit, `${config.windowSeconds} s`),
    analytics: false,
    prefix: 'housepro-ratelimit',
  })
  limiterCache.set(cacheKey, limiter)
  return limiter
}

// ─── In-memory fallback (только dev/build без Upstash-ключей) ─────────────

interface RateLimitEntry {
  count: number
  resetAt: number
}

const memoryStore = new Map<string, RateLimitEntry>()

function rateLimitMemory(key: string, config: RateLimitConfig): RateLimitResult {
  if (!warnedFallback) {
    console.warn(
      '[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN не заданы — используется in-memory ' +
      'fallback (НЕ для production: сбрасывается на каждый cold start и не работает между инстансами).'
    )
    warnedFallback = true
  }

  const now = Date.now()
  const windowMs = config.windowSeconds * 1000
  const entry = memoryStore.get(key)

  if (!entry || entry.resetAt < now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs })
    return { success: true, remaining: config.limit - 1, resetAt: now + windowMs }
  }

  if (entry.count >= config.limit) {
    return { success: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return { success: true, remaining: config.limit - entry.count, resetAt: entry.resetAt }
}

// ─── Публичный API ──────────────────────────────────────────────────────────

export async function rateLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
  if (!redis) {
    return rateLimitMemory(key, config)
  }

  const limiter = getLimiter(config)
  const { success, remaining, reset } = await limiter.limit(key)
  return { success, remaining, resetAt: reset }
}

// ─── Предустановленные лимиты ─────────────────────────────────────────────────

/** Мутации данных: 20 запросов в минуту на пользователя */
export async function rateLimitMutation(userId: string, action: string): Promise<RateLimitResult> {
  return rateLimit(`mutation:${userId}:${action}`, { limit: 20, windowSeconds: 60 })
}

/** Создание записей: 10 в минуту на пользователя (жёстче) */
export async function rateLimitCreate(userId: string, entity: string): Promise<RateLimitResult> {
  return rateLimit(`create:${userId}:${entity}`, { limit: 10, windowSeconds: 60 })
}

/** Поиск: 30 запросов в минуту */
export async function rateLimitSearch(userId: string): Promise<RateLimitResult> {
  return rateLimit(`search:${userId}`, { limit: 30, windowSeconds: 60 })
}
