import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, FolderOpen } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { buttonVariants } from '@/components/ui/button'
import { CollectionsView, type CollectionRow } from '@/features/collections/components/CollectionsView'

export default async function CollectionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('property_collections')
    .select(`id, title, is_public, share_token, created_at,
             lead:leads(id, full_name),
             items:collection_items(count)`)
    .order('created_at', { ascending: false })
    .limit(500)

  const collections: CollectionRow[] = (data ?? []).map(c => {
    const lead = c.lead as { id: string; full_name: string | null } | null
    const items = c.items as { count: number }[] | null
    return {
      id: c.id,
      title: c.title,
      isPublic: !!c.is_public,
      itemsCount: items?.[0]?.count ?? 0,
      leadId: lead?.id ?? null,
      leadName: lead?.full_name ?? null,
      createdAt: c.created_at,
    }
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Подборки объектов"
        subtitle="Персональные подборки для клиентов с публичными ссылками"
        actions={
          <Link href="/collections/new" className={buttonVariants({ size: 'sm' })}>
            <Plus style={{ width: 16, height: 16 }} />
            Новая подборка
          </Link>
        }
      />

      {collections.length === 0 ? (
        <div className="hp-card hp-empty">
          <div className="w-12 h-12 rounded-[var(--hp-radius)] bg-[var(--hp-neutral-tint)] border border-[var(--hp-border)] flex items-center justify-center mx-auto mb-3">
            <FolderOpen style={{ width: 20, height: 20 }} className="text-[var(--hp-tertiary)]" />
          </div>
          <p className="text-[var(--hp-ink)] font-semibold">Подборок пока нет</p>
          <Link href="/collections/new" className="hp-btn-primary mt-5">
            <Plus style={{ width: 16, height: 16 }} />
            Создать подборку
          </Link>
        </div>
      ) : (
        <CollectionsView collections={collections} />
      )}
    </div>
  )
}
