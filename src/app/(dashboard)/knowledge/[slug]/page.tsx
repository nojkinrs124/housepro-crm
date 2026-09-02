import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { buttonVariants } from '@/components/ui/button'
import { Markdown } from '@/features/knowledge/components/Markdown'
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
      .select('id, slug, title, category, summary, body, is_published, updated_at')
      .eq('slug', slug)
      .maybeSingle(),
    supabase.from('users').select('role').eq('id', user.id).maybeSingle(),
  ])

  if (!article) notFound()

  const canEdit = can(toUserRole(profile?.role), 'knowledge', 'update')
  // Черновик читателю не показываем — он ещё не инструкция
  if (!article.is_published && !canEdit) notFound()

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title={article.title}
        subtitle={`${article.category}${article.updated_at ? ` · обновлено ${formatDateCompact(article.updated_at)}` : ''}`}
        backHref="/knowledge"
        backLabel="База знаний"
        actions={canEdit ? (
          <Link href={`/knowledge/${article.slug}/edit`} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
            <Pencil style={{ width: 16, height: 16 }} />
            Редактировать
          </Link>
        ) : undefined}
      />

      {!article.is_published && (
        <p className="hp-card p-3 text-sm text-[var(--hp-warn)]">
          Черновик — сотрудники его не видят.
        </p>
      )}

      <div className="hp-card p-6">
        <Markdown source={article.body} />
      </div>
    </div>
  )
}
