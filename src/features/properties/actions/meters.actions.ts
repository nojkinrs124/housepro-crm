'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireOrgId } from '@/lib/org'
import { requirePermission } from '@/lib/permissions'
import { rateLimitMutation } from '@/lib/rate-limit'

export interface MeterResult {
  error?: string
  success?: boolean
  message?: string
}

const METER_KINDS = ['electricity', 'cold_water', 'hot_water', 'gas', 'heating', 'other'] as const
type MeterKind = (typeof METER_KINDS)[number]

function parseNumber(raw: FormDataEntryValue | null): number | null {
  if (raw === null) return null
  const value = String(raw).replace(/\s/g, '').replace(',', '.')
  if (value === '') return null
  const n = Number.parseFloat(value)
  return Number.isFinite(n) ? n : null
}

/** Заводит счётчик на объекте. Счётчик привязан к объекту, а не к договору:
 *  он переживает смену арендатора, а история показаний должна быть сквозной. */
export async function createMeterAction(propertyId: string, formData: FormData): Promise<MeterResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const rl = await rateLimitMutation(user.id, 'meter_create')
  if (!rl.success) return { error: 'Слишком много запросов. Подождите минуту.' }

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const permError = await requirePermission(user.id, 'properties', 'update')
  if (permError) return { error: permError.error }

  const kind = (formData.get('kind') as MeterKind) ?? 'electricity'
  if (!METER_KINDS.includes(kind)) return { error: 'Неизвестный тип счётчика' }

  const { error } = await supabase.from('utility_meters').insert({
    organization_id: orgId,
    property_id: propertyId,
    kind,
    title: (formData.get('title') as string)?.trim() || null,
    serial_number: (formData.get('serial_number') as string)?.trim() || null,
    unit: (formData.get('unit') as string)?.trim() || 'кВт·ч',
    tariff: parseNumber(formData.get('tariff')),
  })

  if (error) return { error: error.message }

  revalidatePath(`/properties/${propertyId}`)
  return { success: true }
}

/**
 * Вносит показание. Расход и сумма считаются здесь и сохраняются в строку,
 * а не пересчитываются при показе: тариф со временем меняется, и пересчёт
 * задним числом исказил бы уже выставленные суммы.
 */
export async function addMeterReadingAction(
  meterId: string,
  propertyId: string,
  formData: FormData
): Promise<MeterResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const rl = await rateLimitMutation(user.id, 'meter_reading')
  if (!rl.success) return { error: 'Слишком много запросов. Подождите минуту.' }

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const permError = await requirePermission(user.id, 'properties', 'update')
  if (permError) return { error: permError.error }

  const value = parseNumber(formData.get('value'))
  if (value === null || value < 0) return { error: 'Введите показание счётчика' }

  const readingDate = (formData.get('reading_date') as string) || new Date().toISOString().slice(0, 10)

  const [{ data: meter }, { data: previous }] = await Promise.all([
    supabase.from('utility_meters').select('id, tariff, unit').eq('id', meterId).maybeSingle(),
    supabase
      .from('meter_readings')
      .select('value, reading_date')
      .eq('meter_id', meterId)
      .order('reading_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (!meter) return { error: 'Счётчик не найден' }

  if (previous && value < Number(previous.value)) {
    return {
      error: `Показание меньше предыдущего (${previous.value}). Проверьте цифру или заведите новый счётчик, если прибор менялся.`,
    }
  }

  const consumption = previous ? value - Number(previous.value) : null
  const tariff = meter.tariff === null || meter.tariff === undefined ? null : Number(meter.tariff)
  const amount = consumption !== null && tariff !== null ? Math.round(consumption * tariff * 100) / 100 : null

  const { error } = await supabase.from('meter_readings').insert({
    organization_id: orgId,
    meter_id: meterId,
    reading_date: readingDate,
    value,
    consumption,
    amount,
    note: (formData.get('note') as string)?.trim() || null,
    created_by: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath(`/properties/${propertyId}`)
  return {
    success: true,
    message:
      consumption !== null
        ? `Расход ${consumption} ${meter.unit}${amount !== null ? ` на ${amount.toLocaleString('ru-RU')} ₽` : ''}`
        : 'Первое показание сохранено — расход посчитается со следующего',
  }
}

/** Снимает счётчик с учёта. Показания остаются: это история объекта. */
export async function deactivateMeterAction(meterId: string, propertyId: string): Promise<MeterResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const permError = await requirePermission(user.id, 'properties', 'update')
  if (permError) return { error: permError.error }

  const { error } = await supabase.from('utility_meters').update({ is_active: false }).eq('id', meterId)
  if (error) return { error: error.message }

  revalidatePath(`/properties/${propertyId}`)
  return { success: true }
}
