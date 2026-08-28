'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireOrgId } from '@/lib/org'
import { randomBytes } from 'crypto'
import { requirePermission } from '@/lib/permissions'

const AVAILABLE_EVENTS = ['lead.created', 'deal.created', 'contract.created', 'payment.received']

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' as const }

  const permError = await requirePermission(user.id, 'settings', 'update')
  if (permError) return { error: permError.error }

  return { supabase }
}

export async function createWebhookAction(formData: FormData) {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }
  const { supabase } = auth

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const url    = (formData.get('url') as string)?.trim()
  const events = formData.getAll('events') as string[]

  if (!url || !url.startsWith('https://')) return { error: 'URL должен начинаться с https://' }
  if (events.length === 0) return { error: 'Выберите хотя бы одно событие' }

  const secret = `whsec_${randomBytes(24).toString('hex')}`

  const { error } = await supabase.from('webhook_endpoints').insert({
    url, secret,
    events: events.filter(e => AVAILABLE_EVENTS.includes(e)),
    organization_id: orgId,
  })

  if (error) return { error: error.message }

  revalidatePath('/settings/webhooks')
  return { success: true, secret }
}

export async function toggleWebhookAction(id: string, isActive: boolean) {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }
  const { supabase } = auth

  const { error } = await supabase.from('webhook_endpoints').update({ is_active: isActive }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/settings/webhooks')
  return { success: true }
}

export async function deleteWebhookAction(id: string) {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }
  const { supabase } = auth

  const { error } = await supabase.from('webhook_endpoints').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/settings/webhooks')
  return { success: true }
}
