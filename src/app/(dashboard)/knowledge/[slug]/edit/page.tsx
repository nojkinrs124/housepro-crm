import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { ArticleForm } from '@/features/knowledge/components/ArticleForm'
import { updateArticleAction, deleteArticleAction } from '@/features/knowledge/actions/knowledge.actions'
import { DeleteArticleButton } from '@/features/knowledge/components/DeleteArticleButton'
import { can, toUserRole } from '@/lib/permissions'

export default async function EditArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: article }, { data: profile }] = await Promise.all([
    supabase.from('knowledge_articles')
      .select('id, slug, title, category, summary, body, sort_order, is_published')
      .eq('slug', slug)
      .maybeSingle(),
    supabase.from('users').select('role').eq('id', user.id).maybeSingle(),
  ])

  if (!article) notFound()

  const role = toUserRole(profile?.role)
  if (!can(role, 'knowledge', 'update')) redirect(`/knowledge/${slug}`)

  const update = updateArticleAction.bind(null, article.id)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Редактирование статьи"
        subtitle={article.title}
        backHref={`/knowledge/${slug}`}
        backLabel="К статье"
        actions={can(role, 'knowledge', 'delete')
          ? <DeleteArticleButton action={deleteArticleAction.bind(null, article.id)} title={article.title} />
          : undefined}
      />
      <ArticleForm
        action={update}
        defaults={article}
        submitLabel="Сохранить"
        backHref={`/knowledge/${slug}`}
      />
    </div>
  )
}
