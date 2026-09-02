import { createClient } from '@/lib/supabase/server'
import { Home, Plus } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { buttonVariants } from '@/components/ui/button'
import { PropertiesView, type PropertyRow } from '@/features/properties/components/PropertiesView'

export default async function PropertiesPage() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('properties')
    .select('id, title, property_type, deal_type, address, price, area, rooms, status, floor, total_floors, avito_publish, avito_status, site_publish')
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) console.error('Properties error:', error.message)

  const properties: PropertyRow[] = (data ?? []).map(p => ({
    ...p,
    price: p.price === null ? null : Number(p.price),
    area: p.area === null ? null : Number(p.area),
  }))

  const publishedCount = properties.filter(p => p.avito_publish).length
  const sitePublishedCount = properties.filter(p => p.site_publish).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Объекты недвижимости"
        subtitle={`${properties.length} объектов в базе · ${publishedCount} на Авито · ${sitePublishedCount} на сайте`}
        actions={
          <Link href="/properties/new" className={buttonVariants({ size: 'sm' })}>
            <Plus style={{ width: 16, height: 16 }} />
            Добавить объект
          </Link>
        }
      />

      {properties.length === 0 ? (
        <div className="hp-card hp-empty">
          <div className="w-12 h-12 rounded-[var(--hp-radius)] bg-[var(--hp-neutral-tint)] border border-[var(--hp-border)] flex items-center justify-center mx-auto mb-3">
            <Home style={{ width: 20, height: 20 }} className="text-[var(--hp-tertiary)]" />
          </div>
          <p className="text-[var(--hp-ink)] font-semibold">
            {error ? `Ошибка: ${error.message}` : 'Нет объектов'}
          </p>
          <Link href="/properties/new" className="hp-btn-primary mt-5">
            <Plus style={{ width: 16, height: 16 }} />
            Добавить объект
          </Link>
        </div>
      ) : (
        <PropertiesView properties={properties} />
      )}
    </div>
  )
}
