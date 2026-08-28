'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireOrgId } from '@/lib/org'
import { requirePermission } from '@/lib/permissions'

export async function addDealCommentAction(dealId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const body = (formData.get('body') as string)?.trim()
  if (!body) return { error: 'Комментарий не может быть пустым' }
  if (body.length > 2000) return { error: 'Максимум 2000 символов' }

  const permError = await requirePermission(user.id, 'deals', 'update')
  if (permError) return permError

  const { error } = await supabase.from('deal_comments').insert({
    deal_id: dealId,
    author_id: user.id,
    body,
    organization_id: orgId,
  })

  if (error) return { error: error.message }

  revalidatePath(`/deals/${dealId}`)
  return { success: true }
}

export async function deleteDealCommentAction(commentId: string, dealId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { error } = await supabase
    .from('deal_comments')
    .delete()
    .eq('id', commentId)
    .eq('author_id', user.id)

  if (error) return { error: error.message }

  revalidatePath(`/deals/${dealId}`)
  return { success: true }
}
