'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSessionContext, requireOrgId } from '@/lib/org'
import { requirePermission } from '@/lib/permissions'
import { isValidEmail } from '@/lib/email/provider'
import { sendCollectionSharedEmail } from '@/lib/email/send'
import { getSiteUrl } from '@/lib/telegram/site-url'
import { advanceDealStage } from '@/lib/deal-automation'
import { friendlyDbError } from '@/lib/errors'
import { MAIL_NOT_CONFIGURED } from '@/lib/email/messages'

export async function createCollectionAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const title   = (formData.get('title')   as string)?.trim()
  const lead_id = (formData.get('lead_id') as string) || null
  const deal_id = (formData.get('deal_id') as string) || null
  if (!title) return { error: 'Укажите название подборки' }

  const permError = await requirePermission(user.id, 'collections', 'create')
  if (permError) return permError

  const { data, error } = await supabase
    .from('property_collections')
    .insert({ title, lead_id, deal_id, organization_id: orgId, created_by: user.id })
    .select('id')
    .single()

  if (error) return { error: friendlyDbError(error) }

  revalidatePath('/collections')
  if (deal_id) revalidatePath(`/deals/${deal_id}`)
  redirect(`/collections/${data.id}`)
}

export async function toggleCollectionPublicAction(collectionId: string, isPublic: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const permError = await requirePermission(user.id, 'collections', 'update')
  if (permError) return permError

  const { error } = await supabase
    .from('property_collections')
    .update({ is_public: isPublic })
    .eq('id', collectionId)

  if (error) return { error: friendlyDbError(error, { verb: 'изменить' }) }
  revalidatePath(`/collections/${collectionId}`)
  return { success: true }
}

export async function addPropertyToCollectionAction(collectionId: string, propertyId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const permError = await requirePermission(user.id, 'collections', 'update')
  if (permError) return permError

  const { error } = await supabase
    .from('collection_items')
    .insert({ collection_id: collectionId, property_id: propertyId })

  if (error) {
    if (error.code === '23505') return { error: 'Объект уже в подборке' }
    return { error: friendlyDbError(error) }
  }

  revalidatePath(`/collections/${collectionId}`)
  return { success: true }
}

export async function removePropertyFromCollectionAction(collectionId: string, propertyId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const permError = await requirePermission(user.id, 'collections', 'update')
  if (permError) return permError

  const { error } = await supabase
    .from('collection_items')
    .delete()
    .eq('collection_id', collectionId)
    .eq('property_id', propertyId)

  if (error) return { error: friendlyDbError(error, { verb: 'удалить' }) }
  revalidatePath(`/collections/${collectionId}`)
  return { success: true }
}

export async function deleteCollectionAction(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const permError = await requirePermission(user.id, 'collections', 'delete')
  if (permError) return permError

  const { error } = await supabase.from('property_collections').delete().eq('id', id)
  if (error) return { error: friendlyDbError(error, { verb: 'удалить' }) }

  revalidatePath('/collections')
  redirect('/collections')
}

/**
 * Отправляет клиенту ссылку на подборку письмом.
 *
 * Побочный эффект намеренный: подборка автоматически становится публичной —
 * иначе получатель откроет ссылку и упрётся в 404, что выглядит как поломка,
 * а не как настройка приватности.
 */
export async function sendCollectionByEmailAction(collectionId: string, formData: FormData) {
  const ctx = await getSessionContext()
  if (!ctx.ok) return { error: ctx.error }
  const { supabase, user, orgId } = ctx

  const permError = await requirePermission(user.id, 'collections', 'update')
  if (permError) return permError

  const { data, error } = await supabase
    .from('property_collections')
    .select(`id, title, share_token, is_public, lead_id, deal_id,
             lead:leads(email, full_name),
             deal:deals(client_contact:contacts!deals_client_contact_id_fkey(email)),
             items:collection_items(property_id)`)
    .eq('id', collectionId)
    .single()

  if (error || !data) return { error: 'Подборка не найдена' }

  const collection = data as unknown as {
    id: string
    title: string
    share_token: string
    is_public: boolean
    lead_id: string | null
    deal_id: string | null
    lead: { email: string | null; full_name: string | null } | null
    deal: { client_contact: { email: string | null } | null } | null
    items: { property_id: string }[] | null
  }

  const explicit = (formData.get('email') as string)?.trim()
  const to = explicit || collection.lead?.email || collection.deal?.client_contact?.email || ''
  if (!isValidEmail(to)) {
    return { error: 'Укажите корректный email получателя' }
  }

  const itemsCount = collection.items?.length ?? 0
  if (itemsCount === 0) return { error: 'В подборке нет объектов — добавьте хотя бы один' }

  if (!collection.is_public) {
    const { error: pubError } = await supabase
      .from('property_collections')
      .update({ is_public: true })
      .eq('id', collectionId)
    if (pubError) return { error: `Не удалось открыть доступ к подборке: ${pubError.message}` }
  }

  const { data: profile } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()

  const result = await sendCollectionSharedEmail({
    orgId,
    to,
    collectionId,
    collectionTitle: collection.title,
    shareUrl: `${getSiteUrl()}/c/${collection.share_token}`,
    itemsCount,
    agentName: profile?.full_name ?? null,
    comment: (formData.get('comment') as string)?.trim() || null,
  })

  if (!result.ok) return { error: result.error ?? 'Не удалось отправить письмо' }
  if (result.skipped) return { error: MAIL_NOT_CONFIGURED }

  await supabase.from('property_collections').update({ sent_at: new Date().toISOString() }).eq('id', collectionId)

  // Отправка подборки — это событие процесса, а не только письмо: в подборе
  // для арендатора она двигает сделку на стадию «Подборка отправлена».
  // У остальных направлений такой вехи нет, и автоматика там ничего не делает.
  let dealId = collection.deal_id
  if (!dealId && collection.lead_id) {
    const { data: deal } = await supabase
      .from('deals')
      .select('id')
      .eq('lead_id', collection.lead_id)
      .eq('deal_type', 'tenant_search')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    dealId = deal?.id ?? null
  }
  if (dealId) {
    await advanceDealStage(supabase, dealId, 'collection')
    revalidatePath('/deals')
    revalidatePath(`/deals/${dealId}`)
  }

  revalidatePath(`/collections/${collectionId}`)
  return { success: true, message: `Подборка отправлена на ${to}` }
}
