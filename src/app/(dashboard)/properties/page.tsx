import { createClient } from '@/lib/supabase/server'
import { Home, Plus } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/layout/EmptyState'
import { PropertiesView, type PropertyRow } from '@/features/properties/components/PropertiesView'

export default async function PropertiesPage() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('properties')
    .select('id, title, property_type, deal_type, address, price, area, rooms, status, floor, total_floors, avito_publish, avito_status, site_publish, photo_urls')
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) console.error('Properties error:', error.message)

  const properties: PropertyRow[] = (data ?? []).map(({ photo_urls, ...p }) => ({
    ...p,
    price: p.price === null ? null : Number(p.price),
    area: p.area === null ? null : Number(p.area),
    // Первое фото — обложка, тот же порядок, что уходит на площадки
    cover_url: photo_urls?.[0] ?? null,
  }))

  const publishedCount = properties.filter(p => p.avito_publish).length
  const sitePublishedCount = properties.filter(p => p.site_publish).length

  return (
    <div className="space-y-5">
      <PageHeader
        title="Объекты"
        subtitle={`${properties.length} объектов в базе · ${publishedCount} на Авито · ${sitePublishedCount} на сайте`}
        actions={
          <Link href="/properties/new" className={buttonVariants({ size: 'sm' })}>
            <Plus style={{ width: 16, height: 16 }} />
            Новый объект
          </Link>
        }
      />

      {properties.length === 0 ? (
        error ? (
          <EmptyState
            icon={<Home className="w-5 h-5 text-[var(--hp-sub)]" />}
            title="Не получилось загрузить объекты"
            description="Обновите страницу. Если ошибка повторится — напишите в поддержку."
          />
        ) : (
          <EmptyState
            icon={<Home className="w-5 h-5 text-[var(--hp-sub)]" />}
            title="Объектов пока нет"
            description="Объект — квартира, дом или помещение, с которым вы работаете. Добавьте первый, и его можно будет привязать к сделке и опубликовать на Авито и сайте."
            actionHref="/properties/new"
            actionLabel="Новый объект"
          />
        )
      ) : (
        <PropertiesView properties={properties} />
      )}
    </div>
  )
}
