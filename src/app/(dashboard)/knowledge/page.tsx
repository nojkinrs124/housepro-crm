import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BookOpen, Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/layout/EmptyState'
import { buttonVariants } from '@/components/ui/button'
import { KnowledgeList, type ArticleRow } from '@/features/knowledge/components/KnowledgeList'
import { LoadHandbookButton } from '@/features/knowledge/components/LoadHandbookButton'
import { can, toUserRole } from '@/lib/permissions'
import { freshnessOf } from '@/features/knowledge/services/freshness'

export const dynamic = 'force-dynamic'

/**
 * База знаний агентства: инструкции для себя и сотрудников там же, где идёт
 * работа. Черновики видят только те, кто может править.
 */
export default async function KnowledgePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  const canEdit = can(toUserRole(profile?.role), 'knowledge', 'update')

  const query = supabase
    .from('knowledge_articles')
    .select('id, slug, title, category, summary, is_published, updated_at, reviewed_at, review_period_months')
    .order('sort_order')
    .order('title')

  const { data } = canEdit ? await query : await query.eq('is_published', true)

  // Свежесть считаем на сервере: иначе у клиента и сервера разъедется «сегодня»
  // и React ругнётся на несовпадение разметки при гидратации.
  const articles: ArticleRow[] = (data ?? []).map(a => {
    const fresh = freshnessOf(a.reviewed_at, a.review_period_months)
    return {
      id: a.id,
      slug: a.slug,
      title: a.title,
      category: a.category,
      summary: a.summary,
      isPublished: a.is_published,
      updatedAt: a.updated_at,
      freshness: fresh.kind,
      freshnessLabel: fresh.label,
    }
  })

  const stale = articles.filter(a => a.freshness === 'stale' || a.freshness === 'never').length

  return (
    <div className="space-y-6">
      <PageHeader
        title="База знаний"
        subtitle={stale > 0
          ? `${articles.length} инструкций · ${stale} требуют проверки`
          : `${articles.length} инструкций`}
        actions={canEdit ? (
          <Link href="/knowledge/new" className={buttonVariants({ size: 'sm' })}>
            <Plus style={{ width: 16, height: 16 }} />
            Новая статья
          </Link>
        ) : undefined}
      />

      {articles.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="w-5 h-5 text-[var(--hp-sub)]" />}
          title="Инструкций пока нет"
          description="База знаний — справочник для сотрудников: как заводить сделку, что заполнять перед договором. Загрузите стандартный справочник по всем разделам CRM или напишите первую статью."
          action={canEdit ? <LoadHandbookButton /> : undefined}
          actionHref={canEdit ? undefined : '/knowledge/new'}
          actionLabel={canEdit ? undefined : 'Новая статья'}
        />
      ) : (
        <KnowledgeList articles={articles} canEdit={canEdit} />
      )}
    </div>
  )
}
