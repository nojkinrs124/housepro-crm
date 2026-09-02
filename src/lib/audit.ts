import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { toJson } from '@/lib/json'

interface AuditParams {
  userId:      string
  orgId:       string
  action:      'create' | 'update' | 'delete'
  entityType:  string
  entityId:    string
  entityLabel: string
  changes?:    Record<string, { old: unknown; new: unknown }>
}

export async function writeAuditLog(params: AuditParams): Promise<void> {
  try {
    const supabase = await createClient()
    await supabase.from('audit_logs').insert({
      organization_id: params.orgId,
      user_id:         params.userId,
      action:          params.action,
      entity_type:     params.entityType,
      entity_id:       params.entityId,
      entity_label:    params.entityLabel,
      changes:         params.changes ? toJson(params.changes) : null,
    })
  } catch (e) {
    // Аудит не должен ломать основной флоу
    console.error('[audit] error:', e)
  }
}

interface AuditParamsServiceRole extends Omit<AuditParams, 'userId'> {
  // API-key запросы (бот и т.п.) не имеют cookie-сессии/user_id — пишем без него,
  // но помечаем источник действия в changes/entityLabel на стороне вызывающего кода.
  userId?: string
}

/**
 * Вариант writeAuditLog для роутов с авторизацией по API-ключу (Authorization: Bearer hp_...),
 * где нет cookie-сессии и обычный createClient()/auth.getUser() не работает.
 * Принимает готовый service-role клиент — вызывающий роут сам решает, как его получить.
 */
export async function writeAuditLogServiceRole(
  supabaseAdmin: SupabaseClient,
  params: AuditParamsServiceRole
): Promise<void> {
  try {
    await supabaseAdmin.from('audit_logs').insert({
      organization_id: params.orgId,
      user_id:         params.userId ?? null,
      action:          params.action,
      entity_type:     params.entityType,
      entity_id:       params.entityId,
      entity_label:    params.entityLabel,
      changes:         params.changes ?? null,
    })
  } catch (e) {
    console.error('[audit] service-role error:', e)
  }
}
