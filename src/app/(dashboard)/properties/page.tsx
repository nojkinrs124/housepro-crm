import { createClient } from '@/lib/supabase/server'
import { Home, Plus, Search, MapPin, Maximize2, DoorOpen, ArrowUpRight, LayoutGrid, List, Megaphone } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { buttonVariants } from '@/components/ui/button'
import { PropertyAvitoQuickToggle } from '@/features/avito/components/PropertyAvitoQuickToggle'

const typeLabels: Record<string, string> = {
 apartment: 'Квартира', house: 'Дом', commercial: 'Коммерция',
 office: 'Офис', warehouse: 'Склад', land: 'Участок',
}
const dealLabels: Record<string, string> = {
 rent: 'Аренда', sale: 'Продажа', management: 'Управление', subrent: 'Субаренда',
}
const statusConfig: Record<string, { label: string; dot: string; badge: string }> = {
 available: { label: 'Свободен', dot: '#22C55E', badge: 'bg-green-50 text-green-700' },
 reserved: { label: 'Забронирован', dot: '#F59E0B', badge: 'bg-amber-50 text-amber-700' },
 rented: { label: 'Сдан', dot: '#3B82F6', badge: 'bg-blue-50 text-blue-700' },
 sold: { label: 'Продан', dot: '#94A3B8', badge: 'bg-slate-100 text-slate-500' },
 inactive: { label: 'Неактивен', dot: '#EF4444', badge: 'bg-red-50 text-red-600' },
}
const dealBadge: Record<string, string> = {
 rent: 'bg-blue-50 text-blue-700',
 sale: 'bg-violet-50 text-violet-700',
 management: 'bg-amber-50 text-amber-700',
 subrent: 'bg-green-50 text-green-700',
}
const placeholderImages: Record<string, string> = {
 apartment: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&h=360&fit=crop&auto=format',
 house: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=600&h=360&fit=crop&auto=format',
 commercial:'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=360&fit=crop&auto=format',
 office: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=600&h=360&fit=crop&auto=format',
 warehouse: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&h=360&fit=crop&auto=format',
 land: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600&h=360&fit=crop&auto=format',
}

export default async function PropertiesPage({
 searchParams,
}: {
 searchParams: Promise<{ search?: string; deal_type?: string; status?: string; view?: string; avito?: string }>
}) {
 const params = await searchParams
 const view = params.view === 'list' ? 'list' : 'grid'

 const supabase = await createClient()
 let query = supabase
 .from('properties')
 .select('id, title, property_type, deal_type, address, price, area, rooms, status, floor, total_floors, created_at, avito_publish, avito_status')
 .order('created_at', { ascending: false })

 if (params.search) query = query.ilike('address', `%${params.search}%`)
 if (params.deal_type) query = query.eq('deal_type', params.deal_type)
 if (params.status) query = query.eq('status', params.status)
 if (params.avito === 'published') query = query.eq('avito_publish', true)
 if (params.avito === 'unpublished') query = query.eq('avito_publish', false)

 const { data: properties, error } = await query.limit(100)
 if (error) console.error('Properties error:', error.message)

 const publishedCount = properties?.filter(p => p.avito_publish).length ?? 0

 // Build query string helper (preserves other params when switching view/filter)
 const buildHref = (overrides: Record<string, string | undefined>) => {
 const p = { search: params.search, deal_type: params.deal_type, status: params.status, avito: params.avito, view: view === 'list' ? 'list' : undefined, ...overrides }
 const qs = Object.entries(p).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v!)}`).join('&')
 return `/properties${qs ? `?${qs}` : ''}`
 }

 return (
 <div className="space-y-6">

 <PageHeader
 title="Объекты недвижимости"
 subtitle={`${properties?.length ?? 0} объектов в базе · ${publishedCount} на Авито`}
 actions={
 <Link href="/properties/new" className={buttonVariants({ size: 'lg' })}>
 <Plus style={{ width: 16, height: 16 }} />
 Добавить объект
 </Link>
 }
 />

 {/* Filters + view switcher */}
 <div className="bg-white border border-slate-100 p-4 flex flex-wrap gap-3 items-center"
 style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}>

 {/* Search */}
 <form method="get" className="flex-1 min-w-[200px]">
 {params.deal_type && <input type="hidden" name="deal_type" value={params.deal_type} />}
 {params.status && <input type="hidden" name="status" value={params.status} />}
 {params.avito && <input type="hidden" name="avito" value={params.avito} />}
 {view === 'list' && <input type="hidden" name="view" value="list" />}
 <div className="relative">
 <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"
 style={{ width: 14, height: 14 }} />
 <input
 name="search"
 defaultValue={params.search}
 placeholder="Поиск по адресу..."
 className="w-full h-[42px] pl-10 pr-4 text-sm text-foreground placeholder:text-slate-400 outline-none bg-background border border-slate-200 focus:border-[#22C55E] focus:ring-2 focus:ring-green-100 transition-all font-medium"
 />
 </div>
 </form>

 {/* Deal type filters */}
 <div className="flex gap-2 flex-wrap">
 <Link href={buildHref({ deal_type: undefined })}
 className="px-4 py-2 text-sm font-bold transition-all"
 style={!params.deal_type
 ? { background: 'var(--hp-gradient-primary)', color: '#fff' }
 : { background: '#F8FAFC', color: '#64748B' }}>
 Все
 </Link>
 {Object.entries(dealLabels).map(([value, label]) => (
 <Link key={value} href={buildHref({ deal_type: value })}
 className="px-4 py-2 text-sm font-bold transition-all"
 style={params.deal_type === value
 ? { background: 'var(--hp-gradient-primary)', color: '#fff' }
 : { background: '#F8FAFC', color: '#64748B' }}>
 {label}
 </Link>
 ))}
 </div>

 {/* Status filter */}
 <div className="flex gap-2 flex-wrap">
 <Link href={buildHref({ status: undefined })}
 className="px-3 py-2 text-xs font-bold transition-all flex items-center gap-1.5"
 style={!params.status
 ? { background: '#1E293B', color: '#fff' }
 : { background: '#F8FAFC', color: '#64748B' }}>
 Любой статус
 </Link>
 {Object.entries(statusConfig).map(([value, cfg]) => (
 <Link key={value} href={buildHref({ status: value })}
 className="px-3 py-2 text-xs font-bold transition-all flex items-center gap-1.5"
 style={params.status === value
 ? { background: '#1E293B', color: '#fff' }
 : { background: '#F8FAFC', color: '#64748B' }}>
 <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cfg.dot }} />
 {cfg.label}
 </Link>
 ))}
 </div>

 {/* Avito filter */}
 <div className="flex gap-2 flex-wrap">
 {[
 { value: undefined, label: 'Все' },
 { value: 'published', label: 'На Авито' },
 { value: 'unpublished', label: 'Не на Авито' },
 ].map(opt => (
 <Link key={opt.label} href={buildHref({ avito: opt.value })}
 className="px-3 py-2 text-xs font-bold transition-all flex items-center gap-1.5"
 style={params.avito === opt.value || (!params.avito && !opt.value)
 ? { background: 'linear-gradient(135deg, #2563EB, #3B82F6)', color: '#fff' }
 : { background: '#F8FAFC', color: '#64748B' }}>
 <Megaphone style={{ width: 12, height: 12 }} />
 {opt.label}
 </Link>
 ))}
 </div>

 {/* View switcher */}
 <div className="flex items-center gap-1 p-1 bg-slate-100 shrink-0 ml-auto">
 <Link href={buildHref({ view: undefined })}
 className={`w-9 h-9 flex items-center justify-center transition-all ${view === 'grid' ? 'bg-white shadow-sm text-foreground' : 'text-slate-400 hover:text-muted-foreground'}`}
 title="Карточки">
 <LayoutGrid style={{ width: 16, height: 16 }} />
 </Link>
 <Link href={buildHref({ view: 'list' })}
 className={`w-9 h-9 flex items-center justify-center transition-all ${view === 'list' ? 'bg-white shadow-sm text-foreground' : 'text-slate-400 hover:text-muted-foreground'}`}
 title="Список">
 <List style={{ width: 16, height: 16 }} />
 </Link>
 </div>
 </div>

 {/* Empty state */}
 {!properties || properties.length === 0 ? (
 <div className="bg-white border border-slate-100 text-center py-24"
 style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}>
 <div className="w-16 h-16 flex items-center justify-center mx-auto mb-4"
 style={{ background: 'linear-gradient(135deg, rgba(22,163,74,0.1), rgba(34,197,94,0.1))' }}>
 <Home style={{ width: 28, height: 28, color: '#16A34A' }} />
 </div>
 <p className="text-foreground font-bold text-lg">Нет объектов</p>
 <p className="text-muted-foreground text-sm mt-1">
 {error ? `Ошибка: ${error.message}` : 'Добавьте первый объект недвижимости'}
 </p>
 <Link href="/properties/new"
 className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 text-white text-sm font-bold hover:-translate-y-0.5 transition-all"
 style={{ background: 'var(--hp-gradient-primary)', boxShadow: '0 4px 16px rgba(22,163,74,0.35)' }}>
 <Plus style={{ width: 16, height: 16 }} />
 Добавить объект
 </Link>
 </div>

 ) : view === 'grid' ? (
 /* ── GRID VIEW ─────────────────────────────────────────────────── */
 <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
 {properties.map(property => {
 const status = statusConfig[property.status] ?? statusConfig.inactive
 const imgSrc = placeholderImages[property.property_type] ?? placeholderImages.apartment
 const dealCfg = dealBadge[property.deal_type]

 return (
 <Link key={property.id} href={`/properties/${property.id}`}
 className="group block bg-white border border-slate-100 overflow-hidden transition-all duration-300 hover:-translate-y-1"
 style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}>
 {/* Photo */}
 <div className="relative h-52 overflow-hidden bg-slate-100">
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img src={imgSrc} alt={property.title}
 className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
 <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
 {/* Status */}
 <div className="absolute top-3 left-3">
 <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold backdrop-blur-md"
 style={{ background: 'rgba(255,255,255,0.92)', color: status.dot === '#22C55E' ? '#16A34A' : status.dot }}>
 <span className="w-2 h-2 rounded-full" style={{ background: status.dot }} />
 {status.label}
 </span>
 </div>
 {/* Deal type */}
 <div className="absolute top-3 right-3">
 <span className="px-3 py-1.5 rounded-full text-[11px] font-bold backdrop-blur-md"
 style={{ background: 'rgba(255,255,255,0.92)', color: '#374151' }}>
 {dealLabels[property.deal_type] ?? property.deal_type}
 </span>
 </div>
 {/* Price */}
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
 {/* Type chip */}
 <div className="absolute bottom-3 right-3">
 <span className="px-2.5 py-1 rounded-full text-[10px] font-bold text-white/90 backdrop-blur-sm"
 style={{ background: 'rgba(0,0,0,0.35)' }}>
 {typeLabels[property.property_type] ?? property.property_type}
 </span>
 </div>
 </div>
 {/* Body */}
 <div className="p-4">
 <h3 className="font-bold text-foreground text-[15px] leading-snug group-hover:text-[#16A34A] transition-colors mb-2">
 {property.title}
 </h3>
 {property.address && (
 <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
 <MapPin style={{ width: 12, height: 12, flexShrink: 0, color: '#94A3B8' }} />
 <span className="truncate font-medium">{property.address}</span>
 </div>
 )}
 <div className="flex items-center gap-4 pt-3 border-t border-slate-100">
 {property.area && (
 <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
 <div className="w-6 h-6 bg-slate-50 flex items-center justify-center">
 <Maximize2 style={{ width: 11, height: 11, color: '#94A3B8' }} />
 </div>
 <span className="font-semibold text-[#374151]">{property.area}</span>
 <span className="text-slate-400">м²</span>
 </div>
 )}
 {property.rooms && (
 <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
 <div className="w-6 h-6 bg-slate-50 flex items-center justify-center">
 <DoorOpen style={{ width: 11, height: 11, color: '#94A3B8' }} />
 </div>
 <span className="font-semibold text-[#374151]">{property.rooms}</span>
 <span className="text-slate-400">комн.</span>
 </div>
 )}
 <div className="ml-auto flex items-center gap-2">
 <PropertyAvitoQuickToggle
 propertyId={property.id}
 isPublished={!!property.avito_publish}
 status={property.avito_status}
 eligible={property.status === 'available'}
 />
 <div className="w-8 h-8 flex items-center justify-center bg-green-50 text-green-600 group-hover:bg-green-600 group-hover:text-white transition-all shrink-0">
 <ArrowUpRight style={{ width: 15, height: 15 }} />
 </div>
 </div>
 </div>
 </div>
 </Link>
 )
 })}
 </div>

 ) : (
 /* ── LIST VIEW ─────────────────────────────────────────────────── */
 <div className="bg-white border border-slate-100 overflow-hidden"
 style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}>
 <div className="divide-y divide-slate-100">
 {properties.map(property => {
 const status = statusConfig[property.status] ?? statusConfig.inactive
 const imgSrc = placeholderImages[property.property_type] ?? placeholderImages.apartment

 return (
 <Link key={property.id} href={`/properties/${property.id}`}
 className="flex items-center gap-4 px-5 py-4 hover:bg-background transition-all duration-200 group">

 {/* Thumbnail */}
 <div className="w-16 h-16 sm:w-20 sm:h-16 overflow-hidden shrink-0 bg-slate-100">
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img src={imgSrc} alt={property.title}
 className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
 </div>

 {/* Main info */}
 <div className="flex-1 min-w-0">
 <div className="flex items-start justify-between gap-2 flex-wrap">
 <p className="font-semibold text-foreground text-sm group-hover:text-[#16A34A] transition-colors truncate">
 {property.title}
 </p>
 {property.price && (
 <p className="font-bold text-foreground text-sm shrink-0 whitespace-nowrap">
 {Number(property.price).toLocaleString('ru-RU')} ₽
 {property.deal_type === 'rent' && <span className="text-slate-400 font-normal text-xs ml-1">/мес</span>}
 </p>
 )}
 </div>

 {property.address && (
 <div className="flex items-center gap-1 mt-1">
 <MapPin style={{ width: 11, height: 11, color: '#94A3B8', flexShrink: 0 }} />
 <p className="text-xs text-muted-foreground truncate">{property.address}</p>
 </div>
 )}

 {/* Tags row */}
 <div className="flex items-center gap-2 mt-2 flex-wrap">
 {/* Status */}
 <span className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full font-bold ${status.badge}`}>
 <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: status.dot }} />
 {status.label}
 </span>
 {/* Deal type */}
 <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${dealBadge[property.deal_type] ?? 'bg-slate-100 text-slate-500'}`}>
 {dealLabels[property.deal_type] ?? property.deal_type}
 </span>
 {/* Property type */}
 <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-500">
 {typeLabels[property.property_type] ?? property.property_type}
 </span>
 {/* Area */}
 {property.area && (
 <span className="text-[10px] text-slate-400 font-medium">
 {property.area} м²
 </span>
 )}
 {/* Rooms */}
 {property.rooms && (
 <span className="text-[10px] text-slate-400 font-medium">
 {property.rooms} комн.
 </span>
 )}
 {/* Floor */}
 {property.floor && (
 <span className="text-[10px] text-slate-400 font-medium">
 {property.floor}{property.total_floors ? `/${property.total_floors}` : ''} эт.
 </span>
 )}
 {/* Avito */}
 <PropertyAvitoQuickToggle
 propertyId={property.id}
 isPublished={!!property.avito_publish}
 status={property.avito_status}
 eligible={property.status === 'available'}
 />
 </div>
 </div>

 {/* Arrow */}
 <div className="shrink-0 hidden sm:block">
 <div className="w-8 h-8 flex items-center justify-center bg-slate-50 text-slate-400 group-hover:bg-green-600 group-hover:text-white transition-all">
 <ArrowUpRight style={{ width: 15, height: 15 }} />
 </div>
 </div>
 </Link>
 )
 })}
 </div>
 </div>
 )}

 </div>
 )
}
