import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { requireOrgId } from '@/lib/org'
import { rateLimit } from '@/lib/rate-limit'
import { clientIp } from '@/lib/utils'

/**
 * Доступ к XML-фидам объектов (/api/export/*).
 *
 * До 22.10.2026 роуты отдавали опубликованные объекты любому, кто знал адрес:
 * middleware исключает весь /api, а внутри проверки не было. Сейчас два входа:
 *
 *  1. `?token=<32 hex>` — для робота площадки. Токен живёт в
 *     property_feed_tokens и выдаётся в интерфейсе (Настройки → Экспорт).
 *  2. Сессия CRM — для кнопки «Скачать» в том же интерфейсе.
 *
 * Организация берётся из токена или из сессии и подставляется в запрос явно:
 * service-role клиент RLS не соблюдает, поэтому фильтр по organization_id
 * обязателен в каждом роуте.
 */

export type FeedAccess =
  | { ok: true; orgId: string }
  | { ok: false; status: number; message: string }

const TOKEN_RE = /^[a-f0-9]{32}$/i

export async function resolveFeedAccess(request: Request, scope: string): Promise<FeedAccess> {
  // Фид опрашивают по расписанию; чаще тридцати раз в минуту с одного адреса
  // его не запрашивает ни одна площадка.
  const rl = await rateLimit(`feed:${scope}:${clientIp(request)}`, { limit: 30, windowSeconds: 60 })
  if (!rl.success) {
    return { ok: false, status: 429, message: 'Слишком много запросов' }
  }

  const token = new URL(request.url).searchParams.get('token')

  if (token) {
    if (!TOKEN_RE.test(token)) {
      return {
        ok: false,
        status: 401,
        message: 'Ссылка фида недействительна. Возьмите актуальную в CRM: Настройки → Экспорт объектов.',
      }
    }
    const { data } = await getSupabaseAdmin()
      .from('property_feed_tokens')
      .select('organization_id')
      .eq('token', token)
      .maybeSingle()

    if (!data) {
      return {
        ok: false,
        status: 401,
        message: 'Ссылка фида недействительна. Возьмите актуальную в CRM: Настройки → Экспорт объектов.',
      }
    }
    return { ok: true, orgId: data.organization_id }
  }

  // Без токена — только сотрудник организации из сессии.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return {
      ok: false,
      status: 401,
      message: 'Фид отдаётся по ссылке с токеном — она лежит в CRM: Настройки → Экспорт объектов.',
    }
  }

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) {
    return { ok: false, status: 403, message: 'Организация не найдена' }
  }
  return { ok: true, orgId }
}
