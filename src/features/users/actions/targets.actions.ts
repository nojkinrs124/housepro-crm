'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireOrgId } from '@/lib/org'
import { requirePermission } from '@/lib/permissions'
import { rateLimitMutation } from '@/lib/rate-limit'

export interface TargetResult {
  error?: string
  success?: boolean
}

function parseNumber(raw: FormDataEntryValue | null): number | null {
  if (raw === null) return null
  const value = String(raw).replace(/\s/g, '').replace(',', '.')
  if (value === '') return null
  const n = Number.parseFloat(value)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** Первое число месяца — ключ периода плана. */
function monthKey(raw: FormDataEntryValue | null): string {
  const value = String(raw ?? '').trim()
  const match = value.match(/^(\d{4})-(\d{2})$/)
  if (match) return `${match[1]}-${match[2]}-01`

  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

/**
 * Ставит сотруднику план на месяц.
 *
 * План хранится помесячно и не пересчитывается задним числом: если в марте
 * цель была 5 сделок, а в апреле её подняли, мартовский отчёт должен остаться
 * с мартовской цифрой.
 */
export async function saveEmployeeTargetAction(userId: string, formData: FormData): Promise<TargetResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const rl = await rateLimitMutation(user.id, 'employee_target')
  if (!rl.success) return { error: 'Слишком много запросов. Подождите минуту.' }

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  // Планы ставит руководитель, не сам сотрудник.
  const permError = await requirePermission(user.id, 'employees', 'update')
  if (permError) return { error: permError.error }

  const period = monthKey(formData.get('period_month'))
  const dealsTarget = parseNumber(formData.get('deals_target'))
  const revenueTarget = parseNumber(formData.get('revenue_target'))
  const commissionTarget = parseNumber(formData.get('commission_target'))

  if (dealsTarget === null && revenueTarget === null && commissionTarget === null) {
    return { error: 'Заполните хотя бы один показатель плана' }
  }

  const payload = {
    organization_id: orgId,
    user_id: userId,
    period_month: period,
    deals_target: dealsTarget,
    revenue_target: revenueTarget,
    commission_target: commissionTarget,
    note: (formData.get('note') as string)?.trim() || null,
    created_by: user.id,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('employee_targets')
    .upsert(payload, { onConflict: 'organization_id,user_id,period_month' })

  if (error) return { error: error.message }

  revalidatePath(`/employees/${userId}`)
  return { success: true }
}
