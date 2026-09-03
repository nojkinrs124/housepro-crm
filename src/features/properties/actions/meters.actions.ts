'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireOrgId } from '@/lib/org'
import { requirePermission } from '@/lib/permissions'
import { rateLimitMutation } from '@/lib/rate-limit'
import { computeConsumption, computeAmount, detectAnomalies } from '@/features/meters/services/anomalies'
import { METER_KINDS } from '@/features/meters/config/meter-kinds'

export interface MeterResult {
  error?: string
  success?: boolean
  message?: string
  /**
   * Аномалии показания: пропущенный месяц, скачок расхода. Записи не мешают —
   * данные настоящие, — но должны быть сказаны вслух, а не утонуть в истории.
   */
  warnings?: string[]
}

// Виды приборов — из общего справочника: тот же список нужен интерфейсу
// и проверке полноты акта приёма.
const METER_KIND_VALUES = METER_KINDS.map(k => k.value) as readonly string[]

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

  const kind = String(formData.get('kind') ?? 'electricity')
  if (!METER_KIND_VALUES.includes(kind)) return { error: 'Неизвестный тип счётчика' }

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

  // Показание из будущего снять нельзя. Раньше не проверялось, и дата с опечаткой
  // в году ломала расчёт расхода: следующее реальное показание оказывалось
  // «меньше предыдущего» и отклонялось.
  if (readingDate > new Date().toISOString().slice(0, 10)) {
    return { error: 'Дата показания в будущем — снять его ещё нельзя' }
  }

  // Кто внёс: менеджер снял сам или арендатор прислал из личного кабинета.
  // Данные, за которые отвечает агентство, и данные от жильца — разного веса.
  const source = (formData.get('source') as string) === 'tenant' ? 'tenant' : 'manager'

  // История нужна и для расхода, и для поиска аномалий — забираем разом,
  // а не двумя запросами.
  const [{ data: meter }, { data: history }] = await Promise.all([
    supabase.from('utility_meters').select('id, tariff, unit').eq('id', meterId).maybeSingle(),
    supabase
      .from('meter_readings')
      .select('value, reading_date')
      .eq('meter_id', meterId)
      .order('reading_date', { ascending: false })
      .limit(12),
  ])

  const readings = (history ?? []).map(r => ({ reading_date: r.reading_date, value: Number(r.value) }))
  const earlier = readings.filter(r => r.reading_date <= readingDate)
  const previous = earlier[0] ?? null

  if (!meter) return { error: 'Счётчик не найден' }

  if (previous && value < previous.value) {
    return {
      error: `Показание меньше предыдущего (${previous.value}). Проверьте цифру или заведите новый счётчик, если прибор менялся.`,
    }
  }

  const consumption = computeConsumption(previous?.value ?? null, value)
  const amount = computeAmount(consumption, meter.tariff)

  // Аномалии записи не мешают: данные настоящие, разбираться с ними человеку.
  // Пропущенный месяц уже не восстановить, а скачок может быть утечкой —
  // и то и другое должно быть сказано вслух, а не утонуть в истории.
  const anomalies = detectAnomalies({ reading_date: readingDate, value }, earlier)

  const { error } = await supabase.from('meter_readings').insert({
    organization_id: orgId,
    meter_id: meterId,
    reading_date: readingDate,
    value,
    consumption,
    amount,
    source,
    note: (formData.get('note') as string)?.trim() || null,
    created_by: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath(`/properties/${propertyId}`)
  // Счётчики показываются и на карточке объекта в управлении, и там же
  // проверяется полнота акта приёма.
  revalidatePath(`/management/${propertyId}`)
  return {
    success: true,
    message:
      consumption !== null
        ? `Расход ${consumption} ${meter.unit}${amount !== null ? ` на ${amount.toLocaleString('ru-RU')} ₽` : ''}`
        : 'Первое показание сохранено — расход посчитается со следующего',
    warnings: anomalies.map(a => a.message),
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
