import { createClient } from '@supabase/supabase-js'
import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { rateLimit } from '@/lib/rate-limit'

// API-ключи (hp_<48 hex>, 192 бита энтропии) хешируются HMAC-SHA256 с
// server-side pepper, а не голым SHA-256. Ключи — не пароли (их нельзя
// перебрать по словарю), поэтому bcrypt/argon2 здесь не нужен и вреден
// для латентности на каждый API-запрос; HMAC с секретом закрывает
// единственный реальный риск — offline-подбор по утёкшей таблице hash'ей
// без знания API_KEY_PEPPER.
function hashApiKey(key: string): string {
  const pepper = process.env.API_KEY_PEPPER
  if (!pepper) throw new Error('API_KEY_PEPPER is not set')
  return createHmac('sha256', pepper).update(key).digest('hex')
}

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    // no-store: этот клиент на service role (обходит RLS) — кэширование его
    // ответов на уровне Next.js Data Cache means one org's data could be
    // served to another org's request on a matching URL. Недопустимо.
    { global: { fetch: (url, options = {}) => fetch(url, { ...options, cache: 'no-store' }) } }
  )
}

/**
 * Кто из людей дёрнул API через бота — для записи аудита.
 *
 * У бота один ключ на всех (`HOUSEPRO_BOT_API_KEY`), поэтому «изменено через
 * Telegram-бота» не отвечает на вопрос «кто именно». Бот присылает
 * `X-Bot-Requester: tg:<id>:<@username>`; заголовок ИНФОРМАЦИОННЫЙ — права
 * по-прежнему даёт только API-ключ и роль внутри бота (canUseTool), поэтому
 * подделка заголовка ничего не расширяет и не удаляет содержимое.
 */
export function botRequesterLabel(request: Request): string | null {
  const raw = request.headers.get('x-bot-requester')?.trim()
  if (!raw) return null
  const parts = raw.split(':')
  if (parts[0] !== 'tg') return null
  const id = parts[1]?.trim()
  const who = parts.slice(2).join(':').trim()
  if (!id) return null
  return who ? `Telegram ${who} (id ${id})` : `Telegram id ${id}`
}

export interface ApiAuthResult {
  orgId?:  string
  scopes?: string[]
  error?:  string
  status?: number
}

/**
 * Собственный ключ бота (`HOUSEPRO_BOT_API_KEY`, см. `lib/telegram/org.ts`) —
 * внутренний трафик CRM, а не внешняя интеграция; у него отдельный бюджет лимита.
 * Сравнение константным временем — ключ приходит в заголовке Authorization,
 * как и обычный hp_-ключ, и не должен давать канал для таймингового угадывания.
 */
function isBotApiKey(apiKey: string): boolean {
  const botKey = process.env.HOUSEPRO_BOT_API_KEY
  if (!botKey) return false
  const a = Buffer.from(apiKey)
  const b = Buffer.from(botKey)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function authenticateApiKey(request: Request): Promise<ApiAuthResult> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer hp_')) {
    return { error: 'Invalid API key format. Expected: Authorization: Bearer ***', status: 401 }
  }

  const apiKey  = authHeader.replace('Bearer ', '')
  const keyHash = hashApiKey(apiKey)
  const supabaseAdmin = getSupabaseAdmin()

  const { data: key } = await supabaseAdmin
    .from('api_keys')
    .select('organization_id, scopes, is_active, expires_at')
    .eq('key_hash', keyHash)
    .single()

  if (!key || !key.is_active) {
    return { error: 'Invalid API key', status: 401 }
  }

  if (key.expires_at && new Date(key.expires_at) < new Date()) {
    return { error: 'API key expired', status: 401 }
  }

  // Ограничение частоты — здесь, а не в каждом роуте /api/v1/*: это единственная
  // точка, через которую внешний API вообще проходит, и её нельзя забыть добавить
  // в новом роуте. Считаем по организации, а не по ключу: ключей у неё может быть
  // несколько, а защищаем мы базу, а не ключ. Роуты уже отдают auth.error со своим
  // статусом — 429 доезжает до клиента без правок в них.
  //
  // Внутренний трафик бота (HOUSEPRO_BOT_API_KEY, см. lib/telegram/org.ts, tools.ts)
  // ходит через тот же authenticateApiKey несколько раз на одно сообщение
  // (resolveActor → resolveBotOrgId, читающие/мутирующие tool'ы) и раньше делил
  // с внешними интеграциями организации один лимит 120/мин — поток собственного
  // бота мог упереть организацию в 429 на реальных внешних вызовах (аудит, фаза 1,
  // п. 1.4). У бота свой бюджет и свой ключ Redis, не пересекающийся с api:{orgId}.
  const isInternalBotTraffic = isBotApiKey(apiKey)
  const rl = isInternalBotTraffic
    ? await rateLimit(`internal-bot:${key.organization_id}`, { limit: 300, windowSeconds: 60 })
    : await rateLimit(`api:${key.organization_id}`, { limit: 120, windowSeconds: 60 })
  if (!rl.success) {
    return {
      error: isInternalBotTraffic
        ? 'Too many internal bot requests. Limit: 300 requests per minute.'
        : 'Too many requests. Limit: 120 requests per minute.',
      status: 429,
    }
  }

  // Fire-and-forget last_used_at update
  supabaseAdmin
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('key_hash', keyHash)
    .then(() => {})

  return { orgId: key.organization_id, scopes: key.scopes }
}

export function hasScope(scopes: string[] | undefined, required: 'read' | 'write'): boolean {
  if (!scopes) return false
  if (required === 'read') return scopes.includes('read') || scopes.includes('write')
  return scopes.includes('write')
}

/**
 * Генерирует новый API ключ: hp_<32 random hex chars>
 * Возвращает оба значения — plaintext (показать один раз пользователю) и hash (сохранить в БД)
 */
export function generateApiKey(): { plaintext: string; hash: string; prefix: string } {
  const random = randomBytes(24).toString('hex')
  const plaintext = `hp_${random}`
  const hash = hashApiKey(plaintext)
  const prefix = plaintext.slice(0, 10)
  return { plaintext, hash, prefix }
}
