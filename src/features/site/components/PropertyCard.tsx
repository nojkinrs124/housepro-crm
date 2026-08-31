import Link from 'next/link'
import Image from 'next/image'
import { MapPin, Building2 } from 'lucide-react'
import type { PublicProperty } from '@/features/site/lib/properties'
import {
  DEAL_TYPE_SHORT,
  PROPERTY_TYPE_LABELS,
  STATUS_BADGE,
  STATUS_LABELS,
  formatArea,
  formatPrice,
  floorLine,
  label,
  priceSuffix,
  roomsShort,
} from '@/features/site/lib/labels'

/**
 * Карточка объекта в каталоге и в подборке на главной.
 * Форма карточки — рамка + плоский тон, ровно как в CRM: ни теней, ни
 * подъёма при hover, ни скруглений (radius в системе = 0).
 */
export function PropertyCard({ property }: { property: PublicProperty }) {
  const photo = property.photo_urls?.[0] ?? null
  const price = formatPrice(property.price)
  const facts = [
    roomsShort(property.rooms),
    formatArea(property.area),
    floorLine(property.floor, property.total_floors),
  ].filter(Boolean) as string[]

  return (
    <Link
      href={`/catalog/${property.id}`}
      className="group flex flex-col h-full border transition-colors"
      style={{
        background: 'var(--hp-surface)',
        borderColor: 'var(--hp-border)',
        borderRadius: 'var(--hp-radius)',
      }}
    >
      <div className="relative w-full aspect-[4/3] overflow-hidden" style={{ background: 'var(--hp-neutral-tint)' }}>
        {photo ? (
          <Image
            src={photo}
            alt={property.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 380px"
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <Building2 style={{ width: 26, height: 26, color: 'var(--hp-tertiary)' }} />
            <span className="text-[11px] font-medium" style={{ color: 'var(--hp-tertiary)' }}>
              Фото по запросу
            </span>
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="hp-badge hp-badge-neutral">
            {DEAL_TYPE_SHORT[property.deal_type] ?? property.deal_type}
          </span>
          <span className={`hp-badge ${STATUS_BADGE[property.status] ?? 'hp-badge-neutral'}`}>
            {STATUS_LABELS[property.status] ?? property.status}
          </span>
        </div>

        <h3
          className="mt-3 text-[16px] font-bold leading-snug break-words transition-colors group-hover:opacity-75"
          style={{ color: 'var(--hp-ink)' }}
        >
          {property.title}
        </h3>

        <div className="mt-1.5 flex items-start gap-1.5 min-w-0">
          <MapPin style={{ width: 13, height: 13, marginTop: 3, flexShrink: 0, color: 'var(--hp-tertiary)' }} />
          <p className="text-[13px] leading-snug break-words" style={{ color: 'var(--hp-sub)' }}>
            {property.address}
          </p>
        </div>

        {facts.length > 0 && (
          <p className="mt-2.5 text-[13px]" style={{ color: 'var(--hp-sub)' }}>
            {facts.join(' · ')}
          </p>
        )}

        <div
          className="mt-auto pt-3.5 flex items-baseline justify-between gap-3 border-t"
          style={{ borderColor: 'var(--hp-border-soft)' }}
        >
          {price ? (
            <p className="text-[19px] font-bold" style={{ color: 'var(--hp-ink)' }}>
              {price}
              <span className="text-[13px] font-medium" style={{ color: 'var(--hp-sub)' }}>
                {priceSuffix(property.deal_type)}
              </span>
            </p>
          ) : (
            <p className="text-[14px] font-semibold" style={{ color: 'var(--hp-sub)' }}>
              Цена по запросу
            </p>
          )}
          <span className="text-[12.5px] font-medium shrink-0" style={{ color: 'var(--hp-tertiary)' }}>
            {label(PROPERTY_TYPE_LABELS, property.property_type)}
          </span>
        </div>
      </div>
    </Link>
  )
}
