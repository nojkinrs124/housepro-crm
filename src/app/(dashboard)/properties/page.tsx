import { createClient } from '@/lib/supabase/server'
import { Home, Plus, Search } from 'lucide-react'
import Link from 'next/link'

const typeLabels: Record<string, string> = {
  apartment: 'Квартира',
  house: 'Дом',
  commercial: 'Коммерция',
  office: 'Офис',
  warehouse: 'Склад',
  land: 'Участок',
}

const dealLabels: Record<string, string> = {
  rent: 'Аренда',
  sale: 'Продажа',
  management: 'Управление',
  subrent: 'Субаренда',
}

const statusColors: Record<string, string> = {
  available: 'bg-green-100 text-green-700',
  reserved: 'bg-yellow-100 text-yellow-700',
  rented: 'bg-blue-100 text-blue-700',
  sold: 'bg-gray-100 text-gray-600',
  inactive: 'bg-red-100 text-red-700',
}

const statusLabels: Record<string, string> = {
  available: 'Свободен',
  reserved: 'Забронирован',
  rented: 'Сдан',
  sold: 'Продан',
  inactive: 'Неактивен',
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; deal_type?: string; property_type?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('properties')
    .select('*, manager:users(full_name)')
    .order('created_at', { ascending: false })

  if (params.search) {
    query = query.ilike('address', `%${params.search}%`)
  }
  if (params.deal_type) query = query.eq('deal_type', params.deal_type)
  if (params.property_type) query = query.eq('property_type', params.property_type)

  const { data: properties } = await query.limit(50)

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Объекты недвижимости</h1>
          <p className="text-muted-foreground mt-1">{properties?.length ?? 0} объектов</p>
        </div>
        <Link
          href="/properties/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all"
        >
          <Plus className="w-4 h-4" />
          Добавить объект
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex flex-wrap gap-3">
          <form method="get" className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                name="search"
                defaultValue={params.search}
                placeholder="Поиск по адресу..."
                className="w-full h-9 pl-9 pr-4 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>
          </form>
          <div className="flex gap-2">
            {Object.entries(dealLabels).map(([value, label]) => (
              <Link
                key={value}
                href={`/properties?deal_type=${value}`}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  params.deal_type === value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      {!properties || properties.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl text-center py-16">
          <Home className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground font-medium">Нет объектов</p>
          <Link
            href="/properties/new"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all"
          >
            <Plus className="w-4 h-4" />
            Добавить объект
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map((property) => (
            <Link
              key={property.id}
              href={`/properties/${property.id}`}
              className="bg-card border border-border rounded-2xl p-5 hover:shadow-md hover:border-primary/30 transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                  <Home className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex gap-1.5">
                  <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground font-medium">
                    {typeLabels[property.property_type] ?? property.property_type}
                  </span>
                  <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">
                    {dealLabels[property.deal_type] ?? property.deal_type}
                  </span>
                </div>
              </div>

              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                {property.title}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">{property.address}</p>

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                <div>
                  {property.price && (
                    <p className="text-lg font-bold text-foreground">
                      {property.price.toLocaleString('ru-RU')} ₽
                    </p>
                  )}
                  {property.area && (
                    <p className="text-xs text-muted-foreground">{property.area} м²</p>
                  )}
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[property.status] ?? 'bg-gray-100'}`}>
                  {statusLabels[property.status] ?? property.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
