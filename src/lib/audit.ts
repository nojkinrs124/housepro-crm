import { createClient } from '@/lib/supabase/server'

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
      changes:         params.changes ?? null,
    })
  } catch (e) {
    // Аудит не должен ломать основной флоу
    console.error('[audit] error:', e)
  }
}
