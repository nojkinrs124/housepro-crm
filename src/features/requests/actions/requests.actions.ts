'use server'

import { revalidatePath } from 'next/cache'
import { getSessionContext } from '@/lib/org'
import { requirePermission } from '@/lib/permissions'
import { writeAuditLog } from '@/lib/audit'
import { canTransition, REQUEST_STATUS_LABELS } from '@/features/portal/config/request-categories'

type Result = { error?: string; success?: boolean }

function str(v: FormDataEntryValue | null): string {
  return typeof v === 'string' ? v.trim() : ''
}

/**
 * Смена статуса заявки.
 *
 * Переходы ограничены: из выполненной и отклонённой возврата нет — иначе
 * история заявки перестаёт что-либо значить, а арендатор видит, как статус
 * прыгает туда-сюда. Отказ требует причины: молчание в лицо жильцу — это не
 * решение.
 */
export async function updateRequestStatusAction(formData: FormData): Promise<Result> {
  const ctx = await getSessionContext()
  if (!ctx.ok) return { error: ctx.error }
  const { supabase, user, orgId } = ctx

  const permError = await requirePermission(user.id, 'tasks', 'update')
  if (permError) return permError

  const id = str(formData.get('id'))
  const status = str(formData.get('status'))
  const rejectReason = str(formData.get('reject_reason'))

  if (!id) return { error: 'Заявка не найдена' }

  const { data: request } = await supabase
    .from('service_requests')
    .select('id, status, property_id, task_id')
    .eq('id', id)
    .maybeSingle()
  if (!request) return { error: 'Заявка не найдена' }

  if (!canTransition(request.status, status)) {
    return {
      error:
        `Из статуса «${REQUEST_STATUS_LABELS[request.status] ?? request.status}» ` +
        `нельзя перейти в «${REQUEST_STATUS_LABELS[status] ?? status}»`,
    }
  }
  if (status === 'rejected' && !rejectReason) {
    return { error: 'Укажите причину отказа — арендатор увидит её в кабинете' }
  }

  const closed = status === 'done' || status === 'rejected'

  const { error } = await supabase
    .from('service_requests')
    .update({
      status,
      reject_reason: status === 'rejected' ? rejectReason : null,
      closed_at: closed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: error.message }

  // Задача ответственного идёт следом: держать её открытой по выполненной
  // заявке значит копить мусор в списке дел.
  if (request.task_id && closed) {
    await supabase
      .from('tasks')
      .update({ status: status === 'done' ? 'done' : 'cancelled' })
      .eq('id', request.task_id)
  }

  await writeAuditLog({
    userId: user.id, orgId,
    action: 'update', entityType: 'service_request',
    entityId: id, entityLabel: `Заявка: ${REQUEST_STATUS_LABELS[status] ?? status}`,
  })

  revalidatePath('/requests')
  revalidatePath(`/cabinet/tenant/${request.property_id}`)
  return { success: true }
}

/**
 * Расход по выполненной заявке.
 *
 * Заводится отдельным действием, а не автоматически при закрытии: сумма
 * известна не всегда сразу, а расход за чей-то счёт — решение, которое
 * принимает человек. Попадает в отчёт собственнику и во взаиморасчёт (FR-045).
 */
export async function addRequestExpenseAction(formData: FormData): Promise<Result> {
  const ctx = await getSessionContext()
  if (!ctx.ok) return { error: ctx.error }
  const { supabase, user, orgId } = ctx

  const permError = await requirePermission(user.id, 'accounting', 'create')
  if (permError) return permError

  const id = str(formData.get('id'))
  const amountRaw = str(formData.get('amount')).replace(/\s/g, '').replace(',', '.')
  const amount = Number(amountRaw)
  const borneBy = str(formData.get('borne_by')) === 'owner' ? 'owner' : 'agency'
  const categoryCode = str(formData.get('category_code')) || 'contractor'

  if (!id) return { error: 'Заявка не найдена' }
  if (amountRaw === '' || !Number.isFinite(amount) || amount <= 0) {
    return { error: 'Укажите сумму расхода' }
  }

  const { data: request } = await supabase
    .from('service_requests')
    .select('id, property_id, engagement_id, description, transaction_id, status')
    .eq('id', id)
    .maybeSingle()
  if (!request) return { error: 'Заявка не найдена' }
  if (request.transaction_id) return { error: 'Расход по этой заявке уже заведён' }
  if (request.status !== 'done') {
    return { error: 'Расход заводится по выполненной заявке — сначала отметьте её выполненной' }
  }

  const { data: category } = await supabase
    .from('accounting_categories')
    .select('id')
    .eq('code', categoryCode)
    .maybeSingle()

  const { data: transaction, error } = await supabase
    .from('accounting_transactions')
    .insert({
      type: 'expense',
      status: 'completed',
      amount,
      date: new Date().toISOString().slice(0, 10),
      paid_at: new Date().toISOString(),
      description: `Заявка арендатора: ${request.description.slice(0, 120)}`,
      category_id: category?.id ?? null,
      engagement_id: request.engagement_id,
      property_id: request.property_id,
      borne_by: borneBy,
      created_by: user.id,
      organization_id: orgId,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  await supabase.from('service_requests').update({ transaction_id: transaction.id }).eq('id', id)

  await writeAuditLog({
    userId: user.id, orgId,
    action: 'create', entityType: 'service_request',
    entityId: id,
    entityLabel: `Расход по заявке ${amount} ₽ за счёт ${borneBy === 'owner' ? 'собственника' : 'агентства'}`,
  })

  revalidatePath('/requests')
  revalidatePath(`/management/${request.property_id}`)
  return { success: true }
}
