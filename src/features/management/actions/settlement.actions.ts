'use server'

import { revalidatePath } from 'next/cache'
import { getSessionContext } from '@/lib/org'
import { requirePermission } from '@/lib/permissions'
import { rateLimitMutation } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'
import { calcSettlement } from '@/features/management/services/settlement.service'
import {
  loadEngagementTerms,
  loadSettlementOperations,
  categoryIdByCode,
} from '@/features/management/data/settlement.data'

type Result = { error?: string; success?: boolean; warning?: string }

function str(v: FormDataEntryValue | null): string {
  return typeof v === 'string' ? v.trim() : ''
}

function num(v: FormDataEntryValue | null): number | null {
  const s = str(v).replace(/\s/g, '').replace(',', '.')
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/**
 * Поступление от арендатора.
 *
 * При процентной схеме сразу же порождает удержание агентства: обязательство
 * перед собственником рождается из этого платежа, и считать его отдельным
 * действием значило бы разрешить забыть.
 *
 * При фиксированной схеме удержания нет: обязательство перед собственником
 * возникает по календарю, а доход агентства — это разница, и отдельной
 * проводкой он не заводится.
 */
export async function registerTenantPaymentAction(formData: FormData): Promise<Result> {
  const ctx = await getSessionContext()
  if (!ctx.ok) return { error: ctx.error }
  const { supabase, user, orgId } = ctx

  const rl = await rateLimitMutation(user.id, 'settlement')
  if (!rl.success) return { error: 'Слишком много запросов' }

  const permError = await requirePermission(user.id, 'accounting', 'create')
  if (permError) return permError

  const engagementId = str(formData.get('engagement_id'))
  const amount = num(formData.get('amount'))
  const date = str(formData.get('date')) || new Date().toISOString().slice(0, 10)
  const periodStart = str(formData.get('period_start')) || null
  const periodEnd = str(formData.get('period_end')) || null

  if (!engagementId) return { error: 'Обслуживание не найдено' }
  if (amount === null || amount <= 0) return { error: 'Укажите сумму поступления' }

  const engagement = await loadEngagementTerms(supabase, engagementId)
  if (!engagement) return { error: 'Обслуживание не найдено' }
  if (!engagement.settlement_scheme) {
    return { error: 'Не выбрана схема расчёта — сначала заполните условия обслуживания' }
  }

  const tenantCategory = await categoryIdByCode(supabase, 'tenant_payment')

  const { error } = await supabase.from('accounting_transactions').insert({
    type: 'income',
    status: 'completed',
    amount,
    date,
    paid_at: new Date().toISOString(),
    period_start: periodStart,
    period_end: periodEnd,
    description: 'Поступление от арендатора',
    category_id: tenantCategory,
    engagement_id: engagementId,
    property_id: engagement.property_id,
    payment_method: str(formData.get('payment_method')) || 'bank',
    created_by: user.id,
    organization_id: orgId,
  })
  if (error) return { error: error.message }

  // Удержание агентства при процентной схеме — отдельной проводкой, чтобы в
  // бухгалтерии было видно, откуда взялся доход, а не только итоговое сальдо.
  if (engagement.settlement_scheme === 'percent') {
    const rate = Number(engagement.rate ?? 0)
    const fee = Math.round(amount * rate) / 100
    if (fee > 0) {
      const feeCategory = await categoryIdByCode(supabase, 'agency_fee')
      const { error: feeError } = await supabase.from('accounting_transactions').insert({
        type: 'income',
        status: 'completed',
        amount: fee,
        date,
        paid_at: new Date().toISOString(),
        period_start: periodStart,
        period_end: periodEnd,
        description: `Удержание агентства ${rate}% с платежа`,
        category_id: feeCategory,
        engagement_id: engagementId,
        property_id: engagement.property_id,
        created_by: user.id,
        organization_id: orgId,
      })
      if (feeError) return { error: `Платёж записан, но удержание агентства не проведено: ${feeError.message}` }
    }
  }

  await writeAuditLog({
    userId: user.id, orgId,
    action: 'create', entityType: 'settlement',
    entityId: engagementId, entityLabel: `Поступление ${amount} ₽`,
  })

  revalidatePath(`/management/${engagement.property_id}`)
  revalidatePath('/accounting')
  return { success: true }
}

/**
 * Выплата собственнику.
 *
 * Сумма сверх сальдо не запрещена наглухо — аванс бывает, — но требует
 * подтверждения: молча выплатить больше, чем причитается, значит потерять
 * след денег.
 */
export async function payOwnerAction(formData: FormData): Promise<Result> {
  const ctx = await getSessionContext()
  if (!ctx.ok) return { error: ctx.error }
  const { supabase, user, orgId } = ctx

  const permError = await requirePermission(user.id, 'accounting', 'create')
  if (permError) return permError

  const engagementId = str(formData.get('engagement_id'))
  const amount = num(formData.get('amount'))
  const date = str(formData.get('date')) || new Date().toISOString().slice(0, 10)
  const asAdvance = formData.get('as_advance') === 'on'

  if (!engagementId) return { error: 'Обслуживание не найдено' }
  if (amount === null || amount <= 0) return { error: 'Укажите сумму выплаты' }

  const engagement = await loadEngagementTerms(supabase, engagementId)
  if (!engagement) return { error: 'Обслуживание не найдено' }
  if (!engagement.owner_contact_id) {
    return { error: 'Не указан собственник — выплачивать некому. Заполните условия обслуживания' }
  }

  const operations = await loadSettlementOperations(supabase, engagementId)
  const settlement = calcSettlement(
    {
      scheme: engagement.settlement_scheme as 'percent' | 'fixed' | null,
      rate: engagement.rate,
      ownerFixedAmount: engagement.owner_fixed_amount,
      ownerPayoutDay: engagement.owner_payout_day,
      startedAt: engagement.started_at,
      endedAt: engagement.ended_at,
    },
    operations,
    date,
  )
  if (settlement.error) return { error: settlement.error }

  // Копейка допуска: сальдо считается с округлением до копеек, и точное
  // равенство здесь ловило бы ложные превышения.
  if (amount > settlement.balance + 0.01 && !asAdvance) {
    const over = Math.round((amount - settlement.balance) * 100) / 100
    return {
      error:
        `Сальдо с собственником — ${settlement.balance.toLocaleString('ru-RU')} ₽, ` +
        `выплата больше на ${over.toLocaleString('ru-RU')} ₽. ` +
        `Уменьшите сумму или отметьте, что это аванс.`,
    }
  }

  const payoutCategory = await categoryIdByCode(supabase, 'owner_payout')

  const { error } = await supabase.from('accounting_transactions').insert({
    type: 'expense',
    status: 'completed',
    amount,
    date,
    paid_at: new Date().toISOString(),
    period_start: str(formData.get('period_start')) || null,
    period_end: str(formData.get('period_end')) || null,
    description: asAdvance ? 'Выплата собственнику (аванс)' : 'Выплата собственнику',
    category_id: payoutCategory,
    engagement_id: engagementId,
    property_id: engagement.property_id,
    contact_id: engagement.owner_contact_id,
    payment_method: str(formData.get('payment_method')) || 'bank',
    created_by: user.id,
    organization_id: orgId,
  })
  if (error) return { error: error.message }

  await writeAuditLog({
    userId: user.id, orgId,
    action: 'create', entityType: 'settlement',
    entityId: engagementId, entityLabel: `Выплата собственнику ${amount} ₽`,
  })

  revalidatePath(`/management/${engagement.property_id}`)
  revalidatePath('/accounting')
  return { success: true }
}

/**
 * Расход по объекту.
 *
 * Лимит мелкого ремонта: превышение нельзя провести молча — оно либо
 * уменьшается, либо относится на собственника. Иначе агентство незаметно для
 * себя чинит за свой счёт больше, чем обещало по тарифу.
 */
export async function addExpenseAction(formData: FormData): Promise<Result> {
  const ctx = await getSessionContext()
  if (!ctx.ok) return { error: ctx.error }
  const { supabase, user, orgId } = ctx

  const permError = await requirePermission(user.id, 'accounting', 'create')
  if (permError) return permError

  const engagementId = str(formData.get('engagement_id'))
  const categoryCode = str(formData.get('category_code'))
  const amount = num(formData.get('amount'))
  const date = str(formData.get('date')) || new Date().toISOString().slice(0, 10)
  const borneBy = str(formData.get('borne_by')) === 'owner' ? 'owner' : 'agency'
  const description = str(formData.get('description'))

  if (!engagementId) return { error: 'Обслуживание не найдено' }
  if (!categoryCode) return { error: 'Выберите категорию расхода' }
  if (amount === null || amount <= 0) return { error: 'Укажите сумму расхода' }
  if (!description) return { error: 'Опишите расход — по одной сумме потом не вспомнить, за что платили' }

  const engagement = await loadEngagementTerms(supabase, engagementId)
  if (!engagement) return { error: 'Обслуживание не найдено' }

  // Лимит проверяется по календарному месяцу: тарифы обещают лимит «в месяц».
  if (categoryCode === 'repair_minor' && borneBy === 'agency' && engagement.repair_limit) {
    const monthStart = `${date.slice(0, 7)}-01`
    const { data: sameMonth } = await supabase
      .from('accounting_transactions')
      .select('amount, category:accounting_categories(code)')
      .eq('engagement_id', engagementId)
      .eq('type', 'expense')
      .eq('borne_by', 'agency')
      .gte('date', monthStart)
      .lte('date', date)

    const spent = (sameMonth ?? [])
      .filter(t => {
        const category = Array.isArray(t.category) ? t.category[0] : t.category
        return category?.code === 'repair_minor'
      })
      .reduce((sum, t) => sum + Number(t.amount || 0), 0)

    const limit = Number(engagement.repair_limit)
    if (spent + amount > limit) {
      const over = Math.round((spent + amount - limit) * 100) / 100
      return {
        error:
          `Лимит мелкого ремонта по тарифу — ${limit.toLocaleString('ru-RU')} ₽ в месяц, ` +
          `за этот месяц уже ${spent.toLocaleString('ru-RU')} ₽. ` +
          `Превышение ${over.toLocaleString('ru-RU')} ₽ нужно либо убрать из суммы, ` +
          `либо отнести на собственника.`,
      }
    }
  }

  const categoryId = await categoryIdByCode(supabase, categoryCode)

  const { error } = await supabase.from('accounting_transactions').insert({
    type: 'expense',
    status: 'completed',
    amount,
    date,
    paid_at: new Date().toISOString(),
    description,
    category_id: categoryId,
    engagement_id: engagementId,
    property_id: engagement.property_id,
    borne_by: borneBy,
    payment_method: str(formData.get('payment_method')) || 'bank',
    created_by: user.id,
    organization_id: orgId,
  })
  if (error) return { error: error.message }

  await writeAuditLog({
    userId: user.id, orgId,
    action: 'create', entityType: 'settlement',
    entityId: engagementId,
    entityLabel: `Расход ${amount} ₽ за счёт ${borneBy === 'owner' ? 'собственника' : 'агентства'}`,
  })

  revalidatePath(`/management/${engagement.property_id}`)
  revalidatePath('/accounting')
  return { success: true }
}
