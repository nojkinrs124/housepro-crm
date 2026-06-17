import { createClient } from '@/lib/supabase/server'
import { DeletePropertyButton } from '@/features/properties/components/DeletePropertyButton'
import {
  ArrowLeft, Home, MapPin, DollarSign, Ruler, Edit,
  Layers, Calendar, Wifi, Droplets, Flame, Car,
  CheckCircle, XCircle, TrendingUp, FileText, Plus
} from 'lucide-react'
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
  reserved:  'bg-yellow-100 text-yellow-700',
  rented:    'bg-blue-100 text-blue-700',
  sold:      'bg-gray-100 text-gray-600',
  inactive:  'bg-red-100 text-red-700',
}
const statusLabels: Record<string, string> = {
  available: 'Свободен', reserved: 'Забронирован',
  rented: 'Сдан', sold: 'Продан', inactive: 'Неактивен',
}
const houseTypeLabels: Record<string, string> = {
  panel: 'Панельный', brick: 'Кирпичный', monolith: 'Монолит',
  monolith_brick: 'Монолит-кирпич', wood: 'Деревянный',
}
const wallMaterialLabels: Record<string, string> = {
  brick: 'Кирпич', panel: 'Панель', concrete: 'Бетон', wood: 'Дерево', gas_block: 'Газоблок',
}
const heatingLabels: Record<string, string> = {
  central: 'Центральное', gas: 'Газовое', electric: 'Электрическое', autonomous: 'Автономное',
}
const waterLabels: Record<string, string> = {
  central: 'Центральное', well: 'Скважина/колодец', none: 'Нет',
}
const contractTypeLabels: Record<string, string> = {
  rent_apartment: 'Аренда кв.', rent_commercial: 'Ком. аренда',
  sale_apartment: 'Продажа кв.', sale_house: 'Продажа дома',
  property_management: 'Управление', sublease: 'Субаренда', agency_contract: 'Агентский',
}

export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: property } = await supabase
    .from('properties')
    .select('*, manager:users(full_name)')
    .eq('id', id)
    .single()

  if (!property) notFound()

  const [{ data: contracts }, { data: deals }] = await Promise.all([
    supabase.from('contracts')
      .select('id, contract_number, contract_type, status, amount, created_at')
      .eq('property_id', id).order('created_at', { ascending: false }),
    supabase.from('deals')
      .select('id, deal_type, status, amount, created_at')
      .eq('property_id', id).order('created_at', { ascending: false }).limit(5),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = property as any
  const manager = p.manager as { full_name?: string } | null

  const Bool = ({ val, label }: { val: boolean | null; label: string }) => (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      {val
        ? <CheckCircle className="w-4 h-4 text-green-500" />
        : <XCircle className="w-4 h-4 text-muted-foreground/40" />}
    </div>
  )

  const Row = ({ label, value }: { label: string; value?: string | number | null }) =>
    value != null && String(value).trim() !== '' ? (
      <div className="flex justify-between py-1.5 border-b border-border/50 last:border-0">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm font-medium text-foreground text-right">{value}</span>
      </div>
    ) : null

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link href="/properties" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Все объекты
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-14 h-14 rounded-[20px] bg-emerald-100 flex items-center justify-center shrink-0">
            <Home className="w-7 h-7 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[28px] font-bold text-[#111827] tracking-tight leading-tight break-words">{p.title}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                {typeLabels[p.property_type] ?? p.property_type}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                {dealLabels[p.deal_type] ?? p.deal_type}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[p.status] ?? 'bg-gray-100 text-gray-600'}`}>
                {statusLabels[p.status] ?? p.status}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Link href={`/properties/${id}/edit`}
            className="flex items-center gap-2 px-4 py-2 border border-border text-foreground rounded-[14px] text-sm font-medium hover:bg-accent transition whitespace-nowrap">
            <Edit className="w-4 h-4" />
            Редактировать
          </Link>
          <DeletePropertyButton propertyId={id} />
          <Link href={`/contracts/new?property_id=${id}`}
            className="px-4 py-2 text-white rounded-[14px] text-sm font-bold hover:-translate-y-0.5 transition whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #16A34A, #22C55E)', boxShadow: '0 4px 16px rgba(22,163,74,0.35)' }}>
            + Договор
          </Link>
        </div>
      </div>

      {/* Address */}
      <div className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-100 rounded-[20px] shadow-sm">
        <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-sm text-foreground">{p.address}</span>
      </div>

      {/* Price highlight */}
      {(p.price || p.deposit || p.management_fee) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {p.price && (
            <div className="bg-green-50 border border-green-200 rounded-[20px] p-4 text-center">
              <p className="text-xs text-green-600 font-medium">Цена</p>
              <p className="text-xl font-bold text-green-700 mt-1">{Number(p.price).toLocaleString('ru-RU')} ₽</p>
            </div>
          )}
          {p.deposit && (
            <div className="bg-blue-50 border border-blue-200 rounded-[20px] p-4 text-center">
              <p className="text-xs text-blue-600 font-medium">Депозит</p>
              <p className="text-xl font-bold text-blue-700 mt-1">{Number(p.deposit).toLocaleString('ru-RU')} ₽</p>
            </div>
          )}
          {p.management_fee && (
            <div className="bg-orange-50 border border-orange-200 rounded-[20px] p-4 text-center">
              <p className="text-xs text-orange-600 font-medium">Комиссия управления</p>
              <p className="text-xl font-bold text-orange-700 mt-1">{Number(p.management_fee).toLocaleString('ru-RU')} ₽</p>
            </div>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">

          {/* Параметры */}
          {(p.area || p.rooms || p.floor || p.total_floors || p.ceiling_height || p.living_area || p.kitchen_area) && (
            <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-5">
              <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Ruler className="w-4 h-4" /> Параметры
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Общая площадь', value: p.area ? `${p.area} м²` : null },
                  { label: 'Жилая площадь', value: p.living_area ? `${p.living_area} м²` : null },
                  { label: 'Кухня',         value: p.kitchen_area ? `${p.kitchen_area} м²` : null },
                  { label: 'Комнат',        value: p.rooms },
                  { label: 'Этаж',          value: p.floor && p.total_floors ? `${p.floor} / ${p.total_floors}` : (p.floor ?? null) },
                  { label: 'Высота потолков', value: p.ceiling_height ? `${p.ceiling_height} м` : null },
                ].filter(i => i.value != null).map(item => (
                  <div key={item.label} className="p-3 bg-muted/30 rounded-xl text-center">
                    <p className="text-lg font-bold text-foreground">{item.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Дом */}
          {(p.house_type || p.wall_material || p.year_built || p.has_elevator != null || p.has_parking != null) && (
            <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-5">
              <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Layers className="w-4 h-4" /> Характеристики дома
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                <div>
                  <Row label="Тип дома"       value={houseTypeLabels[p.house_type] ?? p.house_type} />
                  <Row label="Материал стен"  value={wallMaterialLabels[p.wall_material] ?? p.wall_material} />
                  <Row label="Год постройки"  value={p.year_built} />
                </div>
                <div>
                  <Bool val={p.has_elevator} label="Лифт" />
                  <Bool val={p.has_parking}  label="Парковка" />
                </div>
              </div>
            </div>
          )}

          {/* Коммуникации */}
          {(p.heating_type || p.water_supply_type || p.has_internet != null || p.has_tv != null) && (
            <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-5">
              <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Flame className="w-4 h-4" /> Коммуникации
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                <div>
                  <Row label="Отопление"     value={heatingLabels[p.heating_type] ?? p.heating_type} />
                  <Row label="Водоснабжение" value={waterLabels[p.water_supply_type] ?? p.water_supply_type} />
                </div>
                <div>
                  <Bool val={p.has_internet} label="Интернет" />
                  <Bool val={p.has_tv}       label="Телевидение" />
                </div>
              </div>
            </div>
          )}

          {/* Описание */}
          {p.description && (
            <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-5">
              <h2 className="font-semibold text-foreground mb-3">Описание</h2>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{p.description}</p>
            </div>
          )}

          {/* Договоры */}
          <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <FileText className="w-4 h-4" /> Договоры
              </h2>
              <Link href={`/contracts/new?property_id=${id}`}
                className="text-xs text-primary hover:underline flex items-center gap-1">
                <Plus className="w-3 h-3" /> Создать
              </Link>
            </div>
            {!contracts?.length ? (
              <p className="text-sm text-muted-foreground">Договоров нет</p>
            ) : (
              <div className="space-y-2">
                {contracts.map(c => (
                  <Link key={c.id} href={`/contracts/${c.id}`}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-accent transition-colors">
                    <div>
                      <p className="text-sm font-medium text-foreground">{c.contract_number ?? `#${c.id.slice(0,8)}`}</p>
                      <p className="text-xs text-muted-foreground">{contractTypeLabels[c.contract_type] ?? c.contract_type}</p>
                    </div>
                    <div className="text-right">
                      {c.amount && <p className="text-sm font-semibold text-foreground">{Number(c.amount).toLocaleString('ru-RU')} ₽</p>}
                      <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString('ru-RU')}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Сделки */}
          {(deals?.length ?? 0) > 0 && (
            <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-5">
              <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Сделки
              </h2>
              <div className="space-y-2">
                {deals!.map(d => (
                  <Link key={d.id} href={`/deals/${d.id}`}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-accent transition-colors">
                    <p className="text-sm font-medium text-foreground">{dealLabels[d.deal_type] ?? d.deal_type}</p>
                    <div className="text-right">
                      {d.amount && <p className="text-sm font-semibold">{Number(d.amount).toLocaleString('ru-RU')} ₽</p>}
                      <p className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString('ru-RU')}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Files */}
          <FilesSection propertyId={id} title="Фото и документы объекта" />
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-5">
            <h2 className="font-semibold text-foreground mb-4">Информация</h2>
            <div className="space-y-0">
              <Row label="Менеджер"   value={manager?.full_name ?? '—'} />
              <Row label="Добавлен"   value={new Date(p.created_at).toLocaleDateString('ru-RU')} />
              {p.updated_at && <Row label="Обновлён" value={new Date(p.updated_at).toLocaleDateString('ru-RU')} />}
              {p.district && <Row label="Район" value={p.district} />}
            </div>
          </div>

          {/* Avito/CIAN hint */}
          <div className="bg-blue-50 border border-blue-200 rounded-[20px] p-4">
            <p className="text-blue-900 text-sm font-medium">📢 Выгрузка на площадки</p>
            <p className="text-blue-700 text-xs mt-1 leading-relaxed">
              Объект содержит данные для Авито, ЦИАН и Домклик.
              Заполните описание и цену для полной выгрузки.
            </p>
          </div>

          {/* Quick actions */}
          <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-4 space-y-2">
            <Link href={`/deals/new?property_id=${id}`}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-xl text-sm font-medium hover:bg-primary/20 transition">
              <TrendingUp className="w-4 h-4" /> Создать сделку
            </Link>
            <Link href={`/contracts/new?property_id=${id}`}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-border rounded-xl text-sm font-medium hover:bg-accent transition">
              <FileText className="w-4 h-4" /> Создать договор
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
