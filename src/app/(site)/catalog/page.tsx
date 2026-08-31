import type { Metadata } from 'next'
import Link from 'next/link'
import { Building2 } from 'lucide-react'
import { CatalogFilters } from '@/features/site/components/CatalogFilters'
import { PropertyCard } from '@/features/site/components/PropertyCard'
import {
  CATALOG_PAGE_SIZE,
  fetchCatalog,
  fetchPublishedDistricts,
  type CatalogFilters as Filters,
} from '@/features/site/lib/properties'

export const metadata: Metadata = {
  title: 'Каталог объектов — ХаусПро, Красноярск',
  description:
    'Квартиры, дома и коммерческие помещения в аренду и продажу в Красноярске. Фильтр по типу сделки, количеству комнат, району и цене. Агентство недвижимости ХаусПро.',
}

function pluralObjects(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'объект'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'объекта'
  return 'объектов'
}

/** Ссылка на страницу N с сохранением всех активных фильтров. */
function pageHref(filters: Filters, page: number): string {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (key !== 'page' && value) qs.set(key, String(value))
  }
  if (page > 1) qs.set('page', String(page))
  const s = qs.toString()
  return s ? `/catalog?${s}` : '/catalog'
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<Filters>
}) {
  const filters = await searchParams
  const [{ items, total, page, pageCount }, districts] = await Promise.all([
    fetchCatalog(filters),
    fetchPublishedDistricts(),
  ])

  const hasActiveFilters = Boolean(
    filters.deal_type ||
      filters.property_type ||
      filters.rooms ||
      filters.district ||
      filters.price_min ||
      filters.price_max
  )

  const from = (page - 1) * CATALOG_PAGE_SIZE + 1
  const to = Math.min(page * CATALOG_PAGE_SIZE, total)

  return (
    <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-6">
      <div>
        <h1
          className="text-[30px] sm:text-[38px] font-bold tracking-tight leading-tight"
          style={{ color: 'var(--hp-ink)' }}
        >
          Каталог объектов
        </h1>
        <p className="mt-2 text-[15px]" style={{ color: 'var(--hp-sub)' }}>
          {total > 0
            ? `${total} ${pluralObjects(total)} в открытой публикации${
                total > CATALOG_PAGE_SIZE ? ` · показаны ${from}–${to}` : ''
              }`
            : 'Часть объектов мы не публикуем открыто — спросите агента о закрытой базе'}
        </p>
      </div>

      <CatalogFilters filters={filters} districts={districts} />

      {items.length === 0 ? (
        <div
          className="border text-center px-6 py-16"
          style={{
            background: 'var(--hp-surface)',
            borderColor: 'var(--hp-border)',
            borderRadius: 'var(--hp-radius)',
          }}
        >
          <div
            className="w-14 h-14 mx-auto flex items-center justify-center border"
            style={{
              background: 'var(--hp-neutral-tint)',
              borderColor: 'var(--hp-border)',
              borderRadius: 'var(--hp-radius)',
            }}
          >
            <Building2 style={{ width: 24, height: 24, color: 'var(--hp-sub)' }} />
          </div>
          <p className="mt-4 text-[17px] font-bold" style={{ color: 'var(--hp-ink)' }}>
            {hasActiveFilters ? 'По этим параметрам ничего не нашлось' : 'Открытых публикаций пока нет'}
          </p>
          <p className="mt-2 text-[14px] max-w-[520px] mx-auto leading-relaxed" style={{ color: 'var(--hp-sub)' }}>
            {hasActiveFilters
              ? 'Попробуйте расширить диапазон цены или убрать фильтр по району — либо оставьте заявку, и агент проверит закрытую базу.'
              : 'Часть квартир собственники просят не выкладывать в открытый доступ. Опишите, что ищете, — подберём варианты вручную.'}
          </p>
          <div className="mt-5 flex items-center justify-center gap-3 flex-wrap">
            {hasActiveFilters && (
              <Link href="/catalog" className="hp-btn-secondary h-11">
                Сбросить фильтры
              </Link>
            )}
            <Link href="/kontakty" className="hp-btn-primary h-11">
              Оставить заявку на подбор
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map(property => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>

          {pageCount > 1 && (
            <nav className="flex items-center justify-center gap-2 flex-wrap pt-4" aria-label="Страницы каталога">
              {page > 1 && (
                <Link href={pageHref(filters, page - 1)} className="hp-btn-secondary h-10">
                  Назад
                </Link>
              )}
              {Array.from({ length: pageCount }, (_, i) => i + 1).map(n => (
                <Link
                  key={n}
                  href={pageHref(filters, n)}
                  aria-current={n === page ? 'page' : undefined}
                  className="w-10 h-10 flex items-center justify-center text-[13.5px] font-semibold border transition-colors"
                  style={{
                    borderRadius: 'var(--hp-radius)',
                    background: n === page ? 'var(--hp-accent-tint)' : 'var(--hp-surface)',
                    borderColor: n === page ? 'var(--hp-sub)' : 'var(--hp-border)',
                    color: 'var(--hp-ink)',
                  }}
                >
                  {n}
                </Link>
              ))}
              {page < pageCount && (
                <Link href={pageHref(filters, page + 1)} className="hp-btn-secondary h-10">
                  Вперёд
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </div>
  )
}
