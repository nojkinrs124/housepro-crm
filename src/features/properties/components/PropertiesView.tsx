'use client'

import Link from 'next/link'
import { LayoutGrid, List, MapPin, Maximize2, DoorOpen, ArrowUpRight } from 'lucide-react'
import {
  PROPERTY_TYPE_LABELS as typeLabels,
  PROPERTY_DEAL_LABELS as dealLabels,
  PROPERTY_STATUS_LABELS,
} from '@/features/properties/config/property-labels'
import { PropertyAvitoQuickToggle } from '@/features/avito/components/PropertyAvitoQuickToggle'
import { PropertySiteQuickToggle } from '@/features/properties/components/PropertySiteQuickToggle'
import { toAvitoStatus } from '@/features/avito/config/status'
import { RegistryToolbar } from '@/components/layout/RegistryToolbar'
import { RegistryTable, type RegistryColumn } from '@/features/registry/components/RegistryTable'
import { BulkBar } from '@/features/registry/components/BulkBar'
import { useRegistryFilters } from '@/hooks/useRegistryFilters'
import { useSelection } from '@/hooks/useSelection'
import { usePersistedState } from '@/hooks/usePersistedFilters'
import { formatAmount } from '@/lib/utils'

export interface PropertyRow {
  id: string
  title: string
  property_type: string
  deal_type: string
  address: string | null
  price: number | null
  area: number | null
  rooms: number | null
  status: string
  floor: number | null
  total_floors: number | null
  avito_publish: boolean | null
  avito_status: string | null
  site_publish: boolean | null
}

type ViewMode = 'cards' | 'list'

const PLACEHOLDERS: Record<string, string> = {
  apartment:  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&h=360&fit=crop&auto=format',
  house:      'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=600&h=360&fit=crop&auto=format',
  commercial: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=360&fit=crop&auto=format',
  office:     'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=600&h=360&fit=crop&auto=format',
  warehouse:  'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&h=360&fit=crop&auto=format',
  land:       'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600&h=360&fit=crop&auto=format',
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'Статус: все' },
  ...Object.entries(PROPERTY_STATUS_LABELS).map(([value, s]) => ({ value, label: s.label })),
]
const DEAL_OPTIONS = [
  { value: 'all', label: 'Сделка: все' },
  ...Object.entries(dealLabels).map(([value, label]) => ({ value, label })),
]
const TYPE_OPTIONS = [
  { value: 'all', label: 'Тип: все' },
  ...Object.entries(typeLabels).map(([value, label]) => ({ value, label })),
]
const AVITO_OPTIONS = [
  { value: 'all',   label: 'Авито: все' },
  { value: 'true',  label: 'Опубликован' },
  { value: 'false', label: 'Не опубликован' },
]

const VIEWS = [
  { value: 'cards', label: 'Карточки', icon: LayoutGrid },
  { value: 'list',  label: 'Реестр',   icon: List },
]

export function PropertiesView({ properties }: { properties: PropertyRow[] }) {
  const [view, setView] = usePersistedState<ViewMode>('properties:view', 'cards')

  const { search, setSearch, filtered, toolbarFilters, reset } = useRegistryFilters(properties, {
    storageKey: 'properties',
    haystack: p => [p.title, p.address].filter(Boolean).join(' '),
    filters: [
      { key: 'status',    options: STATUS_OPTIONS, field: p => p.status },
      { key: 'deal_type', options: DEAL_OPTIONS,   field: p => p.deal_type },
      { key: 'type',      options: TYPE_OPTIONS,   field: p => p.property_type },
      { key: 'avito',     options: AVITO_OPTIONS,  field: p => String(!!p.avito_publish) },
    ],
  })

  const selection = useSelection(filtered)

  const columns: RegistryColumn<PropertyRow>[] = [
    {
      key: 'title', title: 'Объект', cellClass: 'font-semibold max-w-[260px]',
      cell: p => (
        <Link href={`/properties/${p.id}`} className="block truncate hover:text-[var(--hp-accent)] transition-colors">
          {p.title}
        </Link>
      ),
    },
    {
      key: 'address', title: 'Адрес', cellClass: 'sub max-w-[240px]', headClass: 'hidden md:table-cell',
      cell: p => <span className="block truncate">{p.address ?? <span className="text-[var(--hp-tertiary)]">—</span>}</span>,
    },
    {
      key: 'type', title: 'Тип', cellClass: 'sub whitespace-nowrap',
      cell: p => typeLabels[p.property_type] ?? p.property_type,
    },
    {
      key: 'deal', title: 'Сделка', cellClass: 'sub whitespace-nowrap', headClass: 'hidden lg:table-cell',
      cell: p => dealLabels[p.deal_type] ?? p.deal_type,
    },
    {
      key: 'params', title: 'Параметры', cellClass: 'sub whitespace-nowrap', headClass: 'hidden lg:table-cell',
      cell: p => [
        p.area ? `${p.area} м²` : null,
        p.rooms ? `${p.rooms} комн.` : null,
        p.floor ? `${p.floor}${p.total_floors ? `/${p.total_floors}` : ''} эт.` : null,
      ].filter(Boolean).join(' · ') || '—',
    },
    {
      key: 'status', title: 'Статус',
      cell: p => {
        const s = PROPERTY_STATUS_LABELS[p.status] ?? PROPERTY_STATUS_LABELS.inactive
        return <span className={`hp-badge ${s.badgeCls}`}>{s.label}</span>
      },
    },
    {
      key: 'price', title: 'Цена', cellClass: 'num font-semibold whitespace-nowrap',
      cell: p => p.price
        ? <>{formatAmount(p.price)} <span className="text-[var(--hp-tertiary)] font-normal">₽{p.deal_type === 'rent' ? '/мес' : ''}</span></>
        : <span className="text-[var(--hp-tertiary)] font-normal">—</span>,
    },
  ]

  return (
    <div className="space-y-4">
      <RegistryToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Поиск: название, адрес"
        filters={toolbarFilters}
        views={VIEWS}
        view={view}
        onViewChange={v => setView(v as ViewMode)}
        onReset={reset}
        foundLabel={<>Найдено: <span className="font-semibold text-[var(--hp-ink)]">{filtered.length}</span> из {properties.length}</>}
      />

      {/* Групповые действия — только в реестре: у карточек нет чекбоксов */}
      {view === 'list' && <BulkBar registry="properties" selection={selection} />}

      {/* Без AnimatePresence: mode="wait" ждал exit уходящего вида и при
          переключении с канбана на реестр новый вид не монтировался вовсе —
          таблица не появлялась ни через секунду, ни через шесть. */}
      {view === 'list' ? (
        <RegistryTable
          rows={filtered}
          columns={columns}
          href={p => `/properties/${p.id}`}
          selection={selection}
          empty="Нет объектов по выбранным фильтрам"
        />
      ) : filtered.length === 0 ? (
        <div className="hp-card hp-empty">
          <p className="text-[var(--hp-sub)] text-sm">Нет объектов по выбранным фильтрам</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(property => {
            const status = PROPERTY_STATUS_LABELS[property.status] ?? PROPERTY_STATUS_LABELS.inactive
            return (
              <Link key={property.id} href={`/properties/${property.id}`}
                className="group block hp-card overflow-hidden">
                <div className="relative h-52 overflow-hidden bg-[var(--hp-neutral-tint)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={PLACEHOLDERS[property.property_type] ?? PLACEHOLDERS.apartment} alt={property.title}
                    className="w-full h-full object-cover" />
                  <div className="absolute top-3 left-3">
                    <span className={`hp-badge ${status.badgeCls}`}>{status.label}</span>
                  </div>
                  <div className="absolute top-3 right-3">
                    <span className="hp-badge hp-badge-neutral">{dealLabels[property.deal_type] ?? property.deal_type}</span>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-foreground text-[15px] leading-snug group-hover:text-[var(--hp-accent)] transition-colors mb-2 truncate">
                    {property.title}
                  </h3>
                  {property.address && (
                    <div className="flex items-center gap-1.5 text-xs text-[var(--hp-sub)] mb-3">
                      <MapPin style={{ width: 12, height: 12, flexShrink: 0 }} className="text-[var(--hp-tertiary)]" />
                      <span className="truncate font-medium">{property.address}</span>
                    </div>
                  )}
                  {property.price && (
                    <p className="font-semibold text-foreground text-[15px] mb-3">
                      {formatAmount(property.price)} <span className="text-[var(--hp-tertiary)] font-normal">₽{property.deal_type === 'rent' ? '/мес' : ''}</span>
                    </p>
                  )}
                  <div className="flex items-center gap-4 pt-3 border-t border-[var(--hp-border-soft)]">
                    {property.area && (
                      <div className="flex items-center gap-1.5 text-xs text-[var(--hp-sub)]">
                        <Maximize2 style={{ width: 11, height: 11 }} className="text-[var(--hp-tertiary)]" />
                        <span className="font-semibold text-[var(--hp-ink)]">{property.area}</span>
                        <span className="text-[var(--hp-tertiary)]">м²</span>
                      </div>
                    )}
                    {property.rooms && (
                      <div className="flex items-center gap-1.5 text-xs text-[var(--hp-sub)]">
                        <DoorOpen style={{ width: 11, height: 11 }} className="text-[var(--hp-tertiary)]" />
                        <span className="font-semibold text-[var(--hp-ink)]">{property.rooms}</span>
                        <span className="text-[var(--hp-tertiary)]">комн.</span>
                      </div>
                    )}
                    <div className="ml-auto flex items-center gap-2">
                      <PropertyAvitoQuickToggle
                        propertyId={property.id}
                        isPublished={!!property.avito_publish}
                        status={toAvitoStatus(property.avito_status)}
                        eligible={property.status === 'available'}
                      />
                      <PropertySiteQuickToggle
                        propertyId={property.id}
                        isPublished={!!property.site_publish}
                      />
                      <div className="w-8 h-8 flex items-center justify-center bg-[var(--hp-neutral-tint)] border border-[var(--hp-border)] text-[var(--hp-sub)] group-hover:text-[var(--hp-ink)] transition-colors shrink-0">
                        <ArrowUpRight style={{ width: 15, height: 15 }} />
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
