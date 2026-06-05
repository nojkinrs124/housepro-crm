import { createClient } from '@/lib/supabase/server'
import { Home, Plus, Search, MapPin, Maximize2, DoorOpen } from 'lucide-react'
import Link from 'next/link'

const typeLabels: Record<string, string> = {
  apartment: 'Квартира', house: 'Дом', commercial: 'Коммерция',
  office: 'Офис', warehouse: 'Склад', land: 'Участок',
}
const dealLabels: Record<string, string> = {
  rent: 'Аренда', sale: 'Продажа', management: 'Управление', subrent: 'Субаренда',
}
const statusConfig: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  available: { label: 'Свободен',     bg: '#F0FDF4', color: '#16A34A', dot: '#22C55E' },
  reserved:  { label: 'Забронирован', bg: '#FFFBEB', color: '#D97706', dot: '#F59E0B' },
  rented:    { label: 'Сдан',         bg: '#EFF6FF', color: '#2563EB', dot: '#60A5FA' },
  sold:      { label: 'Продан',       bg: '#F8FAFC', color: '#64748B', dot: '#94A3B8' },
  inactive:  { label: 'Неактивен',    bg: '#FEF2F2', color: '#DC2626', dot: '#F87171' },
}
const dealBadgeColors: Record<string, { bg: string; color: string }> = {
  rent:       { bg: '#EFF6FF', color: '#2563EB' },
  sale:       { bg: '#F5F3FF', color: '#7C3AED' },
  management: { bg: '#FFF7ED', color: '#EA580C' },
  subrent:    { bg: '#F0FDF4', color: '#16A34A' },
}

// Placeholder images for properties
const placeholderImages: Record<string, string> = {
  apartment: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400&h=250&fit=crop&auto=format',
  house:     'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=400&h=250&fit=crop&auto=format',
  commercial:'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=250&fit=crop&auto=format',
  office:    'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=400&h=250&fit=crop&auto=format',
  warehouse: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&h=250&fit=crop&auto=format',
  land:      'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=400&h=250&fit=crop&auto=format',
}

const cardStyle = {
  background: '#ffffff',
  borderRadius: '20px',
  border: '1px solid rgba(214,219,235,0.6)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05)',
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; deal_type?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('properties')
    .select('id, title, property_type, deal_type, address, price, area, rooms, status, created_at')
    .order('created_at', { ascending: false })

  if (params.search) query = query.ilike('address', `%${params.search}%`)
  if (params.deal_type) query = query.eq('deal_type', params.deal_type)

  const { data: properties, error } = await query.limit(50)

  if (error) console.error('Properties error:', error.message)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111827] tracking-tight">Объекты недвижимости</h1>
          <p className="text-[#64748B] mt-1 text-sm">{properties?.length ?? 0} объектов в базе</p>
        </div>
        <Link href="/properties/new"
          className="flex items-center gap-2 px-4 py-2.5 text-white rounded-[12px] text-sm font-semibold transition-all duration-200"
          style={{
            background: 'linear-gradient(135deg, #16A34A, #22C55E)',
            boxShadow: '0 2px 8px rgba(22,163,74,0.3)',
          }}
          onMouseEnter={() => {}}
        >
          <Plus style={{ width: 16, height: 16 }} />
          Добавить объект
        </Link>
      </div>

      {/* Filters */}
      <div style={cardStyle} className="p-4 flex flex-wrap gap-3">
        <form method="get" className="flex-1 min-w-64">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ width: 15, height: 15, color: '#94A3B8' }} />
            <input
              name="search"
              defaultValue={params.search}
              placeholder="Поиск по адресу или названию..."
              className="w-full h-10 pl-10 pr-4 text-sm text-[#111827] placeholder:text-[#94A3B8] outline-none transition-all duration-200"
              style={{
                background: '#F8FAFC',
                border: '1.5px solid rgba(214,219,235,0.8)',
                borderRadius: '10px',
              }}
            />
          </div>
        </form>
        <div className="flex gap-2 flex-wrap">
          <Link href="/properties"
            className="px-4 py-2 rounded-[10px] text-sm font-semibold transition-all duration-200"
            style={{
              background: !params.deal_type ? 'linear-gradient(135deg, #16A34A, #22C55E)' : '#F1F5F9',
              color: !params.deal_type ? '#ffffff' : '#64748B',
            }}>
            Все
          </Link>
          {Object.entries(dealLabels).map(([value, label]) => (
            <Link key={value} href={`/properties?deal_type=${value}`}
              className="px-4 py-2 rounded-[10px] text-sm font-semibold transition-all duration-200"
              style={{
                background: params.deal_type === value ? 'linear-gradient(135deg, #16A34A, #22C55E)' : '#F1F5F9',
                color: params.deal_type === value ? '#ffffff' : '#64748B',
              }}>
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* Grid */}
      {!properties || properties.length === 0 ? (
        <div style={cardStyle} className="text-center py-20">
          <div className="w-16 h-16 rounded-full bg-[#F1F5F9] flex items-center justify-center mx-auto mb-4">
            <Home style={{ width: 24, height: 24, color: '#94A3B8' }} />
          </div>
          <p className="text-[#374151] font-semibold text-lg">Нет объектов</p>
          <p className="text-[#64748B] text-sm mt-1">
            {error ? `Ошибка: ${error.message}` : 'Добавьте первый объект недвижимости'}
          </p>
          <Link href="/properties/new"
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 text-white rounded-[12px] text-sm font-semibold"
            style={{ background: 'linear-gradient(135deg, #16A34A, #22C55E)', boxShadow: '0 2px 8px rgba(22,163,74,0.3)' }}>
            <Plus style={{ width: 16, height: 16 }} />
            Добавить объект
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {properties.map(property => {
            const status = statusConfig[property.status] ?? statusConfig.inactive
            const dealBadge = dealBadgeColors[property.deal_type] ?? { bg: '#F8FAFC', color: '#64748B' }
            const imgSrc = placeholderImages[property.property_type] ?? placeholderImages.apartment

            return (
              <Link
                key={property.id}
                href={`/properties/${property.id}`}
                className="group block overflow-hidden transition-all duration-300"
                style={{
                  ...cardStyle,
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement
                  el.style.transform = 'translateY(-3px)'
                  el.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08), 0 20px 40px rgba(0,0,0,0.1)'
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLElement
                  el.style.transform = 'translateY(0)'
                  el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05)'
                }}
              >
                {/* Photo */}
                <div className="relative h-44 overflow-hidden" style={{ borderRadius: '20px 20px 0 0' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imgSrc}
                    alt={property.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {/* Gradient overlay */}
                  <div className="absolute inset-0" style={{
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0) 40%, rgba(0,0,0,0.4) 100%)'
                  }} />

                  {/* Status badge */}
                  <div className="absolute top-3 left-3">
                    <span
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                      style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)', color: status.color }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: status.dot }} />
                      {status.label}
                    </span>
                  </div>

                  {/* Deal type badge */}
                  <div className="absolute top-3 right-3">
                    <span
                      className="px-2.5 py-1 rounded-full text-[11px] font-semibold"
                      style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)', color: dealBadge.color }}
                    >
                      {dealLabels[property.deal_type] ?? property.deal_type}
                    </span>
                  </div>

                  {/* Price on photo */}
                  {property.price && (
                    <div className="absolute bottom-3 left-3">
                      <span className="text-white font-bold text-lg" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
                        {Number(property.price).toLocaleString('ru-RU')} ₽
                      </span>
                    </div>
                  )}
                </div>

                {/* Card body */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-[#111827] text-sm leading-snug group-hover:text-[#16A34A] transition-colors">
                      {property.title}
                    </h3>
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full font-semibold shrink-0"
                      style={{ background: '#F1F5F9', color: '#64748B' }}
                    >
                      {typeLabels[property.property_type] ?? property.property_type}
                    </span>
                  </div>

                  {property.address && (
                    <div className="flex items-center gap-1.5 text-xs text-[#64748B] mb-3">
                      <MapPin style={{ width: 12, height: 12, flexShrink: 0 }} />
                      <span className="truncate">{property.address}</span>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="flex items-center gap-3 pt-3" style={{ borderTop: '1px solid rgba(214,219,235,0.6)' }}>
                    {property.area && (
                      <div className="flex items-center gap-1 text-xs text-[#64748B]">
                        <Maximize2 style={{ width: 12, height: 12 }} />
                        <span className="font-medium">{property.area} м²</span>
                      </div>
                    )}
                    {property.rooms && (
                      <div className="flex items-center gap-1 text-xs text-[#64748B]">
                        <DoorOpen style={{ width: 12, height: 12 }} />
                        <span className="font-medium">{property.rooms} комн.</span>
                      </div>
                    )}
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
