'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireOrgId } from '@/lib/org'
import { generateApiKey } from '@/lib/api-auth'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' as const }

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Только администратор может управлять API ключами' as const }

  return { supabase, user }
}

export async function createApiKeyAction(formData: FormData) {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }
  const { supabase, user } = auth

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const name   = (formData.get('name') as string)?.trim()
  const scope  = formData.get('scope') as string
  if (!name) return { error: 'Укажите название ключа' }

  const scopes = scope === 'write' ? ['read', 'write'] : ['read']
  const { plaintext, hash, prefix } = generateApiKey()

  const { error } = await supabase.from('api_keys').insert({
    name, key_hash: hash, key_prefix: prefix, scopes,
    organization_id: orgId, created_by: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/settings/api')
  // Возвращаем plaintext только один раз — больше его нигде не сохраняем
  return { success: true, plaintext }
}

export async function revokeApiKeyAction(keyId: string) {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }
  const { supabase } = auth

  const { error } = await supabase.from('api_keys').update({ is_active: false }).eq('id', keyId)
  if (error) return { error: error.message }

  revalidatePath('/settings/api')
  return { success: true }
}

export async function deleteApiKeyAction(keyId: string) {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }
  const { supabase } = auth

  const { error } = await supabase.from('api_keys').delete().eq('id', keyId)
  if (error) return { error: error.message }

  revalidatePath('/settings/api')
  return { success: true }
}
