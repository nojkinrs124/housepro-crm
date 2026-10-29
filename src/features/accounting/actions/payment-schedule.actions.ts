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
import { chargeKindFor, insertCharges } from '@/features/accounting/services/charges'
import { isAgencyContract } from '@/features/deals/services/deal-completion'
import { categoryIdByCode } from '@/features/management/data/settlement.data'
import { todayIso } from '@/lib/timezone'

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
    .select('id, contract_number, contract_type, start_date, end_date, amount, deposit, deal_id, property_id, status, indexation_percent, indexation_period_months')
    .eq('id', contractId)
    .single()

  if (contractError || !contract) return { error: 'Договор не найден' }
  if (isAgencyContract(contract.contract_type)) {
    return { error: 'По агентскому договору график не строится — вознаграждение начисляется один раз кнопкой «Начислить вознаграждение»' }
  }

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

  // Залог, который уже поступил, второй раз в график не попадает: иначе он
  // висит плановым начислением и утренняя сводка просит оплатить то, что
  // оплачено (договор HP-2026-0013, 03.10.2026).
  const { data: receivedDeposit } = await supabase
    .from('accounting_transactions')
    .select('id')
    .eq('contract_id', contractId)
    .eq('type', 'income')
    .eq('status', 'completed')
    .ilike('description', '%депозит%')
    .limit(1)
  const depositAlreadyReceived = (receivedDeposit ?? []).length > 0

  const items = buildPaymentSchedule({
    startDate,
    endDate,
    amount,
    paymentLabel: contract.contract_type === 'property_management' ? 'Платёж арендатора'
      : contract.contract_type === 'sale' ? 'Платёж по договору' : 'Аренда',
    periodicity,
    dayOfMonth: dayOfMonth ?? null,
    depositAmount: depositAlreadyReceived ? null : depositAmount,
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

  // Начисления по графику — платежи арендатора: без объекта и категории они не
  // попадали ни в карточку объекта в управлении, ни во взаиморасчёт с
  // собственником (проход 17.09.2026, MG-8).
  //
  // Категория — только через charges.ts: залог там отдельный вид, иначе он
  // попадает в базу процента агентства (находка аудита 22.10.2026, P0-1).
  const { data: engagement } = contract.property_id
    ? await supabase
        .from('management_engagements')
        .select('id')
        .eq('property_id', contract.property_id)
        .is('ended_at', null)
        .maybeSingle()
    : { data: null }

  const { error: insertError } = await insertCharges(
    supabase,
    items.map((item) => ({
      kind: chargeKindFor(item.kind, contract.contract_type),
      amount: item.amount,
      label: item.label,
      dueDate: item.dueDate,
      seq: item.seq,
      periodStart: item.periodStart,
      periodEnd: item.periodEnd,
    })),
    {
      organizationId: orgId,
      createdBy: user.id,
      contractId,
      dealId: contract.deal_id ?? null,
      propertyId: contract.property_id ?? null,
      engagementId: engagement?.id ?? null,
    },
  )
  if (insertError) return { error: `Не удалось создать график: ${insertError}` }

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

/**
 * Агентский договор: одно начисление вознаграждения агентства вместо
 * помесячного графика. График по агентскому договору создавал 12 строк
 * «Аренда за …» на сумму вознаграждения (категория «Арендный платёж») —
 * в отчётах это выглядело как аренда, а ожидаемая сумма по сделке
 * раздувалась в десятки раз (QA 28.10.2026, A-08, A-20).
 *
 * Повторный вызов не создаёт второе начисление: вознаграждение по договору
 * одно, второе — это двойной доход в аналитике.
 */
export async function chargeAgencyFeeAction(
  contractId: string,
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

  const { data: contract } = await supabase
    .from('contracts')
    .select('id, contract_number, contract_type, start_date, amount, deal_id, property_id, owner_contact_id, client_contact_id')
    .eq('id', contractId)
    .maybeSingle()
  if (!contract) return { error: 'Договор не найден' }
  if (!isAgencyContract(contract.contract_type)) {
    return { error: 'Разовое вознаграждение начисляется только по агентскому договору' }
  }

  const amount = Number(contract.amount ?? 0)
  if (!(amount > 0)) {
    return { error: 'В договоре не указано вознаграждение — откройте «Редактировать» и заполните сумму' }
  }

  const feeCategoryId = await categoryIdByCode(supabase, 'agency_fee')
  const { data: existing } = await supabase
    .from('accounting_transactions')
    .select('id')
    .eq('contract_id', contractId)
    .eq('type', 'income')
    .eq('category_id', feeCategoryId ?? '')
    .neq('status', 'cancelled')
    .limit(1)
    .maybeSingle()
  if (existing) return { error: 'Вознаграждение по этому договору уже начислено — оно в списке платежей ниже' }

  const today = todayIso()
  const dueDate = contract.start_date && contract.start_date > today ? contract.start_date : today
  const { error } = await supabase.from('accounting_transactions').insert({
    type: 'income',
    status: 'planned',
    amount,
    date: dueDate,
    due_date: dueDate,
    category_id: feeCategoryId,
    description: `Вознаграждение агентства по договору ${contract.contract_number ?? ''}`.trim(),
    contract_id: contractId,
    deal_id: contract.deal_id,
    property_id: contract.property_id,
    contact_id: contract.owner_contact_id ?? contract.client_contact_id,
    created_by: user.id,
    organization_id: orgId,
  })
  if (error) return { error: 'Не удалось начислить вознаграждение. Обновите страницу и попробуйте ещё раз.' }

  await writeAuditLog({
    userId: user.id, orgId, action: 'create', entityType: 'contract', entityId: contractId,
    entityLabel: `Вознаграждение ${amount.toLocaleString('ru-RU')} ₽ — договор ${contract.contract_number ?? ''}`.trim(),
  })

  revalidatePath(`/contracts/${contractId}`)
  revalidatePath('/accounting')
  if (contract.deal_id) revalidatePath(`/deals/${contract.deal_id}`)
  return { success: true, message: `Начислено вознаграждение ${amount.toLocaleString('ru-RU')} ₽` }
}
