import { createClient } from '@/lib/supabase/server'

/**
 * Получает org_id текущего пользователя из JWT access token.
 * JWT hook должен добавлять org_id в claims (Phase 1).
 * Фолбэк: запрос к organization_members если claim отсутствует.
 */
export async function getOrgId(): Promise<string | null> {
  const supabase = await createClient()

  // Пробуем получить из JWT claim (после настройки JWT hook)
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (session?.access_token) {
    try {
      const payload = JSON.parse(
        Buffer.from(session.access_token.split('.')[1], 'base64').toString()
      )
      if (payload?.org_id) return payload.org_id as string
    } catch {
      // fallback ниже
    }
  }

  // Фолбэк: прямой запрос к БД
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .single()

  return data?.organization_id ?? null
}

export async function requireOrgId(): Promise<string> {
  const orgId = await getOrgId()
  if (!orgId) throw new Error('Organization not found')
  return orgId
}
