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
const statusConfig: Record<string, { label: string; cls: string; dot: string }> = {
  available: { label: 'Свободен',     cls: 'text-green-700',  dot: 'bg-green-400' },
  reserved:  { label: 'Забронирован', cls: 'text-amber-700',  dot: 'bg-amber-400' },
  rented:    { label: 'Сдан',         cls: 'text-blue-700',   dot: 'bg-blue-400' },
  sold:      { label: 'Продан',       cls: 'text-slate-500',  dot: 'bg-slate-400' },
  inactive:  { label: 'Неактивен',    cls: 'text-red-600',    dot: 'bg-red-400' },
}
const dealBadgeColors: Record<string, string> = {
  rent:       'text-blue-700',
  sale:       'text-violet-700',
  management: 'text-orange-700',
  subrent:    'text-green-700',
}
const placeholderImages: Record<string, string> = {
  apartment: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400&h=250&fit=crop&auto=format',
  house:     'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=400&h=250&fit=crop&auto=format',
  commercial:'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=250&fit=crop&auto=format',
  office:    'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=400&h=250&fit=crop&auto=format',
  warehouse: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&h=250&fit=crop&auto=format',
  land:      'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=400&h=250&fit=crop&auto=format',
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

  if (params.search)    query = query.ilike('address', `%${params.search}%`)
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
          className="flex items-center gap-2 px-4 py-2.5 text-white rounded-xl text-sm font-semibold"
          style={{ background: 'linear-gradient(135deg, #16A34A, #22C55E)', boxShadow: '0 2px 8px rgba(22,163,74,0.3)' }}>
          <Plus style={{ width: 16, height: 16 }} />
          Добавить объект
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-[20px] border border-slate-200/60 shadow-sm p-4 flex flex-wrap gap-3">
        <form method="get" className="flex-1 min-w-64">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"
              style={{ width: 15, height: 15 }} />
            <input
              name="search"
              defaultValue={params.search}
              placeholder="Поиск по адресу..."
              className="w-full h-10 pl-10 pr-4 text-sm text-[#111827] placeholder:text-slate-400 outline-none bg-slate-50 border border-slate-200 rounded-xl focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all"
            />
          </div>
        </form>
        <div className="flex gap-2 flex-wrap">
          <Link href="/properties"
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${!params.deal_type ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            style={!params.deal_type ? { background: 'linear-gradient(135deg, #16A34A, #22C55E)' } : {}}>
            Все
          </Link>
          {Object.entries(dealLabels).map(([value, label]) => (
            <Link key={value} href={`/properties?deal_type=${value}`}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${params.deal_type === value ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              style={params.deal_type === value ? { background: 'linear-gradient(135deg, #16A34A, #22C55E)' } : {}}>
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* Grid */}
      {!properties || properties.length === 0 ? (
        <div className="bg-white rounded-[20px] border border-slate-200/60 shadow-sm text-center py-20">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Home style={{ width: 24, height: 24 }} className="text-slate-400" />
          </div>
          <p className="text-[#374151] font-semibold text-lg">Нет объектов</p>
          <p className="text-[#64748B] text-sm mt-1">
            {error ? `Ошибка: ${error.message}` : 'Добавьте первый объект недвижимости'}
          </p>
          <Link href="/properties/new"
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-semibold"
            style={{ background: 'linear-gradient(135deg, #16A34A, #22C55E)', boxShadow: '0 2px 8px rgba(22,163,74,0.3)' }}>
            <Plus style={{ width: 16, height: 16 }} />
            Добавить объект
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {properties.map(property => {
            const status   = statusConfig[property.status]   ?? statusConfig.inactive
            const dealColor = dealBadgeColors[property.deal_type] ?? 'text-slate-600'
            const imgSrc   = placeholderImages[property.property_type] ?? placeholderImages.apartment

            return (
              <Link key={property.id} href={`/properties/${property.id}`}
                className="group block bg-white rounded-[20px] border border-slate-200/60 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-200 overflow-hidden">

                {/* Photo */}
                <div className="relative h-44 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imgSrc} alt={property.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40" />

                  {/* Status badge */}
                  <div className="absolute top-3 left-3">
                    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/90 backdrop-blur-sm ${status.cls}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                      {status.label}
                    </span>
                  </div>

                  {/* Deal type badge */}
                  <div className="absolute top-3 right-3">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/90 backdrop-blur-sm ${dealColor}`}>
                      {dealLabels[property.deal_type] ?? property.deal_type}
                    </span>
                  </div>

                  {/* Price */}
                  {property.price && (
                    <div className="absolute bottom-3 left-3">
                      <span className="text-white font-bold text-lg drop-shadow-md">
                        {Number(property.price).toLocaleString('ru-RU')} ₽
                      </span>
                    </div>
                  )}
                </div>

                {/* Card body */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-[#111827] text-sm leading-snug group-hover:text-green-600 transition-colors">
                      {property.title}
                    </h3>
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-600 shrink-0">
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
                  <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
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
