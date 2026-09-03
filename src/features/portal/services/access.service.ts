import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { PORTAL_COOKIE, readSessionCookie } from './session'

/**
 * Контур доступа личного кабинета.
 *
 * Отличается от остального приложения принципиально: собственник и арендатор
 * не члены организации, `get_user_org_id()` для них пуст, и RLS-политики
 * сотрудников их не пропускают. Поэтому данные читаются сервисным клиентом
 * (в обход RLS), а право видеть их проверяется здесь — по строке
 * `portal_access`.
 *
 * Из этого следуют два правила, нарушение которых означает утечку:
 *
 *  1. Идентификатор из адреса никогда не доверенный. Каждый запрос заново
 *     спрашивает: есть ли у этой сессии неотозванный доступ именно к этому
 *     объекту. Проверка «один раз при входе» не годится — доступ отзывают.
 *
 *  2. Ни один запрос кабинета не идёт мимо `scopeFor`. Если данные нужны без
 *     объекта в области видимости, значит они кабинету и не положены.
 */

export type PortalRole = 'owner' | 'tenant'

/**
 * Настроен ли кабинет вообще.
 *
 * Кабинет читает данные сервисным клиентом и подписывает сессию тем же
 * секретом, что и электронная подпись. Без любого из двух он не работает — и
 * без этой проверки посетитель получал бы голую пятисотку с текстом
 * «supabaseKey is required», по которой ничего не понять ни ему, ни менеджеру.
 */
export function isPortalConfigured(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.API_KEY_PEPPER)
}

export interface PortalScope {
  contactId: string
  phone: string
  /** Доступы, действующие прямо сейчас. */
  grants: {
    id: string
    role: PortalRole
    propertyId: string
    engagementId: string | null
    contractId: string | null
    organizationId: string
  }[]
}

/**
 * Текущая область видимости кабинета или null, если сессии нет.
 *
 * Доступы перечитываются на каждом запросе — именно это делает отзыв
 * мгновенным (FR-039).
 */
export async function currentScope(): Promise<PortalScope | null> {
  if (!isPortalConfigured()) return null

  const store = await cookies()
  const session = readSessionCookie(store.get(PORTAL_COOKIE)?.value)
  if (!session) return null

  const supabaseAdmin = getSupabaseAdmin()
  const { data } = await supabaseAdmin
    .from('portal_access')
    .select('id, role, property_id, engagement_id, contract_id, organization_id')
    .eq('contact_id', session.contactId)
    .is('revoked_at', null)

  const grants = (data ?? [])
    .filter(g => g.property_id !== null)
    .map(g => ({
      id: g.id,
      role: g.role as PortalRole,
      propertyId: g.property_id as string,
      engagementId: g.engagement_id,
      contractId: g.contract_id,
      organizationId: g.organization_id,
    }))

  // Все доступы отозваны — сессия ещё жива, но показывать нечего.
  if (grants.length === 0) return null

  return { contactId: session.contactId, phone: session.phone, grants }
}

/**
 * Доступ к конкретному объекту в нужной роли.
 *
 * Возвращает null, если доступа нет. Вызывающий обязан отдать 404 —
 * не 403: иначе перебором идентификаторов можно установить, какие объекты
 * существуют (FR-046).
 */
export async function grantFor(propertyId: string, role: PortalRole) {
  const scope = await currentScope()
  if (!scope) return null
  return scope.grants.find(g => g.propertyId === propertyId && g.role === role) ?? null
}

/** Есть ли у сессии хоть один доступ в этой роли. */
export async function hasRole(role: PortalRole): Promise<boolean> {
  const scope = await currentScope()
  return Boolean(scope?.grants.some(g => g.role === role))
}
