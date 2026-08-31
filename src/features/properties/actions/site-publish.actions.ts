'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireOrgId } from '@/lib/org'
import { requirePermission } from '@/lib/permissions'
import { rateLimitMutation } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'

/**
 * Публикация объекта на публичном сайте «ХаусПро».
 *
 * Отдельный флаг от avito_publish: объект может быть на Авито и не быть на
 * сайте, и наоборот. В отличие от Авито, публиковать на сайте разрешено объекты
 * в любом статусе — сданный объект остаётся доступен по прямой ссылке
 * (её могли переслать) и честно показывает бейдж «Сдан», а не 404.
 */
export async function togglePropertySitePublishAction(propertyId: string, publish: boolean) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const permError = await requirePermission(user.id, 'properties', 'update')
  if (permError) return permError

  const rl = await rateLimitMutation(user.id, 'site_publish')
  if (!rl.success) return { error: 'Слишком много запросов, попробуйте через минуту' }

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const { data: property } = await supabase
    .from('properties')
    .select('id, title')
    .eq('id', propertyId)
    .single()

  if (!property) return { error: 'Объект не найден' }

  const { error } = await supabase
    .from('properties')
    .update({ site_publish: publish })
    .eq('id', propertyId)

  if (error) return { error: error.message }

  await writeAuditLog({
    userId: user.id,
    orgId,
    action: 'update',
    entityType: 'property',
    entityId: propertyId,
    entityLabel: property.title,
    changes: { site_publish: { old: !publish, new: publish } },
  })

  revalidatePath(`/properties/${propertyId}`)
  revalidatePath('/properties')
  // Публичные страницы читают тот же объект — сбрасываем и их кэш
  revalidatePath('/catalog')
  revalidatePath(`/catalog/${propertyId}`)
  revalidatePath('/')

  return { success: true }
}
