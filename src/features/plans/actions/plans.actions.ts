'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSessionContext } from '@/lib/org'
import { requirePermission } from '@/lib/permissions'
import { rateLimitMutation } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'
import { getChargeType } from '@/features/plans/config/settlement'
import { DIRECTION_VALUES } from '@/features/directions/config/directions'

type State = { error?: string } | undefined

/**
 * Код обязательства из его названия. Нужен, чтобы сравнивать наборы тарифов
 * между собой: «что есть в Премиуме сверх обычного Управления» — это разница
 * множеств кодов, а не текстов, которые правятся по вкусу.
 */
function obligationCode(title: string, index: number): string {
  const map: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
    й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
    у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
    э: 'e', ю: 'yu', я: 'ya',
  }
  const slug = title.toLowerCase().split('').map(ch => map[ch] ?? ch).join('')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40)
  return slug || `item_${index + 1}`
}

/** Обязательства вводятся построчно — так их правит человек, а не редактор списков. */
function parseObligations(raw: string): { code: string; title: string }[] {
  return raw.split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map((title, i) => ({ code: obligationCode(title, i), title }))
}

interface PlanFields {
  code: string
  title: string
  charge_type: string
  rate: number | null
  repair_limit: number | null
  obligations: { code: string; title: string }[]
  directions: string[]
  is_active: boolean
  sort_order: number
}

function readForm(formData: FormData): PlanFields {
  const rateRaw = (formData.get('rate') as string ?? '').trim()
  const limitRaw = (formData.get('repair_limit') as string ?? '').trim()
  return {
    code: ((formData.get('code') as string) ?? '').trim().toLowerCase(),
    title: ((formData.get('title') as string) ?? '').trim(),
    charge_type: ((formData.get('charge_type') as string) ?? '').trim(),
    rate: rateRaw === '' ? null : Number(rateRaw),
    repair_limit: limitRaw === '' ? null : Number(limitRaw),
    obligations: parseObligations((formData.get('obligations') as string) ?? ''),
    directions: formData.getAll('directions').map(String).filter(d => DIRECTION_VALUES.includes(d as never)),
    is_active: formData.get('is_active') === 'on',
    sort_order: Number(formData.get('sort_order') ?? 0) || 0,
  }
}

/**
 * Проверка полей тарифа. Сообщения называют, что именно поправить: тариф —
 * это способ считать деньги, и «ошибка валидации» здесь бесполезна.
 */
function validate(fields: PlanFields, { requireCode }: { requireCode: boolean }): string | null {
  if (requireCode && !fields.code) return 'Код тарифа обязателен — по нему на тариф ссылается остальная система'
  if (requireCode && !/^[a-z][a-z0-9_]*$/.test(fields.code)) {
    return 'Код тарифа — латиница в нижнем регистре, цифры и подчёркивание, начиная с буквы'
  }
  if (!fields.title) return 'Название тарифа обязательно'

  const charge = getChargeType(fields.charge_type)
  if (!charge) return 'Выберите способ начисления вознаграждения'

  if (charge.needsRate && fields.rate === null) {
    return `Для способа «${charge.label}» нужна ставка — без неё вознаграждение не посчитать`
  }
  if (fields.rate !== null && !Number.isFinite(fields.rate)) return 'Ставка должна быть числом'
  if (!charge.needsRate && fields.rate !== null) {
    return `Для способа «${charge.label}» ставка не задаётся — она согласуется в договоре`
  }
  if (
    fields.rate !== null &&
    (fields.charge_type === 'deal_percent' || fields.charge_type === 'monthly_percent') &&
    (fields.rate < 0 || fields.rate > 100)
  ) {
    return 'Процентная ставка должна быть от 0 до 100'
  }
  if (fields.repair_limit !== null && (!Number.isFinite(fields.repair_limit) || fields.repair_limit < 0)) {
    return 'Лимит расходов на мелкий ремонт должен быть неотрицательным числом'
  }
  if (fields.directions.length === 0) {
    return 'Укажите хотя бы одно направление, в котором применяется тариф'
  }
  return null
}

export async function createPlanAction(_prev: State, formData: FormData): Promise<State> {
  const session = await getSessionContext()
  if (!session.ok) return { error: session.error }
  const { supabase, user, orgId } = session

  const rl = await rateLimitMutation(user.id, 'plan')
  if (!rl.success) return { error: 'Слишком много запросов' }

  const permError = await requirePermission(user.id, 'settings', 'update')
  if (permError) return permError

  const fields = readForm(formData)
  const invalid = validate(fields, { requireCode: true })
  if (invalid) return { error: invalid }

  const { data, error } = await supabase
    .from('service_plans')
    .insert({ ...fields, organization_id: orgId })
    .select('id')
    .single()

  if (error) {
    return {
      error: error.code === '23505'
        ? `Тариф с кодом «${fields.code}» уже есть — выберите другой код`
        : error.message,
    }
  }

  await writeAuditLog({
    userId: user.id, orgId,
    action: 'create', entityType: 'service_plan',
    entityId: data.id, entityLabel: fields.title,
  })

  revalidatePath('/settings/plans')
  redirect('/settings/plans')
}

export async function updatePlanAction(_prev: State, formData: FormData): Promise<State> {
  const session = await getSessionContext()
  if (!session.ok) return { error: session.error }
  const { supabase, user, orgId } = session

  const id = (formData.get('id') as string) ?? ''
  if (!id) return { error: 'Тариф не найден' }

  const rl = await rateLimitMutation(user.id, 'plan')
  if (!rl.success) return { error: 'Слишком много запросов' }

  const permError = await requirePermission(user.id, 'settings', 'update')
  if (permError) return permError

  const fields = readForm(formData)
  const invalid = validate(fields, { requireCode: false })
  if (invalid) return { error: invalid }

  // Код тарифа не меняется: на него ссылаются заключённые договоры и код
  // приложения (defaultPlanCode направлений). Переименование кода превратило бы
  // ссылки в висячие, а данные — в загадку.
  const { code: _ignoredCode, ...editable } = fields

  const { error } = await supabase
    .from('service_plans')
    .update({ ...editable, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  await writeAuditLog({
    userId: user.id, orgId,
    action: 'update', entityType: 'service_plan',
    entityId: id, entityLabel: fields.title,
  })

  revalidatePath('/settings/plans')
  redirect('/settings/plans')
}

/**
 * Деактивация не трогает заключённые договоры: их ставка зафиксирована в
 * contracts.plan_rate, и расчёты по ним продолжают работать. Скрытый тариф
 * просто перестаёт предлагаться в новых договорах.
 */
export async function togglePlanActiveAction(id: string, isActive: boolean): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionContext()
  if (!session.ok) return { error: session.error }
  const { supabase, user, orgId } = session

  const permError = await requirePermission(user.id, 'settings', 'update')
  if (permError) return permError

  const { error } = await supabase
    .from('service_plans')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  await writeAuditLog({
    userId: user.id, orgId,
    action: 'update', entityType: 'service_plan',
    entityId: id, entityLabel: isActive ? 'Тариф включён' : 'Тариф скрыт',
  })

  revalidatePath('/settings/plans')
  return { success: true }
}
