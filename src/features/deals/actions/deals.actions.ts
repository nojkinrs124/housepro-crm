'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DealSchema } from '@/lib/schemas'
import { rateLimitCreate } from '@/lib/rate-limit'
import { requireOrgId } from '@/lib/org'
import { writeAuditLog } from '@/lib/audit'
import { dispatchWebhook } from '@/lib/webhooks'
import { requirePermission } from '@/lib/permissions'

const VALID_DEAL_STATUSES = ['new', 'showing', 'negotiation', 'contract', 'payment', 'completed', 'cancelled']

export async function createDealAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const rl = await rateLimitCreate(user.id, 'deal')
  if (!rl.success) return { error: 'Слишком много запросов. Подождите минуту.' }

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const parsed = DealSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first.message, fields: parsed.error.flatten().fieldErrors }
  }

  const permError = await requirePermission(user.id, 'deals', 'create')
  if (permError) return permError

  const { data: deal, error } = await supabase.from('deals').insert({
    ...parsed.data,
    status: 'new',
    manager_id: user.id,
    organization_id: orgId,
  }).select('id').single()
  if (error) return { error: error.message }

  await writeAuditLog({
    userId: user.id, orgId,
    action: 'create', entityType: 'deal',
    entityId: deal.id, entityLabel: `Сделка (${parsed.data.deal_type})`,
  })

  dispatchWebhook(orgId, 'deal.created', {
    id: deal.id, deal_type: parsed.data.deal_type, amount: parsed.data.amount,
  })

  revalidatePath('/deals')
  revalidatePath('/analytics', 'page')
  redirect('/deals')
}

export async function updateDealStatusAction(id: string, status: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  if (!VALID_DEAL_STATUSES.includes(status)) {
    return { error: `Недопустимый статус сделки: ${status}` }
  }

  const permError = await requirePermission(user.id, 'deals', 'update')
  if (permError) return permError

  const { error } = await supabase
    .from('deals')
    .update({ status })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/deals')
  revalidatePath('/analytics', 'page')
  return { success: true }
}

export async function updateDealAction(id: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const parsed = DealSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first.message, fields: parsed.error.flatten().fieldErrors }
  }

  const permError = await requirePermission(user.id, 'deals', 'update')
  if (permError) return permError

  const { error } = await supabase
    .from('deals')
    .update(parsed.data)
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/deals')
  revalidatePath(`/deals/${id}`)
  redirect(`/deals/${id}`)
}

export async function deleteDealAction(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const permError = await requirePermission(user.id, 'deals', 'delete')
  if (permError) return permError

  await supabase.from('deals').delete().eq('id', id)

  revalidatePath('/deals')
  redirect('/deals')
}
