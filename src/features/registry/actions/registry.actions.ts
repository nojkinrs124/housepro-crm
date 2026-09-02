'use server'

import { revalidatePath } from 'next/cache'
import { getSessionContext } from '@/lib/org'
import { requirePermission } from '@/lib/permissions'
import { rateLimitMutation } from '@/lib/rate-limit'
import { writeAuditLogBatch } from '@/lib/audit'
import { bulkTable, type BulkPatch, type BulkRow } from '@/lib/supabase/bulk'
import { REGISTRIES, plural, type RegistryKey } from '@/features/registry/config/registries'

/**
 * Групповые действия над выделенными строками реестра — одни на все разделы.
 * Что за таблицей и какие у неё статусы, экшены узнают из REGISTRIES.
 */

const MAX_IDS = 100
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface BulkResult { error?: string; count?: number }

type Session = Extract<Awaited<ReturnType<typeof getSessionContext>>, { ok: true }>

async function prepare(
  key: RegistryKey,
  ids: string[],
  action: 'update' | 'delete',
): Promise<{ error: string } | { session: Session; rows: BulkRow[] }> {
  const def = REGISTRIES[key]
  if (!def) return { error: 'Неизвестный раздел' }

  if (ids.length === 0) return { error: 'Ничего не выбрано' }
  if (ids.length > MAX_IDS) return { error: `За раз можно изменить не больше ${MAX_IDS} записей` }
  if (!ids.every(id => UUID.test(id))) return { error: 'Некорректный идентификатор записи' }

  const session = await getSessionContext()
  if (!session.ok) return { error: session.error }

  const rl = await rateLimitMutation(session.user.id, `bulk:${key}`)
  if (!rl.success) return { error: 'Слишком много запросов' }

  const permError = await requirePermission(session.user.id, def.resource, action)
  if (permError) return permError

  // Читаем названия заранее: они нужны журналу аудита, а заодно запрос
  // отсекает чужие организации — RLS вернёт только свои строки.
  const { data, error } = await bulkTable(session.supabase, def.table)
    .select(`id, ${def.labelColumn}`)
    .in('id', ids)
    .eq('organization_id', session.orgId)

  if (error) return { error: error.message }
  const rows = data ?? []
  if (rows.length === 0) return { error: 'Записи не найдены' }

  return { session, rows }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T/

function labelOf(row: BulkRow, column: string, nouns: readonly [string, string, string]): string {
  const raw = row[column]
  if (raw === null || raw === undefined || raw === '') return `${nouns[0]} ${String(row.id).slice(0, 8)}`
  const value = String(raw)
  // У показов единственная колонка-название — время начала: в журнале она должна
  // читаться как «30.06.2026, 12:12», а не как ISO-строка.
  if (ISO_DATE.test(value)) return new Date(value).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
  return value
}

/** Групповая смена статуса или ответственного. */
export async function bulkUpdateAction(
  key: RegistryKey,
  ids: string[],
  patch: { status?: string; assignee?: string | null },
): Promise<BulkResult> {
  const def = REGISTRIES[key]
  const prepared = await prepare(key, ids, 'update')
  if ('error' in prepared) return prepared
  const { session, rows } = prepared

  const update: BulkPatch = {}
  const changes: Record<string, { old: unknown; new: unknown }> = {}

  if (patch.status !== undefined) {
    if (!def.statusColumn || !def.statuses) return { error: 'В этом разделе статус не меняется' }
    if (!def.statuses.some(s => s.value === patch.status)) return { error: 'Недопустимый статус' }
    update[def.statusColumn] = def.statusIsBoolean ? patch.status === 'true' : patch.status
    changes[def.statusColumn] = { old: null, new: update[def.statusColumn] }
  }

  if (patch.assignee !== undefined) {
    if (!def.assigneeColumn) return { error: 'В этом разделе ответственный не назначается' }
    if (patch.assignee !== null) {
      if (!UUID.test(patch.assignee)) return { error: 'Некорректный сотрудник' }
      const { data: employee } = await session.supabase
        .from('users')
        .select('id')
        .eq('id', patch.assignee)
        .eq('organization_id', session.orgId)
        .maybeSingle()
      if (!employee) return { error: 'Сотрудник не найден в организации' }
    }
    update[def.assigneeColumn] = patch.assignee
    changes[def.assigneeColumn] = { old: null, new: patch.assignee }
  }

  if (Object.keys(update).length === 0) return { error: 'Нечего менять' }

  const foundIds = rows.map(r => r.id)
  const { error } = await bulkTable(session.supabase, def.table)
    .update(update)
    .in('id', foundIds)
    .eq('organization_id', session.orgId)

  if (error) return { error: error.message }

  await writeAuditLogBatch(rows.map(row => ({
    userId: session.user.id,
    orgId: session.orgId,
    action: 'update' as const,
    entityType: def.table,
    entityId: row.id,
    entityLabel: labelOf(row, def.labelColumn, def.nouns),
    changes,
  })))

  revalidatePath(def.path)
  return { count: foundIds.length }
}

/** Групповое удаление. */
export async function bulkDeleteAction(key: RegistryKey, ids: string[]): Promise<BulkResult> {
  const def = REGISTRIES[key]
  if (def.deletable === false) {
    return { error: `Групповое удаление недоступно: ${def.nouns[1]} нельзя удалять пачкой` }
  }

  const prepared = await prepare(key, ids, 'delete')
  if ('error' in prepared) return prepared
  const { session, rows } = prepared

  const foundIds = rows.map(r => r.id)
  const { error } = await bulkTable(session.supabase, def.table)
    .delete()
    .in('id', foundIds)
    .eq('organization_id', session.orgId)

  if (error) return { error: error.message }

  await writeAuditLogBatch(rows.map(row => ({
    userId: session.user.id,
    orgId: session.orgId,
    action: 'delete' as const,
    entityType: def.table,
    entityId: row.id,
    entityLabel: labelOf(row, def.labelColumn, def.nouns),
  })))

  revalidatePath(def.path)
  return { count: foundIds.length }
}

/** Сотрудники организации — для выпадающего списка «Назначить ответственного». */
export async function listAssigneesAction(): Promise<{ id: string; full_name: string }[]> {
  const session = await getSessionContext()
  if (!session.ok) return []

  const { data } = await session.supabase
    .from('users')
    .select('id, full_name')
    .eq('organization_id', session.orgId)
    .eq('is_active', true)
    .order('full_name')

  return (data ?? []).map(u => ({ id: u.id, full_name: u.full_name ?? '—' }))
}

/** Текст подтверждения удаления — склонение живёт в одном месте. */
export async function bulkDeleteLabel(key: RegistryKey, count: number): Promise<string> {
  return plural(count, REGISTRIES[key].nouns)
}
