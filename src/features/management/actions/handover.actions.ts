'use server'

import { revalidatePath } from 'next/cache'
import { getSessionContext } from '@/lib/org'
import { requirePermission } from '@/lib/permissions'
import { writeAuditLog } from '@/lib/audit'
import { toJson } from '@/lib/json'

type Result = { error?: string; success?: boolean }

function str(v: FormDataEntryValue | null): string {
  return typeof v === 'string' ? v.trim() : ''
}

export interface InventoryItem {
  title: string
  condition?: string
  note?: string
}

/**
 * Опись вводится построчно: «Холодильник Bosch — рабочий». Так её заполняет
 * человек, стоя в квартире с телефоном, а не через редактор таблиц.
 */
function parseInventory(raw: string): InventoryItem[] {
  return raw.split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [title, condition] = line.split(/\s+—\s+|\s+-\s+/, 2)
      return condition
        ? { title: title.trim(), condition: condition.trim() }
        : { title: line }
    })
}

function parseDocuments(raw: string): { title: string }[] {
  return raw.split('\n').map(l => l.trim()).filter(Boolean).map(title => ({ title }))
}

/** Сохранение акта без закрытия — заполняется в несколько заходов. */
export async function saveHandoverAction(formData: FormData): Promise<Result> {
  const ctx = await getSessionContext()
  if (!ctx.ok) return { error: ctx.error }
  const { supabase, user } = ctx

  const permError = await requirePermission(user.id, 'contracts', 'update')
  if (permError) return permError

  const engagementId = str(formData.get('engagement_id'))
  if (!engagementId) return { error: 'Обслуживание не найдено' }

  const keysRaw = str(formData.get('keys_count'))

  // Обслуживание, заведённое миграцией, могло приехать без записи акта.
  // upsert по engagement_id (у него уникальный индекс) — вместо update,
  // который в таком случае молча не находил бы строку и «сохранял» в пустоту.
  const { data: engagement } = await supabase
    .from('management_engagements')
    .select('organization_id')
    .eq('id', engagementId)
    .maybeSingle()
  if (!engagement) return { error: 'Обслуживание не найдено' }

  const { error } = await supabase
    .from('property_handovers')
    .upsert({
      engagement_id: engagementId,
      organization_id: engagement.organization_id,
      inventory: toJson(parseInventory(str(formData.get('inventory')))),
      documents: toJson(parseDocuments(str(formData.get('documents')))),
      condition_note: str(formData.get('condition_note')) || null,
      keys_count: keysRaw === '' ? null : Number(keysRaw),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'engagement_id' })

  if (error) return { error: error.message }

  revalidatePath('/management')
  return { success: true }
}

/**
 * Закрытие акта приёма.
 *
 * Отказ называет недостающее поимённо — вплоть до того, по какому именно
 * счётчику нет показания (FR-020). «Заполните обязательные поля» здесь
 * бесполезно: человек стоит в квартире и должен понять, что дозамерить, не
 * возвращаясь в офис.
 *
 * Почему это не CHECK в базе: констрейнт не умеет объяснять, а обязательность
 * зависит от того, сколько у объекта активных счётчиков.
 */
export async function completeHandoverAction(engagementId: string): Promise<Result> {
  const ctx = await getSessionContext()
  if (!ctx.ok) return { error: ctx.error }
  const { supabase, user, orgId } = ctx

  const permError = await requirePermission(user.id, 'contracts', 'update')
  if (permError) return permError

  const { data: engagement } = await supabase
    .from('management_engagements')
    .select('id, property_id, started_at, handover:property_handovers(id, inventory, keys_count, completed_at)')
    .eq('id', engagementId)
    .maybeSingle()

  if (!engagement) return { error: 'Обслуживание не найдено' }

  const handover = Array.isArray(engagement.handover) ? engagement.handover[0] : engagement.handover
  if (!handover) {
    return { error: 'Акт приёма ещё не сохранён — заполните опись и нажмите «Сохранить», потом закрывайте' }
  }
  if (handover.completed_at) return { error: 'Акт приёма уже закрыт' }

  const missing: string[] = []

  const inventory = Array.isArray(handover.inventory) ? handover.inventory : []
  if (inventory.length === 0) {
    missing.push('опись имущества пуста')
  }
  if (handover.keys_count === null || handover.keys_count === undefined) {
    missing.push('не указано, сколько ключей передано')
  }

  // Начальные показания: по каждому активному счётчику нужно значение не раньше
  // даты начала обслуживания — иначе расход не от чего отсчитывать.
  const { data: meters } = await supabase
    .from('utility_meters')
    .select('id, title, kind, readings:meter_readings(reading_date)')
    .eq('property_id', engagement.property_id)
    .eq('is_active', true)

  for (const meter of meters ?? []) {
    const readings = Array.isArray(meter.readings) ? meter.readings : []
    const hasInitial = readings.some(r => r.reading_date >= engagement.started_at)
    if (!hasInitial) {
      missing.push(`нет начального показания по счётчику «${meter.title || meter.kind}»`)
    }
  }

  if (missing.length > 0) {
    return {
      error: `Акт приёма закрыть нельзя: ${missing.join('; ')}. ` +
        `Без начальных показаний расход не посчитать, без описи не предъявить претензию по имуществу.`,
    }
  }

  const { error } = await supabase
    .from('property_handovers')
    .update({ completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', handover.id)

  if (error) return { error: error.message }

  // Приёмка закрыта — обслуживание переходит в рабочее состояние.
  const { error: statusError } = await supabase
    .from('management_engagements')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', engagementId)
  if (statusError) return { error: `Акт закрыт, но статус обслуживания не обновился: ${statusError.message}` }

  await writeAuditLog({
    userId: user.id, orgId,
    action: 'update', entityType: 'property_handover',
    entityId: handover.id, entityLabel: 'Акт приёма закрыт, объект в обслуживании',
  })

  revalidatePath('/management')
  revalidatePath(`/management/${engagement.property_id}`)
  return { success: true }
}
