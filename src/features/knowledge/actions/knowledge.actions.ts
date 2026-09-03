'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSessionContext } from '@/lib/org'
import { requirePermission } from '@/lib/permissions'
import { rateLimitMutation } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'

/**
 * Адрес статьи из заголовка. Кириллица транслитерируется: адрес должен
 * читаться и не ломаться при копировании ссылки.
 */
function slugify(title: string): string {
  const map: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
    й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
    у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
    э: 'e', ю: 'yu', я: 'ya',
  }
  const base = title.toLowerCase().split('').map(ch => map[ch] ?? ch).join('')
  return base.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'article'
}

/**
 * Срок пересмотра в границах CHECK-ограничения. Пустое поле — полгода:
 * инструкция по разделу CRM успевает устареть примерно за этот срок.
 */
function clampPeriod(raw: FormDataEntryValue | null): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return 6
  return Math.min(36, Math.max(1, Math.round(n)))
}

function readForm(formData: FormData) {
  return {
    title: (formData.get('title') as string)?.trim() ?? '',
    category: (formData.get('category') as string)?.trim() || 'Общее',
    summary: (formData.get('summary') as string)?.trim() || null,
    body: (formData.get('body') as string) ?? '',
    sort_order: Number(formData.get('sort_order') ?? 0) || 0,
    is_published: formData.get('is_published') === 'on',
    review_period_months: clampPeriod(formData.get('review_period_months')),
  }
}

export async function createArticleAction(_prev: unknown, formData: FormData) {
  const session = await getSessionContext()
  if (!session.ok) return { error: session.error }
  const { supabase, user, orgId } = session

  const rl = await rateLimitMutation(user.id, 'knowledge')
  if (!rl.success) return { error: 'Слишком много запросов' }

  const permError = await requirePermission(user.id, 'knowledge', 'create')
  if (permError) return permError

  const fields = readForm(formData)
  if (!fields.title) return { error: 'Заголовок обязателен' }

  const { data, error } = await supabase
    .from('knowledge_articles')
    .insert({
      ...fields,
      slug: slugify(fields.title),
      organization_id: orgId,
      created_by: user.id,
      // Только что написанная статья проверена по определению
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .select('id, slug')
    .single()

  if (error) {
    return {
      error: error.code === '23505'
        ? 'Статья с таким заголовком уже есть — измените заголовок'
        : error.message,
    }
  }

  await writeAuditLog({
    userId: user.id, orgId, action: 'create',
    entityType: 'knowledge_articles', entityId: data.id, entityLabel: fields.title,
  })

  revalidatePath('/knowledge')
  redirect(`/knowledge/${data.slug}`)
}

export async function updateArticleAction(id: string, _prev: unknown, formData: FormData) {
  const session = await getSessionContext()
  if (!session.ok) return { error: session.error }
  const { supabase, user, orgId } = session

  const rl = await rateLimitMutation(user.id, 'knowledge')
  if (!rl.success) return { error: 'Слишком много запросов' }

  const permError = await requirePermission(user.id, 'knowledge', 'update')
  if (permError) return permError

  const fields = readForm(formData)
  if (!fields.title) return { error: 'Заголовок обязателен' }

  // Переписал текст — значит перечитал: отдельная кнопка «актуально» после
  // содержательной правки была бы лишним щелчком. А вот правка заголовка или
  // рубрики статью не омолаживает: текст-то никто не перепроверял.
  const { data: before } = await supabase
    .from('knowledge_articles')
    .select('body')
    .eq('id', id)
    .eq('organization_id', orgId)
    .maybeSingle()

  const bodyChanged = (before?.body ?? '') !== fields.body
  const reviewed = bodyChanged
    ? { reviewed_at: new Date().toISOString(), reviewed_by: user.id }
    : {}

  const { data, error } = await supabase
    .from('knowledge_articles')
    .update({ ...fields, ...reviewed, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', orgId)
    .select('slug')
    .single()

  if (error) return { error: error.message }

  await writeAuditLog({
    userId: user.id, orgId, action: 'update',
    entityType: 'knowledge_articles', entityId: id, entityLabel: fields.title,
  })

  revalidatePath('/knowledge')
  revalidatePath(`/knowledge/${data.slug}`)
  redirect(`/knowledge/${data.slug}`)
}

/**
 * «Инструкция всё ещё верна».
 *
 * Отдельное действие, а не побочный эффект открытия статьи: подтверждение
 * должно быть осознанным. Автопродление по факту просмотра обнулило бы весь
 * смысл — статью открывают, чтобы прочитать, а не чтобы ручаться за неё.
 */
export async function markArticleReviewedAction(id: string) {
  const session = await getSessionContext()
  if (!session.ok) return { error: session.error }
  const { supabase, user, orgId } = session

  const rl = await rateLimitMutation(user.id, 'knowledge')
  if (!rl.success) return { error: 'Слишком много запросов' }

  const permError = await requirePermission(user.id, 'knowledge', 'update')
  if (permError) return permError

  const { data, error } = await supabase
    .from('knowledge_articles')
    .update({ reviewed_at: new Date().toISOString(), reviewed_by: user.id })
    .eq('id', id)
    .eq('organization_id', orgId)
    .select('slug, title')
    .single()

  if (error) return { error: error.message }

  await writeAuditLog({
    userId: user.id, orgId, action: 'update',
    entityType: 'knowledge_articles', entityId: id,
    entityLabel: `${data.title} — подтверждена актуальность`,
  })

  revalidatePath('/knowledge')
  revalidatePath(`/knowledge/${data.slug}`)
  return { ok: true as const }
}

export async function deleteArticleAction(id: string) {
  const session = await getSessionContext()
  if (!session.ok) return { error: session.error }
  const { supabase, user, orgId } = session

  const permError = await requirePermission(user.id, 'knowledge', 'delete')
  if (permError) return permError

  const { data } = await supabase
    .from('knowledge_articles')
    .select('title')
    .eq('id', id)
    .eq('organization_id', orgId)
    .maybeSingle()

  const { error } = await supabase
    .from('knowledge_articles')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId)

  if (error) return { error: error.message }

  await writeAuditLog({
    userId: user.id, orgId, action: 'delete',
    entityType: 'knowledge_articles', entityId: id, entityLabel: data?.title ?? 'Статья',
  })

  revalidatePath('/knowledge')
  redirect('/knowledge')
}
