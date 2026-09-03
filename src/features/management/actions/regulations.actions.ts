'use server'

import { revalidatePath } from 'next/cache'
import { getSessionContext } from '@/lib/org'
import { requirePermission } from '@/lib/permissions'
import { writeAuditLog } from '@/lib/audit'

type Result = { error?: string; success?: boolean }

const PERIODS = ['monthly', 'quarterly', 'semiannual', 'annual', 'on_event']
const PRIORITIES = ['low', 'medium', 'high']

function str(v: FormDataEntryValue | null): string {
  return typeof v === 'string' ? v.trim() : ''
}

function intOrNull(v: FormDataEntryValue | null): number | null {
  const s = str(v)
  if (s === '') return null
  const n = Number(s)
  return Number.isInteger(n) ? n : null
}

/**
 * Заведение или правка правила регламента.
 *
 * Правило принадлежит тарифу: именно так различаются «Управление» и
 * «Управление Премиум» — у премиума проверки чаще, и это разница в
 * обязательствах, а не в тексте на сайте.
 */
export async function saveRegulationAction(formData: FormData): Promise<Result> {
  const ctx = await getSessionContext()
  if (!ctx.ok) return { error: ctx.error }
  const { supabase, user, orgId } = ctx

  const permError = await requirePermission(user.id, 'settings', 'update')
  if (permError) return permError

  const id = str(formData.get('id'))
  const planId = str(formData.get('plan_id'))
  const code = str(formData.get('code')).toLowerCase()
  const title = str(formData.get('title'))
  const period = str(formData.get('period'))
  const priority = str(formData.get('priority')) || 'medium'
  const dayOfMonth = intOrNull(formData.get('day_of_month'))
  const leadDays = intOrNull(formData.get('lead_days')) ?? 0

  if (!planId) return { error: 'Не выбран тариф' }
  if (!title) return { error: 'Название правила обязательно — оно станет заголовком задачи' }
  if (!PERIODS.includes(period)) return { error: 'Выберите периодичность' }
  if (!PRIORITIES.includes(priority)) return { error: 'Неизвестный приоритет' }

  if (!id) {
    if (!code) return { error: 'Код правила обязателен — по нему ищутся уже созданные задачи' }
    if (!/^[a-z][a-z0-9_]*$/.test(code)) {
      return { error: 'Код правила — латиница в нижнем регистре, цифры и подчёркивание, начиная с буквы' }
    }
  }

  // Периодическое правило без дня месяца не знает, когда наступает срок.
  if (period !== 'on_event' && dayOfMonth === null) {
    return { error: 'Укажите день месяца — иначе непонятно, когда наступает срок' }
  }
  if (dayOfMonth !== null && (dayOfMonth < 1 || dayOfMonth > 28)) {
    return { error: 'День месяца — от 1 до 28: 29-е и позже есть не в каждом месяце' }
  }
  if (leadDays < 0 || leadDays > 90) {
    return { error: 'Заранее — от 0 до 90 дней' }
  }

  const fields = {
    plan_id: planId,
    title,
    description: str(formData.get('description')) || null,
    period,
    // У правила по событию дня месяца нет: срок берётся из данных.
    day_of_month: period === 'on_event' ? null : dayOfMonth,
    lead_days: leadDays,
    priority,
    is_active: formData.get('is_active') === 'on',
    sort_order: intOrNull(formData.get('sort_order')) ?? 0,
    updated_at: new Date().toISOString(),
  }

  const { error } = id
    ? await supabase.from('management_regulations').update(fields).eq('id', id)
    : await supabase.from('management_regulations').insert({ ...fields, code, organization_id: orgId })

  if (error) {
    return {
      error: error.code === '23505'
        ? `Правило с кодом «${code}» у этого тарифа уже есть`
        : error.message,
    }
  }

  await writeAuditLog({
    userId: user.id, orgId,
    action: id ? 'update' : 'create', entityType: 'management_regulation',
    entityId: id || code, entityLabel: title,
  })

  revalidatePath(`/settings/plans/${planId}/regulations`)
  return { success: true }
}

/**
 * Удаление правила.
 *
 * Уже созданные по нему задачи остаются: это история обслуживания, и стирать
 * её из-за изменения регламента нельзя.
 */
export async function deleteRegulationAction(id: string): Promise<Result> {
  const ctx = await getSessionContext()
  if (!ctx.ok) return { error: ctx.error }
  const { supabase, user, orgId } = ctx

  const permError = await requirePermission(user.id, 'settings', 'update')
  if (permError) return permError

  const { data: regulation } = await supabase
    .from('management_regulations')
    .select('plan_id, title')
    .eq('id', id)
    .maybeSingle()

  const { error } = await supabase.from('management_regulations').delete().eq('id', id)
  if (error) return { error: error.message }

  await writeAuditLog({
    userId: user.id, orgId,
    action: 'delete', entityType: 'management_regulation',
    entityId: id, entityLabel: regulation?.title ?? 'Правило регламента',
  })

  if (regulation?.plan_id) revalidatePath(`/settings/plans/${regulation.plan_id}/regulations`)
  return { success: true }
}
