import { createClient } from '@/lib/supabase/server'
import { Home, Plus, Search, MapPin, Maximize2, DoorOpen, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

const typeLabels: Record<string, string> = {
  apartment: 'Квартира', house: 'Дом', commercial: 'Коммерция',
  office: 'Офис', warehouse: 'Склад', land: 'Участок',
}
const dealLabels: Record<string, string> = {
  rent: 'Аренда', sale: 'Продажа', management: 'Управление', subrent: 'Субаренда',
}
const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  available: { label: 'Свободен',     bg: 'rgba(255,255,255,0.92)', text: '#16A34A', dot: '#22C55E' },
  reserved:  { label: 'Забронирован', bg: 'rgba(255,255,255,0.92)', text: '#D97706', dot: '#F59E0B' },
  rented:    { label: 'Сдан',         bg: 'rgba(255,255,255,0.92)', text: '#2563EB', dot: '#3B82F6' },
  sold:      { label: 'Продан',       bg: 'rgba(255,255,255,0.92)', text: '#64748B', dot: '#94A3B8' },
  inactive:  { label: 'Неактивен',    bg: 'rgba(255,255,255,0.92)', text: '#DC2626', dot: '#EF4444' },
}
const dealBadgeConfig: Record<string, { text: string; bg: string }> = {
  rent:       { text: '#2563EB', bg: 'rgba(255,255,255,0.92)' },
  sale:       { text: '#7C3AED', bg: 'rgba(255,255,255,0.92)' },
  management: { text: '#D97706', bg: 'rgba(255,255,255,0.92)' },
  subrent:    { text: '#16A34A', bg: 'rgba(255,255,255,0.92)' },
}
const placeholderImages: Record<string, string> = {
  apartment: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&h=360&fit=crop&auto=format',
  house:     'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=600&h=360&fit=crop&auto=format',
  commercial:'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=360&fit=crop&auto=format',
  office:    'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=600&h=360&fit=crop&auto=format',
  warehouse: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&h=360&fit=crop&auto=format',
  land:      'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600&h=360&fit=crop&auto=format',
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
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-[#111827] tracking-tight">Объекты недвижимости</h1>
          <p className="text-[#64748B] mt-1 text-sm font-medium">{properties?.length ?? 0} объектов в базе</p>
        </div>
        <Link href="/properties/new"
          className="flex items-center gap-2 px-5 py-2.5 text-white rounded-[14px] text-sm font-bold transition-all hover:-translate-y-0.5"
          style={{ background: 'linear-gradient(135deg, #16A34A, #22C55E)', boxShadow: '0 4px 16px rgba(22,163,74,0.35)' }}>
          <Plus style={{ width: 16, height: 16 }} />
          Добавить объект
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-[20px] border border-slate-100 p-4 flex flex-wrap gap-3 items-center"
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}>
        <form method="get" className="flex-1 min-w-52">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"
              style={{ width: 14, height: 14 }} />
            <input
              name="search"
              defaultValue={params.search}
              placeholder="Поиск по адресу..."
              className="w-full h-[42px] pl-10 pr-4 text-sm text-[#111827] placeholder:text-slate-400 outline-none bg-[#F8FAFC] border border-slate-200 rounded-[12px] focus:border-[#22C55E] focus:ring-2 focus:ring-green-100 transition-all font-medium"
            />
          </div>
        </form>
        <div className="flex gap-2 flex-wrap">
          <Link href="/properties"
            className="px-4 py-2 rounded-[12px] text-sm font-bold transition-all"
            style={!params.deal_type
              ? { background: 'linear-gradient(135deg, #16A34A, #22C55E)', color: '#fff' }
              : { background: '#F8FAFC', color: '#64748B' }}>
            Все
          </Link>
          {Object.entries(dealLabels).map(([value, label]) => (
            <Link key={value} href={`/properties?deal_type=${value}`}
              className="px-4 py-2 rounded-[12px] text-sm font-bold transition-all"
              style={params.deal_type === value
                ? { background: 'linear-gradient(135deg, #16A34A, #22C55E)', color: '#fff' }
                : { background: '#F8FAFC', color: '#64748B' }}>
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* Grid */}
      {!properties || properties.length === 0 ? (
        <div className="bg-white rounded-[20px] border border-slate-100 text-center py-24"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}>
          <div className="w-16 h-16 rounded-[20px] flex items-center justify-center mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg, rgba(22,163,74,0.1), rgba(34,197,94,0.1))' }}>
            <Home style={{ width: 28, height: 28, color: '#16A34A' }} />
          </div>
          <p className="text-[#111827] font-bold text-lg">Нет объектов</p>
          <p className="text-[#64748B] text-sm mt-1">
            {error ? `Ошибка: ${error.message}` : 'Добавьте первый объект недвижимости'}
          </p>
          <Link href="/properties/new"
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 text-white rounded-[14px] text-sm font-bold hover:-translate-y-0.5 transition-all"
            style={{ background: 'linear-gradient(135deg, #16A34A, #22C55E)', boxShadow: '0 4px 16px rgba(22,163,74,0.35)' }}>
            <Plus style={{ width: 16, height: 16 }} />
            Добавить объект
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {properties.map(property => {
            const status   = statusConfig[property.status]   ?? statusConfig.inactive
            const dealCfg  = dealBadgeConfig[property.deal_type] ?? { text: '#64748B', bg: 'rgba(255,255,255,0.92)' }
            const imgSrc   = placeholderImages[property.property_type] ?? placeholderImages.apartment

            return (
              <Link key={property.id} href={`/properties/${property.id}`}
                className="group block bg-white rounded-[20px] border border-slate-100 overflow-hidden transition-all duration-300 hover:-translate-y-1"
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}
              >
                {/* Photo */}
                <div className="relative h-52 overflow-hidden bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imgSrc} alt={property.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

                  {/* Status badge — top left */}
                  <div className="absolute top-3 left-3">
                    <span
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold backdrop-blur-md"
                      style={{ background: status.bg, color: status.text }}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ background: status.dot }} />
                      {status.label}
                    </span>
                  </div>

                  {/* Deal type — top right */}
                  <div className="absolute top-3 right-3">
                    <span
                      className="px-3 py-1.5 rounded-full text-[11px] font-bold backdrop-blur-md"
                      style={{ background: dealCfg.bg, color: dealCfg.text }}
                    >
                      {dealLabels[property.deal_type] ?? property.deal_type}
                    </span>
                  </div>

                  {/* Price — bottom left over gradient */}
                  {property.price && (
                    <div className="absolute bottom-3 left-4">
                      <span className="text-white font-bold text-xl drop-shadow-lg tracking-tight">
                        {Number(property.price).toLocaleString('ru-RU')} ₽
                      </span>
                      {property.deal_type === 'rent' && (
                        <span className="text-white/80 text-xs font-medium ml-1">/мес</span>
                      )}
                    </div>
                  )}

                  {/* Property type chip — bottom right */}
                  <div className="absolute bottom-3 right-3">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold text-white/90 backdrop-blur-sm"
                      style={{ background: 'rgba(0,0,0,0.35)' }}>
                      {typeLabels[property.property_type] ?? property.property_type}
                    </span>
                  </div>
                </div>

                {/* Card body */}
                <div className="p-4">
                  <h3 className="font-bold text-[#111827] text-[15px] leading-snug group-hover:text-[#16A34A] transition-colors mb-2">
                    {property.title}
                  </h3>

                  {property.address && (
                    <div className="flex items-center gap-1.5 text-xs text-[#64748B] mb-3">
                      <MapPin style={{ width: 12, height: 12, flexShrink: 0, color: '#94A3B8' }} />
                      <span className="truncate font-medium">{property.address}</span>
                    </div>
                  )}

                  {/* Stats row */}
                  <div className="flex items-center gap-4 pt-3 border-t border-slate-100">
                    {property.area && (
                      <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
                        <div className="w-6 h-6 rounded-lg bg-slate-50 flex items-center justify-center">
                          <Maximize2 style={{ width: 11, height: 11, color: '#94A3B8' }} />
                        </div>
                        <span className="font-semibold text-[#374151]">{property.area}</span>
                        <span className="text-[#94A3B8]">м²</span>
                      </div>
                    )}
                    {property.rooms && (
                      <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
                        <div className="w-6 h-6 rounded-lg bg-slate-50 flex items-center justify-center">
                          <DoorOpen style={{ width: 11, height: 11, color: '#94A3B8' }} />
                        </div>
                        <span className="font-semibold text-[#374151]">{property.rooms}</span>
                        <span className="text-[#94A3B8]">комн.</span>
                      </div>
                    )}
                    <div className="ml-auto">
                      <div className="w-8 h-8 rounded-[10px] flex items-center justify-center bg-green-50 text-green-600 group-hover:bg-green-600 group-hover:text-white transition-all">
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
