import { createClient } from '@supabase/supabase-js'
import { createHmac, randomBytes } from 'crypto'

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

export interface ApiAuthResult {
  orgId?:  string
  scopes?: string[]
  error?:  string
  status?: number
}

export async function authenticateApiKey(request: Request): Promise<ApiAuthResult> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer hp_')) {
    return { error: 'Invalid API key format. Expected: Authorization: Bearer hp_...', status: 401 }
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
