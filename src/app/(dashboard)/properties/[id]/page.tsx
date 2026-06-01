import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, Home, MapPin, DollarSign, Ruler, Building, Edit } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FilesSection } from '@/features/files/components/FilesSection'

const typeLabels: Record<string, string> = {
  apartment: 'Квартира', house: 'Дом', commercial: 'Коммерция',
  office: 'Офис', warehouse: 'Склад', land: 'Участок',
}

const dealLabels: Record<string, string> = {
  rent: 'Аренда', sale: 'Продажа', management: 'Управление', subrent: 'Субаренда',
}

const statusColors: Record<string, string> = {
  available: 'bg-green-100 text-green-700',
  reserved: 'bg-yellow-100 text-yellow-700',
  rented: 'bg-blue-100 text-blue-700',
  sold: 'bg-gray-100 text-gray-600',
  inactive: 'bg-red-100 text-red-700',
}

const statusLabels: Record<string, string> = {
  available: 'Свободен', reserved: 'Забронирован',
  rented: 'Сдан', sold: 'Продан', inactive: 'Неактивен',
}

export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: property } = await supabase
    .from('properties')
    .select('*, manager:users(full_name)')
    .eq('id', id)
    .single()

  if (!property) notFound()

  const { data: contracts } = await supabase
    .from('contracts')
    .select('id, contract_number, contract_type, status, created_at')
    .eq('property_id', id)
    .order('created_at', { ascending: false })

  const manager = property.manager as { full_name?: string } | null

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href="/properties" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Все объекты
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center">
            <Home className="w-7 h-7 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{property.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                {typeLabels[property.property_type]}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                {dealLabels[property.deal_type]}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[property.status]}`}>
                {statusLabels[property.status]}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/properties/${id}/edit`}
            className="flex items-center gap-2 px-4 py-2.5 bg-muted text-foreground rounded-xl text-sm font-medium hover:bg-muted/80 transition-all">
            <Edit className="w-4 h-4" />
            Редактировать
          </Link>
          <Link href={`/contracts/new?property_id=${id}`}
            className="px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all">
            + Договор
          </Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Main info */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-semibold text-foreground mb-4">Характеристики</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Адрес</p>
                  <p className="text-sm font-medium text-foreground">{property.address}</p>
                </div>
              </div>
              {property.price && (
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Цена</p>
                    <p className="text-sm font-bold text-foreground">
                      {Number(property.price).toLocaleString('ru-RU')} ₽
                    </p>
                  </div>
                </div>
              )}
              {property.area && (
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                  <Ruler className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Площадь</p>
                    <p className="text-sm font-medium text-foreground">{property.area} м²</p>
                  </div>
                </div>
              )}
              {property.rooms && (
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                  <Building className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Комнат</p>
                    <p className="text-sm font-medium text-foreground">{property.rooms}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {property.description && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <h2 className="font-semibold text-foreground mb-3">Описание</h2>
              <p className="text-sm text-foreground leading-relaxed">{property.description}</p>
            </div>
          )}

          {/* Contracts */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">Договоры по объекту</h2>
            </div>
            {!contracts || contracts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Договоров нет</p>
            ) : (
              <div className="space-y-2">
                {contracts.map((c) => (
                  <Link key={c.id} href={`/contracts/${c.id}`}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-accent transition-colors">
                    <p className="text-sm font-medium">{c.contract_number ?? `#${c.id.slice(0,8)}`}</p>
                    <span className="text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString('ru-RU')}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
          {/* Files */}
          <FilesSection propertyId={id} title="Фото и документы объекта" />
        </div>

        {/* Right */}
        <div className="bg-card border border-border rounded-2xl p-5 h-fit">
          <h2 className="font-semibold text-foreground mb-4">Информация</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Менеджер</span>
              <span className="text-foreground">{manager?.full_name ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Добавлен</span>
              <span className="text-foreground">
                {new Date(property.created_at).toLocaleDateString('ru-RU')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
