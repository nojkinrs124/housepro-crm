'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'
import { grantFor } from '@/features/portal/services/access.service'
import { computeConsumption, computeAmount } from '@/features/meters/services/anomalies'

type Result = { error?: string; success?: boolean; message?: string }

/**
 * Показание, внесённое арендатором из кабинета.
 *
 * Отдельно от экшена CRM, потому что проверка прав другая: у арендатора нет
 * учётки сотрудника, и право писать даёт строка `portal_access` на объект
 * этого счётчика. Идентификатор счётчика из формы не доверенный — сначала
 * выясняем, какому объекту он принадлежит, и только потом проверяем доступ.
 *
 * Пишется с пометкой источника `tenant`: данные от жильца и данные, за которые
 * отвечает агентство, — разного веса (FR-042).
 */
export async function submitTenantReadingAction(formData: FormData): Promise<Result> {
  const meterId = typeof formData.get('meter_id') === 'string' ? String(formData.get('meter_id')).trim() : ''
  const valueRaw = typeof formData.get('value') === 'string' ? String(formData.get('value')).trim() : ''

  if (!meterId) return { error: 'Не выбран счётчик' }

  const value = Number(valueRaw.replace(/\s/g, '').replace(',', '.'))
  if (valueRaw === '' || !Number.isFinite(value) || value < 0) {
    return { error: 'Показание должно быть неотрицательным числом' }
  }

  const supabaseAdmin = getSupabaseAdmin()
  const { data: meter } = await supabaseAdmin
    .from('utility_meters')
    .select('id, property_id, tariff, unit, organization_id, is_active')
    .eq('id', meterId)
    .maybeSingle()

  // Счётчик не найден или неактивен — отвечаем одинаково: по различию можно
  // выяснить, какие счётчики существуют.
  if (!meter || !meter.is_active) return { error: 'Счётчик недоступен' }

  const grant = await grantFor(meter.property_id, 'tenant')
  if (!grant) return { error: 'Счётчик недоступен' }

  const limited = await rateLimit(`portal:reading:${grant.propertyId}`, { limit: 10, windowSeconds: 3600 })
  if (!limited.success) {
    return { error: 'Слишком много показаний за час. Попробуйте позже.' }
  }

  const today = new Date().toISOString().slice(0, 10)

  const { data: previous } = await supabaseAdmin
    .from('meter_readings')
    .select('value, reading_date')
    .eq('meter_id', meterId)
    .lte('reading_date', today)
    .order('reading_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (previous && value < Number(previous.value)) {
    return {
      error:
        `Показание меньше предыдущего (${previous.value}). Проверьте цифру — ` +
        `если счётчик меняли, сообщите менеджеру: замену отмечает он.`,
    }
  }

  const consumption = computeConsumption(previous ? Number(previous.value) : null, value)
  const amount = computeAmount(consumption, meter.tariff)

  const { error } = await supabaseAdmin.from('meter_readings').insert({
    organization_id: meter.organization_id,
    meter_id: meterId,
    reading_date: today,
    value,
    consumption,
    amount,
    source: 'tenant',
    note: 'Внесено арендатором из кабинета',
  })
  if (error) return { error: error.message }

  revalidatePath(`/cabinet/tenant/${grant.propertyId}`)
  // Показания видны и агентству — на карточке объекта и в акте приёма.
  revalidatePath(`/management/${grant.propertyId}`)

  return {
    success: true,
    message: consumption !== null
      ? `Показание принято, расход ${consumption} ${meter.unit}`
      : 'Первое показание принято — расход посчитается со следующего',
  }
}
