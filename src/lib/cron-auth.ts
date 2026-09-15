import { timingSafeEqual } from 'node:crypto'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

// Авторизация кронов, которые дёргает pg_cron из Supabase (channel-heartbeat,
// avito-messenger). Секрет для них сгенерирован в самой БД и лежит в Vault под именем
// channel_cron_secret (миграция 20260915_pg_cron_secret_selfcontained) — так его не
// нужно вручную переносить между Vercel и Supabase. CRON_SECRET из окружения Vercel
// принимается по-прежнему: для ручного вызова и остальных кронов из vercel.json.

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

function bearerOf(request: Request): string | null {
  const auth = request.headers.get('authorization')
  return auth?.startsWith('Bearer ') ? auth.slice('Bearer '.length) : null
}

/** Секрет pg_cron из Vault; null — если функция или секрет ещё не заведены. */
async function getPgCronSecret(): Promise<string | null> {
  const { data, error } = await getSupabaseAdmin().rpc('get_pg_cron_secret')
  if (error) {
    console.error('[cron-auth] get_pg_cron_secret:', error.message)
    return null
  }
  return typeof data === 'string' && data.length > 0 ? data : null
}

export async function isCronAuthorized(request: Request): Promise<boolean> {
  const bearer = bearerOf(request)
  const envSecret = process.env.CRON_SECRET
  if (envSecret) {
    const querySecret = new URL(request.url).searchParams.get('secret')
    if (bearer && safeEqual(bearer, envSecret)) return true
    if (querySecret && safeEqual(querySecret, envSecret)) return true
  }
  if (!bearer) return false
  const pgSecret = await getPgCronSecret()
  return !!pgSecret && safeEqual(bearer, pgSecret)
}
