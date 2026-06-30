import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
  const keyHash = createHash('sha256').update(apiKey).digest('hex')

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
  const random = require('crypto').randomBytes(24).toString('hex')
  const plaintext = `hp_${random}`
  const hash = createHash('sha256').update(plaintext).digest('hex')
  const prefix = plaintext.slice(0, 10)
  return { plaintext, hash, prefix }
}
