import { authenticateApiKey } from '@/lib/api-auth'

// Бот и крон-джобы работают от имени одной служебной организации, привязанной
// к HOUSEPRO_BOT_API_KEY (тот же паттерн, что уже используется в webhook route).
// Вынесено сюда, чтобы не дублировать в каждом новом cron route.
//
// Кеш в процессе: вызывается несколько раз за один Telegram-апдейт (resolveActor
// в webhook/route.ts плюс повторно из create_channel_post/get_channel_stats в
// tools.ts) — без кеша это лишние походы в api_keys и собственный рейт-лимит
// бота на каждое сообщение пользователя (аудит, фаза 1, п. 1.4). Организация
// бота не меняется в рантайме serverless-инстанса; TTL короткий не ради свежести
// данных, а чтобы ротация/деактивация HOUSEPRO_BOT_API_KEY не застряла навечно
// без передеплоя.
const CACHE_TTL_MS = 60_000
let cached: { value: string | null; expiresAt: number } | null = null

export async function resolveBotOrgId(): Promise<string | null> {
  const now = Date.now()
  if (cached && cached.expiresAt > now) return cached.value

  const key = process.env.HOUSEPRO_BOT_API_KEY
  if (!key) return null
  const fakeReq = new Request('http://internal.local/', { headers: { Authorization: `Bearer ${key}` } })
  const auth = await authenticateApiKey(fakeReq)
  const value = auth.orgId ?? null
  cached = { value, expiresAt: now + CACHE_TTL_MS }
  return value
}
