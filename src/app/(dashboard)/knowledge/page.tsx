import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BookOpen, Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { buttonVariants } from '@/components/ui/button'
import { KnowledgeList, type ArticleRow } from '@/features/knowledge/components/KnowledgeList'
import { can, toUserRole } from '@/lib/permissions'

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
    .select('id, slug, title, category, summary, is_published, updated_at')
    .order('sort_order')
    .order('title')

  const { data } = canEdit ? await query : await query.eq('is_published', true)

  const articles: ArticleRow[] = (data ?? []).map(a => ({
    id: a.id,
    slug: a.slug,
    title: a.title,
    category: a.category,
    summary: a.summary,
    isPublished: a.is_published,
    updatedAt: a.updated_at,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="База знаний"
        subtitle={`${articles.length} инструкций`}
        actions={canEdit ? (
          <Link href="/knowledge/new" className={buttonVariants({ size: 'sm' })}>
            <Plus style={{ width: 16, height: 16 }} />
            Новая статья
          </Link>
        ) : undefined}
      />

      {articles.length === 0 ? (
        <div className="hp-card hp-empty">
          <div className="w-12 h-12 rounded-[var(--hp-radius)] bg-[var(--hp-neutral-tint)] border border-[var(--hp-border)] flex items-center justify-center mx-auto mb-3">
            <BookOpen style={{ width: 20, height: 20 }} className="text-[var(--hp-tertiary)]" />
          </div>
          <p className="text-[var(--hp-ink)] font-semibold">Инструкций пока нет</p>
          <p className="text-[var(--hp-sub)] text-sm mt-1">
            Соберите здесь порядок работы агентства — от приёма заявки до отчёта собственнику
          </p>
          {canEdit && (
            <Link href="/knowledge/new" className="hp-btn-primary mt-5">
              <Plus style={{ width: 16, height: 16 }} />
              Написать первую
            </Link>
          )}
        </div>
      ) : (
        <KnowledgeList articles={articles} canEdit={canEdit} />
      )}
    </div>
  )
}
