'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireOrgId } from '@/lib/org'
import { requirePermission } from '@/lib/permissions'
import { rateLimitMutation } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'
import {
  buildPaymentSchedule,
  scheduleTotal,
  type SchedulePeriodicity,
} from '@/features/accounting/services/payment-schedule.service'

const VALID_PERIODICITY: SchedulePeriodicity[] = ['monthly', 'quarterly', 'semiannual', 'yearly', 'once']

function parseNumber(raw: FormDataEntryValue | null): number | null {
  if (raw === null) return null
  const v = String(raw).replace(/\s/g, '').replace(',', '.')
  if (v === '') return null
  const n = Number.parseFloat(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Разворачивает договор в набор плановых начислений (accounting_transactions).
 *
 * До этого график вбивался руками: годовая аренда — это двенадцать одинаковых
 * форм «Добавить платёж», и любая опечатка в дате всплывала только при разборе
 * просрочек.
 *
 * Уже оплаченные строки не трогаются никогда — пересоздание сносит только
 * плановые (status='planned') строки, ранее сгенерированные этим же механизмом
 * (schedule_seq is not null). Ручные платежи остаются на месте.
 */
export async function generatePaymentScheduleAction(
  contractId: string,
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string; success?: boolean; message?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const rl = await rateLimitMutation(user.id, 'payment_schedule')
  if (!rl.success) return { error: 'Слишком много запросов. Подождите минуту.' }

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const permError = await requirePermission(user.id, 'accounting', 'create')
  if (permError) return permError

  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .select('id, contract_number, start_date, end_date, amount, deposit, deal_id, status, indexation_percent, indexation_period_months')
    .eq('id', contractId)
    .single()

  if (contractError || !contract) return { error: 'Договор не найден' }

  const periodicity = (formData.get('periodicity') as SchedulePeriodicity) ?? 'monthly'
  if (!VALID_PERIODICITY.includes(periodicity)) {
    return { error: `Недопустимая периодичность: ${periodicity}` }
  }

  const startDate = (formData.get('start_date') as string) || contract.start_date
  const endDate = (formData.get('end_date') as string) || contract.end_date
  const amount = parseNumber(formData.get('amount')) ?? Number(contract.amount ?? 0)
  const dayOfMonth = parseNumber(formData.get('day_of_month'))
  const depositAmount = formData.get('include_deposit')
    ? parseNumber(formData.get('deposit_amount')) ?? Number(contract.deposit ?? 0)
    : null
  // Пустое поле формы означает «взять условие из договора», а ноль там —
  // «индексации нет»: поэтому null и 0 схлопываем в null явно.
  const indexationPercent =
    parseNumber(formData.get('indexation_percent')) ?? (Number(contract.indexation_percent) || null)
  const indexationPeriodMonths =
    parseNumber(formData.get('indexation_period_months')) ??
    (Number(contract.indexation_period_months) || null)
  const prorateLastPeriod = formData.get('prorate') === 'on'
  const replaceExisting = formData.get('replace') === 'on'

  if (!startDate) return { error: 'У договора не заполнена дата начала — укажите её в карточке' }
  if (!amount || amount <= 0) return { error: 'Укажите сумму периодического платежа' }

  const items = buildPaymentSchedule({
    startDate,
    endDate,
    amount,
    periodicity,
    dayOfMonth: dayOfMonth ?? null,
    depositAmount,
    prorateLastPeriod,
    indexationPercent,
    indexationPeriodMonths,
  })

  if (items.length === 0) {
    return { error: 'График получился пустым — проверьте даты начала и окончания' }
  }

  // Что уже сгенерировано по этому договору.
  const { data: existing } = await supabase
    .from('accounting_transactions')
    .select('id, status')
    .eq('contract_id', contractId)
    .not('schedule_seq', 'is', null)

  const existingRows = existing ?? []
  if (existingRows.length > 0 && !replaceExisting) {
    return {
      error: `По договору уже есть график из ${existingRows.length} начислений. Отметьте «Пересоздать график», чтобы заменить неоплаченные строки.`,
    }
  }

  if (replaceExisting && existingRows.length > 0) {
    const removable = existingRows.filter((r) => r.status === 'planned').map((r) => r.id)
    if (removable.length > 0) {
      const { error: delError } = await supabase
        .from('accounting_transactions')
        .delete()
        .in('id', removable)
      if (delError) return { error: `Не удалось очистить старый график: ${delError.message}` }
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const rows = items.map((item) => ({
    type: 'income' as const,
    amount: item.amount,
    date: item.dueDate || today,
    due_date: item.dueDate,
    status: 'planned' as const,
    description: item.label,
    contract_id: contractId,
    deal_id: contract.deal_id ?? null,
    created_by: user.id,
    organization_id: orgId,
    schedule_seq: item.seq,
    period_start: item.periodStart,
    period_end: item.periodEnd,
  }))

  const { error: insertError } = await supabase.from('accounting_transactions').insert(rows)
  if (insertError) return { error: insertError.message }

  // Условие индексации запоминаем на договоре: при пересоздании графика
  // и при печати документов оно должно быть тем же, а не вводиться заново.
  if (indexationPercent && indexationPercent !== Number(contract.indexation_percent ?? 0)) {
    await supabase
      .from('contracts')
      .update({
        indexation_percent: indexationPercent,
        indexation_period_months: indexationPeriodMonths ?? 12,
      })
      .eq('id', contractId)
  }

  await writeAuditLog({
    userId: user.id,
    orgId,
    action: 'create',
    entityType: 'contract',
    entityId: contractId,
    entityLabel: `График платежей — договор ${contract.contract_number ?? ''}`.trim(),
    changes: {
      schedule: {
        old: existingRows.length ? `${existingRows.length} начислений` : null,
        new: `${items.length} начислений на ${scheduleTotal(items).toLocaleString('ru-RU')} ₽`,
      },
    },
  })

  revalidatePath(`/contracts/${contractId}`)
  revalidatePath('/accounting')

  return {
    success: true,
    message: `Создано ${items.length} начислений на ${scheduleTotal(items).toLocaleString('ru-RU')} ₽`,
  }
}

/** Удаляет только неоплаченные строки сгенерированного графика. */
export async function clearPaymentScheduleAction(contractId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const permError = await requirePermission(user.id, 'accounting', 'delete')
  if (permError) return permError

  const { error } = await supabase
    .from('accounting_transactions')
    .delete()
    .eq('contract_id', contractId)
    .eq('status', 'planned')
    .not('schedule_seq', 'is', null)

  if (error) return { error: error.message }

  revalidatePath(`/contracts/${contractId}`)
  revalidatePath('/accounting')
  return { success: true }
}
