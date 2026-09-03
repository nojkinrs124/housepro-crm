import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { buttonVariants } from '@/components/ui/button'
import { Markdown } from '@/features/knowledge/components/Markdown'
import { ReviewButton } from '@/features/knowledge/components/ReviewButton'
import { markArticleReviewedAction } from '@/features/knowledge/actions/knowledge.actions'
import { freshnessOf } from '@/features/knowledge/services/freshness'
import { can, toUserRole } from '@/lib/permissions'
import { formatDateCompact } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: article }, { data: profile }] = await Promise.all([
    supabase.from('knowledge_articles')
      .select('id, slug, title, category, summary, body, is_published, updated_at, reviewed_at, review_period_months')
      .eq('slug', slug)
      .maybeSingle(),
    supabase.from('users').select('role').eq('id', user.id).maybeSingle(),
  ])

  if (!article) notFound()

  const canEdit = can(toUserRole(profile?.role), 'knowledge', 'update')
  // Черновик читателю не показываем — он ещё не инструкция
  if (!article.is_published && !canEdit) notFound()

  const fresh = freshnessOf(article.reviewed_at, article.review_period_months)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title={article.title}
        subtitle={`${article.category} · ${fresh.label}${article.reviewed_at ? ` · проверена ${formatDateCompact(article.reviewed_at)}` : ''}`}
        backHref="/knowledge"
        backLabel="База знаний"
        actions={canEdit ? (
          <>
            <ReviewButton
              action={markArticleReviewedAction.bind(null, article.id)}
              overdue={fresh.kind === 'stale' || fresh.kind === 'never'}
            />
            <Link href={`/knowledge/${article.slug}/edit`} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
              <Pencil style={{ width: 16, height: 16 }} />
              Редактировать
            </Link>
          </>
        ) : undefined}
      />

      {!article.is_published && (
        <p className="hp-card p-3 text-sm text-[var(--hp-warn)]">
          Черновик — сотрудники его не видят.
        </p>
      )}

      {/*
        Предупреждение стоит ДО текста, а не под ним: читатель должен узнать,
        что инструкция просрочена, прежде чем начнёт по ней действовать.
      */}
      {(fresh.kind === 'stale' || fresh.kind === 'never') && (
        <div className="hp-card p-4 space-y-1">
          <p className="text-sm font-semibold text-[var(--hp-danger)]">
            Инструкцию давно не проверяли — {fresh.label.toLowerCase()}
          </p>
          <p className="text-[12.5px] text-[var(--hp-sub)]">
            Раздел CRM мог измениться с тех пор. Сверьтесь с интерфейсом,
            прежде чем действовать по этому тексту{canEdit ? ', и отметьте актуальность или поправьте текст' : ''}.
          </p>
        </div>
      )}

      <div className="hp-card p-6">
        <Markdown source={article.body} />
      </div>
    </div>
  )
}
