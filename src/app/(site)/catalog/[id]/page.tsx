import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, MapPin, Phone } from 'lucide-react'
import { LeadForm } from '@/features/site/components/LeadForm'
import { PropertyGallery } from '@/features/site/components/PropertyGallery'
import { fetchPublicProperty, type PublicProperty } from '@/features/site/lib/properties'
import { getSiteContacts } from '@/features/site/lib/contacts'
import {
  DEAL_TYPE_LABELS,
  HEATING_LABELS,
  HOUSE_TYPE_LABELS,
  PROPERTY_TYPE_LABELS,
  STATUS_BADGE,
  STATUS_LABELS,
  WALL_MATERIAL_LABELS,
  WATER_LABELS,
  floorLine,
  formatArea,
  formatPrice,
  formatRooms,
  label,
  priceSuffix,
} from '@/features/site/lib/labels'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const property = await fetchPublicProperty(id)
  if (!property) return { title: 'Объект не найден — ХаусПро' }

  const parts = [
    label(DEAL_TYPE_LABELS, property.deal_type),
    formatArea(property.area),
    formatPrice(property.price),
  ].filter(Boolean)

  return {
    title: `${property.title} — ХаусПро, Красноярск`,
    description:
      property.description?.slice(0, 300) ??
      `${property.address}. ${parts.join(', ')}. Показ и оформление сделки с агентством недвижимости ХаусПро.`,
  }
}

interface Row {
  label: string
  value: string
}

function buildSpecs(p: PublicProperty): { title: string; rows: Row[] }[] {
  const push = (rows: Row[], name: string, value: string | null | undefined) => {
    if (value) rows.push({ label: name, value })
  }

  const main: Row[] = []
  push(main, 'Тип объекта', label(PROPERTY_TYPE_LABELS, p.property_type))
  push(main, 'Тип сделки', label(DEAL_TYPE_LABELS, p.deal_type))
  push(main, 'Комнат', formatRooms(p.rooms))
  push(main, 'Общая площадь', formatArea(p.area))
  push(main, 'Жилая площадь', formatArea(p.living_area))
  push(main, 'Кухня', formatArea(p.kitchen_area))
  push(main, 'Этаж', floorLine(p.floor, p.total_floors))
  push(main, 'Высота потолков', p.ceiling_height ? `${p.ceiling_height} м` : null)
  push(main, 'Район', p.district)

  const house: Row[] = []
  push(house, 'Тип дома', label(HOUSE_TYPE_LABELS, p.house_type))
  push(house, 'Материал стен', label(WALL_MATERIAL_LABELS, p.wall_material))
  push(house, 'Год постройки', p.year_built ? String(p.year_built) : null)
  if (p.has_elevator !== null) push(house, 'Лифт', p.has_elevator ? 'Есть' : 'Нет')
  if (p.has_parking !== null) push(house, 'Парковка', p.has_parking ? 'Есть' : 'Нет')

  const comms: Row[] = []
  push(comms, 'Отопление', label(HEATING_LABELS, p.heating_type))
  push(comms, 'Водоснабжение', label(WATER_LABELS, p.water_supply_type))
  if (p.has_internet !== null) push(comms, 'Интернет', p.has_internet ? 'Подключён' : 'Нет')
  if (p.has_tv !== null) push(comms, 'Телевидение', p.has_tv ? 'Подключено' : 'Нет')

  return [
    { title: 'Характеристики', rows: main },
    { title: 'Дом', rows: house },
    { title: 'Коммуникации', rows: comms },
  ].filter(section => section.rows.length > 0)
}

export default async function PublicPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [property, contacts] = await Promise.all([fetchPublicProperty(id), getSiteContacts()])

  if (!property) notFound()

  const specs = buildSpecs(property)
  const price = formatPrice(property.price)
  const deposit = formatPrice(property.deposit)
  const photos = (property.photo_urls ?? []).filter(Boolean)
  const isAvailable = property.status === 'available'

  return (
    <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
      <Link href="/catalog" className="hp-back-link">
        <ArrowLeft style={{ width: 15, height: 15 }} />
        Все объекты
      </Link>

      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="hp-badge hp-badge-neutral">
            {label(DEAL_TYPE_LABELS, property.deal_type)}
          </span>
          <span className={`hp-badge ${STATUS_BADGE[property.status] ?? 'hp-badge-neutral'}`}>
            {STATUS_LABELS[property.status] ?? property.status}
          </span>
        </div>
        <h1
          className="mt-3 text-[28px] sm:text-[36px] font-bold tracking-tight leading-tight break-words"
          style={{ color: 'var(--hp-ink)' }}
        >
          {property.title}
        </h1>
        <p className="mt-2 flex items-start gap-2 text-[15px]" style={{ color: 'var(--hp-sub)' }}>
          <MapPin style={{ width: 15, height: 15, marginTop: 3, flexShrink: 0, color: 'var(--hp-tertiary)' }} />
          <span className="break-words">{property.address}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-6 items-start">
        {/* ── Левая колонка: фото, описание, характеристики ─────────── */}
        <div className="min-w-0 space-y-6">
          <PropertyGallery photos={photos} title={property.title} />

          {property.description && (
            <section
              className="border p-5"
              style={{
                background: 'var(--hp-surface)',
                borderColor: 'var(--hp-border)',
                borderRadius: 'var(--hp-radius)',
              }}
            >
              <h2 className="text-[17px] font-bold" style={{ color: 'var(--hp-ink)' }}>
                Об объекте
              </h2>
              <p
                className="mt-3 text-[14.5px] leading-relaxed whitespace-pre-line break-words"
                style={{ color: 'var(--hp-sub)' }}
              >
                {property.description}
              </p>
            </section>
          )}

          {specs.map(section => (
            <div key={section.title} className="hp-block">
              <div className="hp-block-header">{section.title}</div>
              {section.rows.map(row => (
                <div key={row.label} className="hp-block-row">
                  <span className="label">{row.label}</span>
                  <span className="value break-words">{row.value}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* ── Правая колонка: цена и заявка ─────────────────────────── */}
        <aside className="min-w-0 space-y-4 lg:sticky lg:top-20">
          <div
            className="border p-5"
            style={{
              background: 'var(--hp-surface)',
              borderColor: 'var(--hp-border)',
              borderRadius: 'var(--hp-radius)',
            }}
          >
            {price ? (
              <p className="text-[28px] font-bold leading-none" style={{ color: 'var(--hp-ink)' }}>
                {price}
                <span className="text-[15px] font-medium" style={{ color: 'var(--hp-sub)' }}>
                  {priceSuffix(property.deal_type)}
                </span>
              </p>
            ) : (
              <p className="text-[19px] font-bold" style={{ color: 'var(--hp-ink)' }}>
                Цена по запросу
              </p>
            )}

            {deposit && (
              <p className="mt-2 text-[13.5px]" style={{ color: 'var(--hp-sub)' }}>
                Залог {deposit}
              </p>
            )}

            {!isAvailable && (
              <p
                className="mt-4 px-3.5 py-2.5 text-[13px] leading-relaxed border"
                style={{
                  background: 'var(--hp-warn-tint)',
                  borderColor: 'var(--hp-warn)',
                  color: 'var(--hp-warn)',
                  borderRadius: 'var(--hp-radius)',
                }}
              >
                Объект уже {STATUS_LABELS[property.status]?.toLowerCase() ?? 'занят'}. Оставьте
                заявку — подберём похожие варианты в том же районе и бюджете.
              </p>
            )}

            <a
              href={contacts.phoneHref}
              className="hp-btn-secondary w-full justify-center h-11 mt-4"
            >
              <Phone style={{ width: 15, height: 15 }} />
              {contacts.phone}
            </a>
            <p className="mt-3 text-[12.5px] leading-relaxed" style={{ color: 'var(--hp-tertiary)' }}>
              Перед показом агент подтверждает, что объект свободен, и проверяет документы
              собственника.
            </p>
          </div>

          <div
            className="border p-5"
            style={{
              background: 'var(--hp-surface)',
              borderColor: 'var(--hp-border)',
              borderRadius: 'var(--hp-radius)',
            }}
          >
            <h2 className="text-[17px] font-bold" style={{ color: 'var(--hp-ink)' }}>
              Записаться на показ
            </h2>
            <p className="mt-1.5 mb-4 text-[13.5px] leading-relaxed" style={{ color: 'var(--hp-sub)' }}>
              Заявка попадёт агенту вместе с этим объектом — повторять адрес не нужно.
            </p>
            <LeadForm
              propertyId={property.id}
              compact
              submitLabel="Записаться на показ"
              defaultMessage={`Интересует объект: ${property.title}`}
            />
          </div>
        </aside>
      </div>
    </div>
  )
}
