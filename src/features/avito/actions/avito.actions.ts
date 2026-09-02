'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { randomBytes } from 'crypto'
import { requireOrgId } from '@/lib/org'
import { requirePermission } from '@/lib/permissions'
import { rateLimitMutation } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'
import { normalizePhone } from '@/lib/utils'
import {
  fetchAvitoAccessToken,
  fetchAvitoAutoloadLastReport,
  AvitoApiError,
} from '@/features/avito/services/avito-api.service'
import type { Insert } from '@/types/database'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' as const }

  const permError = await requirePermission(user.id, 'settings', 'update')
  if (permError) return { error: permError.error }

  return { supabase, user }
}

// ─── Публикация конкретного объекта ────────────────────────────────────────

export async function toggleAvitoPublishAction(propertyId: string, publish: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const permError = await requirePermission(user.id, 'properties', 'update')
  if (permError) return permError

  const rl = await rateLimitMutation(user.id, 'avito_publish')
  if (!rl.success) return { error: 'Слишком много запросов, попробуйте через минуту' }

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const { data: property } = await supabase
    .from('properties')
    .select('id, title, status')
    .eq('id', propertyId)
    .single()

  if (!property) return { error: 'Объект не найден' }

  if (publish && property.status !== 'available') {
    return { error: 'Публиковать на Авито можно только объекты со статусом «Свободен»' }
  }

  const { error } = await supabase
    .from('properties')
    .update({
      avito_publish: publish,
      avito_status: publish ? 'pending' : null,
      avito_error: null,
      avito_ad_id: publish ? undefined : null,
    })
    .eq('id', propertyId)

  if (error) return { error: error.message }

  await writeAuditLog({
    userId: user.id,
    orgId,
    action: 'update',
    entityType: 'property',
    entityId: propertyId,
    entityLabel: property.title,
    changes: { avito_publish: { old: !publish, new: publish } },
  })

  revalidatePath(`/properties/${propertyId}`)
  revalidatePath('/properties')
  return { success: true }
}

// ─── Настройки интеграции (client_id/secret/аккаунт/телефон) ─────────────

export async function saveAvitoSettingsAction(_prevState: unknown, formData: FormData) {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }
  const { supabase, user } = auth

  const rl = await rateLimitMutation(user.id, 'avito_settings')
  if (!rl.success) return { error: 'Слишком много запросов, попробуйте через минуту' }

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const clientId     = (formData.get('client_id') as string)?.trim() || null
  const clientSecret = (formData.get('client_secret') as string)?.trim()
  const avitoUserId  = (formData.get('avito_user_id') as string)?.trim() || null
  const contactPhone = normalizePhone(formData.get('contact_phone') as string)
  const isEnabled    = formData.get('is_enabled') === 'on'

  if (avitoUserId && !/^\d+$/.test(avitoUserId)) {
    return { error: 'ID аккаунта Авито — число из личного кабинета (профессионалам → API)' }
  }

  const { data: existing } = await supabase
    .from('avito_settings')
    .select('id, client_secret')
    .eq('organization_id', orgId)
    .maybeSingle()

  const payload: Insert<'avito_settings'> = {
    organization_id: orgId,
    client_id: clientId,
    avito_user_id: avitoUserId,
    contact_phone: contactPhone,
    is_enabled: isEnabled,
    // Сбрасываем закешированный токен — он мог быть выдан на старые credentials
    access_token: null,
    token_expires_at: null,
    updated_at: new Date().toISOString(),
  }

  // Поле секрета в форме всегда замаскировано (••••1234) — перезаписываем,
  // только если пользователь реально вписал новое значение.
  if (clientSecret && !clientSecret.startsWith('••••')) {
    payload.client_secret = clientSecret
  } else if (!existing) {
    payload.client_secret = null
  }

  const { error } = existing
    ? await supabase.from('avito_settings').update(payload).eq('id', existing.id)
    : await supabase.from('avito_settings').insert(payload)

  if (error) return { error: error.message }

  await writeAuditLog({
    userId: user.id,
    orgId,
    action: existing ? 'update' : 'create',
    entityType: 'avito_settings',
    entityId: existing?.id ?? orgId,
    entityLabel: 'Настройки интеграции с Авито',
  })

  revalidatePath('/settings/avito')
  return { success: true }
}

export async function regenerateAvitoFeedTokenAction() {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }
  const { supabase } = auth

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const newToken = randomBytes(16).toString('hex')

  const { error } = await supabase
    .from('avito_settings')
    .update({ feed_token: newToken, updated_at: new Date().toISOString() })
    .eq('organization_id', orgId)

  if (error) return { error: error.message }

  revalidatePath('/settings/avito')
  return { success: true }
}

// ─── Синхронизация статусов из Авито ──────────────────────────────────────

export async function syncAvitoStatusAction() {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }
  const { supabase, user } = auth

  const rl = await rateLimitMutation(user.id, 'avito_sync')
  if (!rl.success) return { error: 'Слишком много запросов, попробуйте через минуту' }

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const { data: settings } = await supabase
    .from('avito_settings')
    .select('*')
    .eq('organization_id', orgId)
    .maybeSingle()

  if (!settings?.client_id || !settings?.client_secret) {
    return { error: 'Сначала укажите client_id и client_secret в настройках интеграции' }
  }
  if (!settings.avito_user_id) {
    return { error: 'Укажите ID аккаунта Авито в настройках интеграции' }
  }

  let accessToken = settings.access_token as string | null
  const tokenValid = accessToken && settings.token_expires_at && new Date(settings.token_expires_at) > new Date()

  try {
    if (!tokenValid) {
      const token = await fetchAvitoAccessToken(settings.client_id, settings.client_secret)
      accessToken = token.accessToken
      await supabase.from('avito_settings').update({
        access_token: token.accessToken,
        token_expires_at: new Date(Date.now() + token.expiresInSeconds * 1000).toISOString(),
      }).eq('id', settings.id)
    }

    const report = await fetchAvitoAutoloadLastReport(settings.avito_user_id, accessToken!)
    const now = new Date().toISOString()

    if (!report.found) {
      await supabase.from('avito_settings').update({
        last_synced_at: now,
        last_sync_error: 'Авито ещё не отдаёт отчёты автозагрузки для этого аккаунта — обычно это значит, что фид ещё не зарегистрирован в личном кабинете (Автозагрузка → Настройки) или Авито ни разу его не обработал.',
      }).eq('id', settings.id)
      revalidatePath('/settings/avito')
      return {
        success: true,
        warning: 'Отчёт автозагрузки пока недоступен. Убедитесь, что ссылка на фид добавлена в личном кабинете Авито (Автозагрузка → Настройки) — статусы объектов появятся после первой обработки фида на их стороне.',
      }
    }

    let matched = 0
    for (const item of report.items) {
      if (!item.adId) continue
      const status: string = item.error ? 'error' : (item.status === 'active' ? 'active' : (item.status ?? 'pending'))
      const { error } = await supabase
        .from('properties')
        .update({
          avito_status: status,
          avito_ad_id: item.avitoItemId ?? null,
          avito_error: item.error ?? null,
          avito_synced_at: now,
        })
        .eq('id', item.adId)
        .eq('organization_id', orgId)
      if (!error) matched++
    }

    await supabase.from('avito_settings').update({
      last_synced_at: now,
      last_sync_error: null,
    }).eq('id', settings.id)

    revalidatePath('/settings/avito')
    revalidatePath('/properties')
    return { success: true, matched }
  } catch (e) {
    const message = e instanceof AvitoApiError ? e.message : 'Не удалось связаться с API Авито'
    await supabase.from('avito_settings').update({
      last_synced_at: new Date().toISOString(),
      last_sync_error: message,
    }).eq('id', settings.id)
    revalidatePath('/settings/avito')
    return { error: message }
  }
}
