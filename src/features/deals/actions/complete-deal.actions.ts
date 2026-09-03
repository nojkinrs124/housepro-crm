'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSessionContext } from '@/lib/org'
import { requirePermission } from '@/lib/permissions'
import { rateLimitMutation } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'
import { dispatchWebhook } from '@/lib/webhooks'
import { advanceDealStage } from '@/lib/deal-automation'
import {
  buildPaymentSchedule,
  type SchedulePeriodicity,
} from '@/features/accounting/services/payment-schedule.service'
import {
  calcCommission,
  contractTypeForDeal,
  needsSchedule,
  propertyStatusAfterDeal,
  taskTitleForContract,
} from '../services/deal-completion'

const VALID_PERIODICITY: SchedulePeriodicity[] = ['monthly', 'quarterly', 'semiannual', 'yearly', 'once']

function num(raw: FormDataEntryValue | null): number | null {
  if (raw === null) return null
  const v = String(raw).replace(/\s/g, '').replace(',', '.')
  if (v === '') return null
  const n = Number.parseFloat(v)
  return Number.isFinite(n) ? n : null
}

function str(raw: FormDataEntryValue | null): string | null {
  const v = typeof raw === 'string' ? raw.trim() : ''
  return v === '' ? null : v
}

export interface CompleteDealResult {
  error?: string
  /** Что реально создалось — показывается тостом после редиректа не успеет, поэтому в state */
  created?: string[]
}

/**
 * Оформление сделки одним действием: договор + график начислений + задача на
 * подписание + статус объекта + этап сделки.
 *
 * Порядок важен. Договор создаётся первым и единственный является
 * обязательным: если он не создался, дальше идти незачем. Остальные шаги
 * необязательные — сорвавшийся график не должен отменять уже созданный
 * договор, поэтому их ошибки собираются в результат, а не роняют всё.
 * Транзакции на несколько таблиц PostgREST не даёт, и «всё или ничего» здесь
 * означало бы ручную компенсацию — она опаснее, чем частично оформленная
 * сделка, которую видно в карточке.
 */
export async function completeDealAction(
  dealId: string,
  _prevState: unknown,
  formData: FormData
): Promise<CompleteDealResult> {
  const ctx = await getSessionContext()
  if (!ctx.ok) return { error: ctx.error }
  const { supabase, user, orgId } = ctx

  const rl = await rateLimitMutation(user.id, 'deal_complete')
  if (!rl.success) return { error: 'Слишком много запросов. Подождите минуту.' }

  const permError = await requirePermission(user.id, 'contracts', 'create')
  if (permError) return permError

  const { data: deal } = await supabase
    .from('deals')
    .select(`
      id, deal_type, status, amount, plan_id,
      owner_contact_id, client_contact_id,
      owner_representative_id, client_representative_id,
      property_id,
      property:properties(id, property_type, status)
    `)
    .eq('id', dealId)
    .maybeSingle()

  if (!deal) return { error: 'Сделка не найдена' }

  const property = deal.property as { id: string; property_type: string | null; status: string | null } | null
  const contractType = contractTypeForDeal(deal.deal_type, property?.property_type)

  if (!deal.owner_contact_id || !deal.client_contact_id) {
    return { error: 'В сделке указаны не обе стороны — договор подписывать не с кем' }
  }
  if (!deal.property_id && contractType !== 'agency_client') {
    return { error: 'В сделке не выбран объект' }
  }

  const startDate = str(formData.get('start_date'))
  const endDate = str(formData.get('end_date'))
  const amount = num(formData.get('amount'))
  const deposit = num(formData.get('deposit'))
  const contractNumber = str(formData.get('contract_number'))

  if (!startDate) return { error: 'Укажите дату начала договора' }

  const created: string[] = []

  // ─── 1. Договор ─────────────────────────────────────────────────────────
  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .insert({
      contract_type: contractType,
      contract_number: contractNumber,
      status: 'draft',
      deal_id: dealId,
      property_id: deal.property_id,
      owner_contact_id: deal.owner_contact_id,
      client_contact_id: deal.client_contact_id,
      owner_representative_id: deal.owner_representative_id,
      client_representative_id: deal.client_representative_id,
      start_date: startDate,
      end_date: endDate,
      amount,
      deposit,
      manager_id: user.id,
      organization_id: orgId,
    })
    .select('id, contract_number')
    .single()

  if (contractError || !contract) {
    return { error: `Не удалось создать договор: ${contractError?.message ?? 'неизвестная ошибка'}` }
  }
  created.push(`договор ${contract.contract_number ?? ''}`.trim())

  // ─── 2. График начислений ───────────────────────────────────────────────
  const withSchedule = formData.get('with_schedule') === 'on'
  if (withSchedule && needsSchedule(contractType)) {
    const periodicity = (formData.get('periodicity') as SchedulePeriodicity) ?? 'monthly'
    if (!VALID_PERIODICITY.includes(periodicity)) {
      return { error: `Недопустимая периодичность: ${periodicity}` }
    }

    const items = amount
      ? buildPaymentSchedule({
          startDate,
          endDate,
          amount,
          periodicity,
          dayOfMonth: null,
          depositAmount: formData.get('with_deposit') === 'on' ? deposit : null,
          prorateLastPeriod: false,
          indexationPercent: null,
          indexationPeriodMonths: null,
        })
      : []

    if (items.length > 0) {
      const today = new Date().toISOString().slice(0, 10)
      const { error: scheduleError } = await supabase.from('accounting_transactions').insert(
        items.map(item => ({
          type: 'income' as const,
          amount: item.amount,
          date: item.dueDate || today,
          due_date: item.dueDate,
          status: 'planned' as const,
          description: item.label,
          contract_id: contract.id,
          deal_id: dealId,
          property_id: deal.property_id,
          created_by: user.id,
          organization_id: orgId,
          schedule_seq: item.seq,
          period_start: item.periodStart,
          period_end: item.periodEnd,
        }))
      )
      if (!scheduleError) created.push(`${items.length} начислений`)
    }
  }

  // ─── 3. Задача на подписание ────────────────────────────────────────────
  if (formData.get('with_task') === 'on') {
    const { error: taskError } = await supabase.from('tasks').insert({
      title: str(formData.get('task_title')) ?? taskTitleForContract(contractType),
      status: 'todo',
      priority: 'high',
      deadline: str(formData.get('task_deadline')),
      assigned_to: user.id,
      created_by: user.id,
      deal_id: dealId,
      contract_id: contract.id,
      property_id: deal.property_id,
      contact_id: deal.client_contact_id,
      organization_id: orgId,
    })
    if (!taskError) created.push('задача на подписание')
  }

  // ─── 4. Статус объекта ──────────────────────────────────────────────────
  const nextPropertyStatus = propertyStatusAfterDeal(deal.deal_type)
  if (
    formData.get('with_property_status') === 'on' &&
    nextPropertyStatus &&
    deal.property_id &&
    property?.status !== nextPropertyStatus
  ) {
    const { error: propertyError } = await supabase
      .from('properties')
      .update({ status: nextPropertyStatus, updated_at: new Date().toISOString() })
      .eq('id', deal.property_id)
    if (!propertyError) {
      created.push(nextPropertyStatus === 'sold' ? 'объект помечен проданным' : 'объект помечен сданным')
    }
  }

  // ─── 5. Вознаграждение агентства ────────────────────────────────────────
  // Считается по тарифу работы, а не вводится руками: ставка уже зафиксирована,
  // и ручной ввод здесь означал бы третий источник правды о деньгах.
  if (formData.get('with_commission') === 'on') {
    const { data: plan } = deal.plan_id
      ? await supabase.from('service_plans').select('charge_type, rate, title').eq('id', deal.plan_id).maybeSingle()
      : { data: null }

    // «Первая сделка бесплатно» — по завершённым работам с этим собственником,
    // кроме текущей. Считаем ровно те стадии, которые означают доведённую работу.
    const { count: previousDeals } = deal.owner_contact_id
      ? await supabase.from('deals').select('id', { count: 'exact', head: true })
          .eq('owner_contact_id', deal.owner_contact_id)
          .in('status', ['completed', 'in_service'])
          .neq('id', dealId)
      : { count: 0 }

    // Вознаграждение, согласованное в агентском договоре: при подборе для
    // арендатора комиссия фиксируется до начала поиска, и повторный ввод её
    // при оформлении означал бы второй источник правды о деньгах.
    const { data: agencyContracts } = await supabase
      .from('contracts')
      .select('amount, contract_type, status')
      .eq('deal_id', dealId)
      .in('contract_type', ['agency_client', 'agency_legal_entity', 'agency_owner'])
      .in('status', ['generated', 'signed', 'completed'])
      .order('created_at', { ascending: false })
      .limit(1)

    const commission = calcCommission({
      chargeType: plan?.charge_type,
      rate: plan?.rate,
      dealAmount: amount ?? deal.amount,
      isFirstDealWithOwner: (previousDeals ?? 0) === 0,
      agreedFee: agencyContracts?.[0]?.amount ?? null,
    })

    if (commission.amount > 0) {
      const { error: feeError } = await supabase.from('accounting_transactions').insert({
        type: 'income',
        status: 'planned',
        amount: commission.amount,
        date: startDate,
        description: `Вознаграждение агентства${commission.basis ? ` — ${commission.basis}` : ''}`,
        deal_id: dealId,
        contract_id: contract.id,
        property_id: deal.property_id,
        contact_id: deal.owner_contact_id,
        created_by: user.id,
        organization_id: orgId,
      })
      if (!feeError) created.push(`комиссия ${commission.amount.toLocaleString('ru-RU')} ₽`)
    } else if (commission.waivedReason) {
      // Обнуление объясняется: пустая комиссия неотличима от забытой.
      created.push(`без комиссии (${commission.waivedReason.toLowerCase()})`)
    }
  }

  // ─── 6. Дополнительные услуги ───────────────────────────────────────────
  // Юрсопровождение и подобные идут отдельными строками, а не суммой к комиссии:
  // клиент должен видеть, за что именно платит, а мы — сколько заработали на чём.
  const extraPlanIds = formData.getAll('extra_services').map(String).filter(Boolean)
  if (extraPlanIds.length > 0) {
    const { data: extraPlans } = await supabase
      .from('service_plans')
      .select('id, title, rate, charge_type, is_active')
      .in('id', extraPlanIds)
      .eq('charge_type', 'flat_fee')
      .eq('is_active', true)

    const extraRows = (extraPlans ?? [])
      .filter(pl => pl.rate !== null && Number(pl.rate) > 0)
      .map(pl => ({
        type: 'income',
        status: 'planned',
        amount: Number(pl.rate),
        date: startDate,
        description: pl.title,
        deal_id: dealId,
        contract_id: contract.id,
        property_id: deal.property_id,
        contact_id: deal.client_contact_id,
        created_by: user.id,
        organization_id: orgId,
      }))

    if (extraRows.length > 0) {
      const { error: extraError } = await supabase.from('accounting_transactions').insert(extraRows)
      if (!extraError) {
        created.push(extraRows.length === 1
          ? `услуга «${extraRows[0].description}»`
          : `дополнительных услуг: ${extraRows.length}`)
      }
    }
  }

  // ─── 7. Стадия сделки ───────────────────────────────────────────────────
  // advanceDealStage двигает только вперёд и не трогает закрытые сделки.
  await advanceDealStage(supabase, dealId, 'contract')

  await writeAuditLog({
    userId: user.id,
    orgId,
    action: 'create',
    entityType: 'contract',
    entityId: contract.id,
    entityLabel: `Оформление сделки: ${created.join(', ')}`,
  })

  dispatchWebhook(orgId, 'contract.created', {
    id: contract.id, contract_type: contractType, amount,
  })

  revalidatePath('/contracts')
  revalidatePath('/deals')
  revalidatePath(`/deals/${dealId}`)
  revalidatePath('/accounting')
  if (deal.property_id) revalidatePath(`/properties/${deal.property_id}`)

  redirect(`/contracts/${contract.id}?created=${encodeURIComponent(created.join(' · '))}`)
}
