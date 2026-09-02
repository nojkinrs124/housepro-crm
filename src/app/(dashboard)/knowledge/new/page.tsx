import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { ArticleForm } from '@/features/knowledge/components/ArticleForm'
import { createArticleAction } from '@/features/knowledge/actions/knowledge.actions'
import { can, toUserRole } from '@/lib/permissions'

export default async function NewArticlePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  if (!can(toUserRole(profile?.role), 'knowledge', 'create')) redirect('/knowledge')

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader title="Новая статья" backHref="/knowledge" backLabel="База знаний" />
      <ArticleForm action={createArticleAction} submitLabel="Создать статью" backHref="/knowledge" />
    </div>
  )
}
