import { createPublicClient } from '@/lib/supabase/public'

/**
 * Явный whitelist колонок, которые вообще могут уехать на публичный сайт.
 *
 * `select('*')` здесь запрещён принципиально, а не только по правилу P2-9:
 * в `properties` лежат `owner_id`, `manager_id`, `management_fee`,
 * `ownership_basis`, `avito_*` — служебные поля агентства, которым нечего
 * делать в HTML публичной страницы.
 */
export const PUBLIC_PROPERTY_COLUMNS = [
  'id',
  'title',
  'property_type',
  'deal_type',
  'address',
  'district',
  'price',
  'deposit',
  'area',
  'living_area',
  'kitchen_area',
  'rooms',
  'floor',
  'total_floors',
  'ceiling_height',
  'house_type',
  'wall_material',
  'year_built',
  'has_elevator',
  'has_parking',
  'has_internet',
  'has_tv',
  'heating_type',
  'water_supply_type',
  'description',
  'photo_urls',
  'video_url',
  'status',
  'created_at',
].join(', ')

/** Ровно те поля, что перечислены в PUBLIC_PROPERTY_COLUMNS. */
export interface PublicProperty {
  id: string
  title: string
  property_type: string
  deal_type: string
  address: string
  district: string | null
  price: number | null
  deposit: number | null
  area: number | null
  living_area: number | null
  kitchen_area: number | null
  rooms: number | null
  floor: number | null
  total_floors: number | null
  ceiling_height: number | null
  house_type: string | null
  wall_material: string | null
  year_built: number | null
  has_elevator: boolean | null
  has_parking: boolean | null
  has_internet: boolean | null
  has_tv: boolean | null
  heating_type: string | null
  water_supply_type: string | null
  description: string | null
  photo_urls: string[] | null
  video_url: string | null
  status: string
  created_at: string
}

export interface CatalogFilters {
  deal_type?: string
  property_type?: string
  rooms?: string
  district?: string
  price_min?: string
  price_max?: string
  page?: string
}

export const CATALOG_PAGE_SIZE = 12

export interface CatalogResult {
  items: PublicProperty[]
  total: number
  page: number
  pageCount: number
}

function toPositiveInt(value: string | undefined): number | null {
  if (!value) return null
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Каталог: только объекты, которые сотрудник явно пометил «Публикация на сайте».
 * `site_publish = true` дублируется в запросе, хотя это же условие стоит и в
 * anon-политике RLS — намеренно: фильтр в запросе делает намерение явным и
 * позволяет БД взять частичный индекс idx_properties_site_publish.
 */
export async function fetchCatalog(filters: CatalogFilters): Promise<CatalogResult> {
  const supabase = createPublicClient()

  let query = supabase
    .from('properties')
    .select(PUBLIC_PROPERTY_COLUMNS, { count: 'exact' })
    .eq('site_publish', true)

  if (filters.deal_type) query = query.eq('deal_type', filters.deal_type)
  if (filters.property_type) query = query.eq('property_type', filters.property_type)
  if (filters.district) query = query.eq('district', filters.district)

  const rooms = toPositiveInt(filters.rooms)
  if (rooms !== null) {
    // «4+» — всё, что от четырёх комнат и больше
    if (rooms >= 4) query = query.gte('rooms', 4)
    else query = query.eq('rooms', rooms)
  }

  const priceMin = toPositiveInt(filters.price_min)
  const priceMax = toPositiveInt(filters.price_max)
  if (priceMin !== null) query = query.gte('price', priceMin)
  if (priceMax !== null) query = query.lte('price', priceMax)

  const page = Math.max(1, toPositiveInt(filters.page) ?? 1)
  const from = (page - 1) * CATALOG_PAGE_SIZE

  const { data, count, error } = await query
    // Свободные объекты — первыми, уже сданные не мешают смотреть актуальное
    .order('status', { ascending: true })
    .order('created_at', { ascending: false })
    .range(from, from + CATALOG_PAGE_SIZE - 1)

  if (error) {
    console.error('[site] catalog query failed:', error.message)
    return { items: [], total: 0, page, pageCount: 1 }
  }

  const total = count ?? 0
  return {
    items: (data ?? []) as unknown as PublicProperty[],
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE)),
  }
}

/** Подборка для главной. */
export async function fetchFeaturedProperties(limit = 6): Promise<PublicProperty[]> {
  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from('properties')
    .select(PUBLIC_PROPERTY_COLUMNS)
    .eq('site_publish', true)
    .eq('status', 'available')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[site] featured query failed:', error.message)
    return []
  }
  return (data ?? []) as unknown as PublicProperty[]
}

export async function fetchPublicProperty(id: string): Promise<PublicProperty | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null

  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from('properties')
    .select(PUBLIC_PROPERTY_COLUMNS)
    .eq('site_publish', true)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('[site] property query failed:', error.message)
    return null
  }
  return (data as unknown as PublicProperty) ?? null
}

/** Все id опубликованных объектов — для sitemap.xml. */
export async function fetchPublishedPropertyIds(): Promise<{ id: string; created_at: string }[]> {
  const supabase = createPublicClient(300)
  const { data, error } = await supabase
    .from('properties')
    .select('id, created_at')
    .eq('site_publish', true)
    .limit(1000)

  if (error) return []
  return (data ?? []) as { id: string; created_at: string }[]
}

/** Уникальные районы среди опубликованных объектов — для фильтра каталога. */
export async function fetchPublishedDistricts(): Promise<string[]> {
  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from('properties')
    .select('district')
    .eq('site_publish', true)
    .not('district', 'is', null)
    .limit(500)

  if (error) return []
  const set = new Set<string>()
  for (const row of (data ?? []) as { district: string | null }[]) {
    if (row.district) set.add(row.district)
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'ru'))
}

export interface PublicCompanyContacts {
  name: string | null
  legal_form: string | null
  inn: string | null
  ogrn: string | null
  phone: string | null
  email: string | null
  address: string | null
  website: string | null
}

/**
 * Контакты агентства. Читаются через VIEW `public_company_contacts` — узкий
 * список колонок company_settings. Саму таблицу анониму открывать нельзя:
 * там паспорт подписанта и банковские реквизиты.
 */
export async function fetchCompanyContacts(): Promise<PublicCompanyContacts | null> {
  const supabase = createPublicClient(300)
  const { data, error } = await supabase
    .from('public_company_contacts')
    .select('name, legal_form, inn, ogrn, phone, email, address, website')
    .maybeSingle()

  if (error) {
    console.error('[site] company contacts query failed:', error.message)
    return null
  }
  return (data as unknown as PublicCompanyContacts) ?? null
}
