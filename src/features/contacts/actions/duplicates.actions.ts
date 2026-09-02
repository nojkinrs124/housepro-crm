'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireOrgId } from '@/lib/org'
import { requirePermission } from '@/lib/permissions'
import { rateLimitMutation } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'
import { normalizePhone } from '@/lib/utils'

/**
 * Таблицы и колонки, которые ссылаются на contacts.id.
 *
 * Список получен из information_schema (все FK на contacts) — при добавлении
 * новой связи с контактом её ОБЯЗАТЕЛЬНО дописать сюда, иначе слияние оставит
 * «висячие» ссылки на удалённую карточку.
 */
const CONTACT_REFERENCES: { table: string; column: string }[] = [
  { table: 'deals', column: 'client_contact_id' },
  { table: 'deals', column: 'owner_contact_id' },
  { table: 'contracts', column: 'client_contact_id' },
  { table: 'contracts', column: 'owner_contact_id' },
  { table: 'showings', column: 'contact_id' },
  { table: 'accounting_transactions', column: 'contact_id' },
  { table: 'contact_representatives', column: 'contact_id' },
  { table: 'properties', column: 'owner_id' },
]

/**
 * Доступ к таблице, имя которой известно только в рантайме (см. CONTACT_REFERENCES).
 *
 * Сгенерированные типы схемы требуют литерал имени таблицы и колонки, а здесь и то,
 * и другое приходит из массива связей. Вместо приведения в каждом месте вызова —
 * одно здесь, с явным описанием тех двух операций, которые реально используются.
 * Форма ответа известна: массив объектов `{ [column]: uuid | null }`.
 */
type RefQuery = {
  select(columns: string): {
    in(column: string, values: string[]): PromiseLike<{ data: Record<string, string | null>[] | null }>
  }
  update(values: Record<string, string>): {
    in(column: string, values: string[]): PromiseLike<{ error: { message: string } | null }>
  }
}

function refTable(supabase: Awaited<ReturnType<typeof createClient>>, table: string): RefQuery {
  return supabase.from(table as never) as unknown as RefQuery
}

/** Поля, которые переносим из дубля в основную карточку, если там пусто. */
const MERGEABLE_FIELDS = [
  'phone', 'email', 'telegram', 'whatsapp', 'birth_date', 'notes', 'source',
  'company_name', 'inn', 'kpp', 'ogrn', 'legal_address',
  'bank_name', 'bank_account', 'corr_account', 'bik',
  'passport_series', 'passport_number', 'passport_issued_by', 'passport_issued_date',
  'registration_address',
] as const

export interface DuplicateGroup {
  /** По какому признаку записи сочли дублями. */
  reason: 'phone' | 'email'
  key: string
  contacts: {
    id: string
    full_name: string | null
    phone: string | null
    email: string | null
    role: string | null
    status: string | null
    created_at: string
    /** Сколько связей у карточки — по нему выбирается «главная». */
    links: number
  }[]
}

interface ContactRow {
  id: string
  full_name: string | null
  phone: string | null
  email: string | null
  role: string | null
  status: string | null
  created_at: string
}

/** Считает связи каждого контакта одним запросом на таблицу, а не N+1. */
async function countLinks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>(ids.map((id) => [id, 0]))
  if (ids.length === 0) return counts

  await Promise.all(
    CONTACT_REFERENCES.map(async ({ table, column }) => {
      const { data } = await refTable(supabase, table).select(column).in(column, ids)
      for (const row of data ?? []) {
        const value = row[column]
        if (value) counts.set(value, (counts.get(value) ?? 0) + 1)
      }
    })
  )

  return counts
}

/**
 * Ищет группы контактов-дублей по нормализованному телефону и по email.
 * Уже слитые карточки (merged_into не пуст) в выдачу не попадают.
 */
export async function findDuplicateContactsAction(): Promise<{ error?: string; groups?: DuplicateGroup[] }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const permError = await requirePermission(user.id, 'contacts', 'read')
  if (permError) return { error: permError.error }

  const { data, error } = await supabase
    .from('contacts')
    .select('id, full_name, phone, email, role, status, created_at, merged_into')
    .is('merged_into', null)
    .limit(5000)

  if (error) return { error: error.message }

  const rows = (data ?? []) as (ContactRow & { merged_into: string | null })[]

  const byPhone = new Map<string, ContactRow[]>()
  const byEmail = new Map<string, ContactRow[]>()

  for (const row of rows) {
    const phone = normalizePhone(row.phone)
    if (phone) {
      const list = byPhone.get(phone) ?? []
      list.push(row)
      byPhone.set(phone, list)
    }
    const email = row.email?.trim().toLowerCase()
    if (email) {
      const list = byEmail.get(email) ?? []
      list.push(row)
      byEmail.set(email, list)
    }
  }

  const rawGroups: { reason: 'phone' | 'email'; key: string; contacts: ContactRow[] }[] = []
  for (const [key, list] of byPhone) {
    if (list.length > 1) rawGroups.push({ reason: 'phone', key, contacts: list })
  }
  const phoneGrouped = new Set(rawGroups.flatMap((g) => g.contacts.map((c) => c.id)))
  for (const [key, list] of byEmail) {
    // Группу, уже найденную по телефону, вторым разом по почте не показываем.
    if (list.length > 1 && !list.every((c) => phoneGrouped.has(c.id))) {
      rawGroups.push({ reason: 'email', key, contacts: list })
    }
  }

  const allIds = [...new Set(rawGroups.flatMap((g) => g.contacts.map((c) => c.id)))]
  const links = await countLinks(supabase, allIds)

  const groups: DuplicateGroup[] = rawGroups
    .map((g) => ({
      reason: g.reason,
      key: g.key,
      contacts: g.contacts
        .map((c) => ({ ...c, links: links.get(c.id) ?? 0 }))
        // Наверху — карточка с наибольшим числом связей, при равенстве более старая:
        // именно её логично оставить главной.
        .sort((a, b) => b.links - a.links || a.created_at.localeCompare(b.created_at)),
    }))
    .sort((a, b) => b.contacts.length - a.contacts.length)

  return { groups }
}

/**
 * Сливает дубли в основную карточку: переносит недостающие поля, перепривязывает
 * все связи и помечает дубли merged_into.
 *
 * Дубли НЕ удаляются: старые ссылки (из аудита, писем, Telegram-сообщений)
 * продолжают вести на существующую запись, которая явно указывает на преемника.
 */
export interface MergeResult {
  error?: string
  success?: boolean
  merged?: number
}

export async function mergeContactsAction(
  primaryId: string,
  duplicateIds: string[]
): Promise<MergeResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const rl = await rateLimitMutation(user.id, 'contact_merge')
  if (!rl.success) return { error: 'Слишком много запросов. Подождите минуту.' }

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const permError = await requirePermission(user.id, 'contacts', 'update')
  if (permError) return permError

  const ids = duplicateIds.filter((id) => id && id !== primaryId)
  if (ids.length === 0) return { error: 'Не выбрано ни одного дубля' }

  const { data: contacts, error: loadError } = await supabase
    .from('contacts')
    .select('*')
    .in('id', [primaryId, ...ids])

  if (loadError) return { error: loadError.message }

  const primary = (contacts ?? []).find((c) => c.id === primaryId)
  const duplicates = (contacts ?? []).filter((c) => c.id !== primaryId)
  if (!primary) return { error: 'Основная карточка не найдена' }
  if (duplicates.length === 0) return { error: 'Дубли не найдены' }

  // 1. Дополняем основную карточку тем, чего в ней нет.
  const patch: Record<string, unknown> = {}
  for (const field of MERGEABLE_FIELDS) {
    const current = (primary as Record<string, unknown>)[field]
    if (current !== null && current !== undefined && current !== '') continue
    const donor = duplicates.find((d) => {
      const value = (d as Record<string, unknown>)[field]
      return value !== null && value !== undefined && value !== ''
    })
    if (donor) patch[field] = (donor as Record<string, unknown>)[field]
  }

  // Роль расширяется до 'both', если карточки играли разные роли — иначе
  // после слияния собственник внезапно перестал бы быть собственником.
  const roles = new Set([primary.role, ...duplicates.map((d) => d.role)].filter(Boolean))
  if (roles.size > 1 && (roles.has('client') || roles.has('owner'))) patch.role = 'both'

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase
      .from('contacts')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', primaryId)
    if (error) return { error: `Не удалось обновить основную карточку: ${error.message}` }
  }

  // 2. Перепривязываем связи.
  const relinkErrors: string[] = []
  for (const { table, column } of CONTACT_REFERENCES) {
    const { error } = await refTable(supabase, table)
      .update({ [column]: primaryId })
      .in(column, ids)
    if (error) relinkErrors.push(`${table}.${column}: ${error.message}`)
  }

  if (relinkErrors.length > 0) {
    // Частичная перепривязка хуже, чем никакой: останавливаемся до пометки дублей,
    // чтобы пользователь мог повторить операцию после устранения причины.
    return { error: `Не удалось перенести связи — ${relinkErrors[0]}` }
  }

  // 3. Помечаем дубли слитыми.
  const { error: markError } = await supabase
    .from('contacts')
    .update({ merged_into: primaryId, status: 'inactive', updated_at: new Date().toISOString() })
    .in('id', ids)

  if (markError) return { error: markError.message }

  await writeAuditLog({
    userId: user.id,
    orgId,
    action: 'update',
    entityType: 'contact',
    entityId: primaryId,
    entityLabel: primary.full_name ?? 'Контакт',
    changes: {
      merged: { old: null, new: `Слито карточек: ${ids.length} (${duplicates.map((d) => d.full_name).join(', ')})` },
    },
  })

  revalidatePath('/contacts')
  revalidatePath(`/contacts/${primaryId}`)
  revalidatePath('/contacts/duplicates')

  return { success: true, merged: ids.length }
}

/**
 * Ищет существующие карточки с тем же телефоном — вызывается формой создания
 * контакта до вставки, чтобы предупредить о дубле, а не плодить его молча.
 */
export async function findContactByPhoneAction(phone: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { matches: [] }

  const normalized = normalizePhone(phone)
  if (!normalized) return { matches: [] }

  const { data } = await supabase
    .from('contacts')
    .select('id, full_name, role, phone')
    .is('merged_into', null)
    .limit(200)

  const matches = (data ?? []).filter((c) => normalizePhone(c.phone) === normalized)
  return { matches }
}

/**
 * Ищет лидов с тем же телефоном. Повторное обращение того же человека —
 * обычное дело, и заводить на него второй лид не нужно: правильнее открыть
 * существующий и дописать активность.
 */
export async function findLeadsByPhoneAction(phone: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { matches: [] }

  const normalized = normalizePhone(phone)
  if (!normalized) return { matches: [] }

  const { data } = await supabase
    .from('leads')
    .select('id, full_name, status, phone')
    .order('created_at', { ascending: false })
    .limit(200)

  const matches = (data ?? []).filter(l => normalizePhone(l.phone) === normalized)
  return { matches }
}
