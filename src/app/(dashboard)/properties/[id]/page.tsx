import { createClient } from '@/lib/supabase/server'
import { DeletePropertyButton } from '@/features/properties/components/DeletePropertyButton'
import { AvitoPublishToggle } from '@/features/avito/components/AvitoPublishToggle'
import { SitePublishToggle } from '@/features/properties/components/SitePublishToggle'
import {
 ArrowLeft, Home, MapPin, DollarSign, Ruler, Edit,
 Layers, Calendar, Wifi, Droplets, Flame, Car,
 CheckCircle, XCircle, TrendingUp, FileText, Plus, User
} from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FilesSection } from '@/features/files/components/FilesSection'
import { CONTRACT_TYPE_LABELS, isActiveRentContract } from '@/features/contracts/config/contract-types'
import { PageHeader } from '@/components/layout/PageHeader'
import Image from 'next/image'
import { PropertyMap } from '@/features/properties/components/PropertyMap'
import { MetersPanel, type MeterRow } from '@/features/properties/components/MetersPanel'
import { formatDate } from '@/lib/utils'
import { toAvitoStatus } from '@/features/avito/config/status'
import { PROPERTY_TYPE_LABELS as typeLabels, PROPERTY_DEAL_LABELS as dealLabels, PROPERTY_STATUS_LABELS } from '@/features/properties/config/property-labels'
import { ReadinessPanel } from '@/components/layout/ReadinessPanel'
import { checkProperty } from '@/lib/readiness'

const statusColors: Record<string, string> = {
 available: 'bg-[var(--hp-good-tint)] text-[var(--hp-good)]',
 reserved: 'bg-[var(--hp-warn-tint)] text-[var(--hp-warn)]',
 rented: 'bg-[var(--hp-info-tint)] text-[var(--hp-info)]',
 sold: 'bg-[var(--hp-neutral-tint)] text-[var(--hp-sub)]',
 inactive: 'bg-[var(--hp-danger-tint)] text-[var(--hp-danger)]',
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
const contractTypeLabels = CONTRACT_TYPE_LABELS

export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
 const { id } = await params
 const supabase = await createClient()

 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const { data: property, error: propertyError } = await supabase
 .from('properties')
 .select('*, manager:users(full_name), owner:contacts!owner_id(id, full_name, phone, email)')
 .eq('id', id)
 .single()

 if (propertyError && propertyError.code !== 'PGRST116') {
 throw new Error(`Не удалось загрузить объект: ${propertyError.message}`)
 }
 if (!property) notFound()

 const [{ data: contracts }, { data: deals }, { data: metersRaw }] = await Promise.all([
 supabase.from('contracts')
 .select('id, contract_number, contract_type, status, amount, created_at, end_date')
 .eq('property_id', id).order('created_at', { ascending: false }),
 supabase.from('deals')
 .select('id, deal_type, status, amount, created_at')
 .eq('property_id', id).order('created_at', { ascending: false }).limit(5),
 // Показания сортируются от свежих: в панели показываются последние четыре.
 supabase.from('utility_meters')
 .select('id, kind, title, serial_number, unit, tariff, readings:meter_readings(id, reading_date, value, consumption, amount)')
 .eq('property_id', id)
 .eq('is_active', true)
 .order('created_at', { ascending: true }),
 ])

 const meters: MeterRow[] = ((metersRaw ?? []) as unknown as MeterRow[]).map((meter) => ({
 ...meter,
 readings: [...(meter.readings ?? [])].sort((a, b) => b.reading_date.localeCompare(a.reading_date)),
 }))

 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const p = property as any
 const manager = p.manager as { full_name?: string } | null
 const owner = p.owner as { id: string; full_name: string; phone?: string | null; email?: string | null } | null

 // Договор аренды и статус объекта расходятся чаще всего: статус переставить
 // забывают, и сданный объект продолжает висеть в рекламе.
 const hasActiveRentContract = (contracts ?? []).some(c => isActiveRentContract(c))
 const issues = checkProperty(p, { hasActiveRentContract })

 const Bool = ({ val, label }: { val: boolean | null; label: string }) => (
 <div className="flex items-center justify-between py-1.5">
 <span className="text-sm text-muted-foreground">{label}</span>
 {val
 ? <CheckCircle className="w-4 h-4 text-[var(--hp-good)]" />
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
 <PageHeader
 title={p.title}
 backHref="/properties"
 backLabel="Все объекты"
 iconBg="bg-[var(--hp-good-tint)]"
 iconBoxClassName="w-14 h-14"
 icon={<Home className="w-7 h-7 text-[var(--hp-good)]" />}
 subtitle={
 <span className="flex items-center gap-2 flex-wrap">
 <span className="text-xs px-2 py-0.5 rounded-[var(--hp-radius-badge)] bg-muted text-muted-foreground font-medium">
 {typeLabels[p.property_type] ?? p.property_type}
 </span>
 <span className="text-xs px-2 py-0.5 rounded-[var(--hp-radius-badge)] bg-[var(--hp-info-tint)] text-[var(--hp-info)] font-medium">
 {dealLabels[p.deal_type] ?? p.deal_type}
 </span>
 <span className={`text-xs px-2 py-0.5 rounded-[var(--hp-radius-badge)] font-medium ${statusColors[p.status] ?? 'bg-[var(--hp-neutral-tint)] text-[var(--hp-sub)]'}`}>
 {PROPERTY_STATUS_LABELS[p.status]?.label ?? p.status}
 </span>
 </span>
 }
 actions={
 <>
 <Link href={`/properties/${id}/edit`}
 className="flex items-center gap-2 px-4 py-2 border border-border text-foreground text-sm font-medium hover:bg-accent transition whitespace-nowrap">
 <Edit className="w-4 h-4" />
 Редактировать
 </Link>
 <DeletePropertyButton propertyId={id} />
 <Link href={`/contracts/new?property_id=${id}`}
 className="px-4 py-2 text-white text-sm font-bold transition whitespace-nowrap" style={{ background: 'var(--hp-accent)', }}>
 + Договор
 </Link>
 </>
 }
 />

 {/* Address */}
 <div className="flex items-center gap-2 px-4 py-3 hp-card">
 <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
 <span className="text-sm text-foreground">{p.address}</span>
 {p.metro && <span className="text-sm text-muted-foreground">· м. {p.metro}</span>}
 </div>

 {/* Собственник и что не доедет из-за пустых полей — до всего остального:
 объект без собственника не попадает в отчёт, а без координат — на площадки. */}
 <div className="hp-block">
 <div className="hp-block-header">Собственник</div>
 {owner ? (
 <Link href={`/contacts/${owner.id}`} className="hp-block-item">
 <User className="w-4 h-4 shrink-0 text-[var(--hp-sub)]" />
 <span className="flex-1 min-w-0 truncate text-[var(--hp-ink)] font-semibold">{owner.full_name}</span>
 {owner.phone && <span className="shrink-0 text-[12px] text-[var(--hp-sub)]">{owner.phone}</span>}
 </Link>
 ) : (
 <Link href={`/properties/${id}/edit`} className="hp-block-item">
 <User className="w-4 h-4 shrink-0 text-[var(--hp-tertiary)]" />
 <span className="flex-1 min-w-0 text-[var(--hp-tertiary)]">Не указан — объект не попадёт в отчёт собственнику</span>
 <span className="shrink-0 text-[12px] font-medium text-[var(--hp-accent)]">Указать</span>
 </Link>
 )}
 </div>

 <ReadinessPanel issues={issues} />

 {/* Карта — только если у объекта есть координаты (заполняются подсказками
 DaData при вводе адреса). */}
 {p.latitude && p.longitude && (
 <div className="hp-card p-4">
 <PropertyMap
 points={[
 {
 id: p.id,
 latitude: Number(p.latitude),
 longitude: Number(p.longitude),
 title: p.title,
 subtitle: p.address,
 },
 ]}
 height={280}
 />
 </div>
 )}

 {/* Счётчики и показания */}
 <MetersPanel propertyId={id} meters={meters} />

 {/* Фотографии */}
 {(p.photo_urls?.length ?? 0) > 0 && (
 <div className="hp-card p-5">
 <div className="flex items-center justify-between mb-3">
 <h2 className="font-semibold text-foreground text-sm">Фотографии ({p.photo_urls.length})</h2>
 <Link href={`/properties/${id}/edit`} className="text-xs text-primary hover:underline">Управлять</Link>
 </div>
 <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
 {(p.photo_urls as string[]).map((url, i) => (
 <div key={url} className="relative aspect-[4/3] overflow-hidden border border-[var(--hp-border-soft)] bg-[var(--hp-neutral-tint)]">
 <Image src={url} alt={`Фото ${i + 1}`} fill sizes="150px" className="object-cover" />
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Price highlight */}
 {(p.price || p.deposit || p.management_fee) && (
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
 {p.price && (
 <div className="bg-[var(--hp-good-tint)] border border-[var(--hp-border)] p-4 text-center">
 <p className="text-xs text-[var(--hp-good)] font-medium">Цена</p>
 <p className="text-xl font-bold text-[var(--hp-good)] mt-1">{Number(p.price).toLocaleString('ru-RU')} ₽</p>
 </div>
 )}
 {p.deposit && (
 <div className="bg-[var(--hp-info-tint)] border border-[var(--hp-border)] p-4 text-center">
 <p className="text-xs text-[var(--hp-info)] font-medium">Депозит</p>
 <p className="text-xl font-bold text-[var(--hp-info)] mt-1">{Number(p.deposit).toLocaleString('ru-RU')} ₽</p>
 </div>
 )}
 {p.management_fee && (
 <div className="bg-[var(--hp-warn-tint)] border border-[var(--hp-border)] p-4 text-center">
 <p className="text-xs text-[var(--hp-warn)] font-medium">Комиссия управления</p>
 <p className="text-xl font-bold text-[var(--hp-warn)] mt-1">{Number(p.management_fee).toLocaleString('ru-RU')} ₽</p>
 </div>
 )}
 </div>
 )}

 <div className="grid lg:grid-cols-3 gap-6">
 <div className="lg:col-span-2 space-y-4">

 {/* Параметры */}
 {(p.area || p.rooms || p.floor || p.total_floors || p.ceiling_height || p.living_area || p.kitchen_area) && (
 <div className="hp-card p-5">
 <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
 <Ruler className="w-4 h-4" /> Параметры
 </h2>
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
 {[
 { label: 'Общая площадь', value: p.area ? `${p.area} м²` : null },
 { label: 'Жилая площадь', value: p.living_area ? `${p.living_area} м²` : null },
 { label: 'Кухня', value: p.kitchen_area ? `${p.kitchen_area} м²` : null },
 { label: 'Комнат', value: p.rooms },
 { label: 'Этаж', value: p.floor && p.total_floors ? `${p.floor} / ${p.total_floors}` : (p.floor ?? null) },
 { label: 'Высота потолков', value: p.ceiling_height ? `${p.ceiling_height} м` : null },
 ].filter(i => i.value != null).map(item => (
 <div key={item.label} className="p-3 bg-muted/30 text-center">
 <p className="text-lg font-bold text-foreground">{item.value}</p>
 <p className="text-xs text-muted-foreground mt-0.5">{item.label}</p>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Дом */}
 {(p.house_type || p.wall_material || p.year_built || p.has_elevator != null || p.has_parking != null) && (
 <div className="hp-card p-5">
 <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
 <Layers className="w-4 h-4" /> Характеристики дома
 </h2>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
 <div>
 <Row label="Тип дома" value={houseTypeLabels[p.house_type] ?? p.house_type} />
 <Row label="Материал стен" value={wallMaterialLabels[p.wall_material] ?? p.wall_material} />
 <Row label="Год постройки" value={p.year_built} />
 </div>
 <div>
 <Bool val={p.has_elevator} label="Лифт" />
 <Bool val={p.has_parking} label="Парковка" />
 </div>
 </div>
 </div>
 )}

 {/* Коммуникации */}
 {(p.heating_type || p.water_supply_type || p.has_internet != null || p.has_tv != null) && (
 <div className="hp-card p-5">
 <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
 <Flame className="w-4 h-4" /> Коммуникации
 </h2>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
 <div>
 <Row label="Отопление" value={heatingLabels[p.heating_type] ?? p.heating_type} />
 <Row label="Водоснабжение" value={waterLabels[p.water_supply_type] ?? p.water_supply_type} />
 </div>
 <div>
 <Bool val={p.has_internet} label="Интернет" />
 <Bool val={p.has_tv} label="Телевидение" />
 </div>
 </div>
 </div>
 )}

 {/* Описание */}
 {p.description && (
 <div className="hp-card p-5">
 <h2 className="font-semibold text-foreground mb-3">Описание</h2>
 <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{p.description}</p>
 </div>
 )}

 {/* Договоры */}
 <div className="hp-card p-5">
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
 className="flex items-center justify-between p-3 hover:bg-accent transition-colors">
 <div>
 <p className="text-sm font-medium text-foreground">{c.contract_number ?? `#${c.id.slice(0,8)}`}</p>
 <p className="text-xs text-muted-foreground">{contractTypeLabels[c.contract_type] ?? c.contract_type}</p>
 </div>
 <div className="text-right">
 {c.amount && <p className="text-sm font-semibold text-foreground">{Number(c.amount).toLocaleString('ru-RU')} ₽</p>}
 <p className="text-xs text-muted-foreground">{formatDate(c.created_at)}</p>
 </div>
 </Link>
 ))}
 </div>
 )}
 </div>

 {/* Сделки */}
 {(deals?.length ?? 0) > 0 && (
 <div className="hp-card p-5">
 <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
 <TrendingUp className="w-4 h-4" /> Сделки
 </h2>
 <div className="space-y-2">
 {deals!.map(d => (
 <Link key={d.id} href={`/deals/${d.id}`}
 className="flex items-center justify-between p-3 hover:bg-accent transition-colors">
 <p className="text-sm font-medium text-foreground">{dealLabels[d.deal_type] ?? d.deal_type}</p>
 <div className="text-right">
 {d.amount && <p className="text-sm font-semibold">{Number(d.amount).toLocaleString('ru-RU')} ₽</p>}
 <p className="text-xs text-muted-foreground">{formatDate(d.created_at)}</p>
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
 <div className="hp-card p-5">
 <h2 className="font-semibold text-foreground mb-4">Информация</h2>
 <div className="space-y-0">
 <Row label="Менеджер" value={manager?.full_name ?? '—'} />
 <Row label="Добавлен" value={formatDate(p.created_at)} />
 {p.updated_at && <Row label="Обновлён" value={formatDate(p.updated_at)} />}
 {p.district && <Row label="Район" value={p.district} />}
 </div>
 </div>

 {/* Авито — публикация по кнопке */}
 <AvitoPublishToggle
 propertyId={id}
 isPublished={!!p.avito_publish}
 status={toAvitoStatus(p.avito_status)}
 error={p.avito_error}
 syncedAt={p.avito_synced_at}
 eligible={p.status === 'available'}
 />

 {/* Публичный сайт «ХаусПро» */}
 <SitePublishToggle
 propertyId={id}
 isPublished={!!p.site_publish}
 />

 {/* Quick actions */}
 <div className="hp-card p-4 space-y-2">
 <Link href={`/deals/new?property_id=${id}`}
 className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition">
 <TrendingUp className="w-4 h-4" /> Создать сделку
 </Link>
 <Link href={`/contracts/new?property_id=${id}`}
 className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-border text-sm font-medium hover:bg-accent transition">
 <FileText className="w-4 h-4" /> Создать договор
 </Link>
 </div>
 </div>
 </div>
 </div>
 )
}
