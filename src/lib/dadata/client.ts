// Клиент к подсказкам DaData (suggestions.dadata.ru).
//
// Зачем: ИНН → все реквизиты юрлица одним запросом, адрес → нормализованная
// строка + ФИАС + координаты. Это убирает ручной ввод банковских и адресных
// полей, где опечатка обнаруживается уже в подписанном договоре.
//
// Токен читается напрямую из process.env и НИКОГДА не уходит в браузер:
// клиентские компоненты ходят через /api/dadata/[type] (см. роут), а не сюда.
// В lib/env.ts не добавляем по той же причине, что Telegram и Stripe — иначе
// отсутствие ключа уронит все страницы разом.

const DADATA_BASE = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs'

export type DadataSuggestType = 'party' | 'address' | 'bank' | 'fio'

export class DadataError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message)
    this.name = 'DadataError'
  }
}

export function isDadataConfigured(): boolean {
  return Boolean(process.env.DADATA_API_KEY)
}

/** Организация: то, что реально нужно для договора и карточки контрагента. */
export interface PartySuggestion {
  /** Краткое название («ООО «Ромашка»»). */
  name: string
  /** Полное наименование с организационно-правовой формой. */
  fullName: string
  inn: string | null
  kpp: string | null
  ogrn: string | null
  legalAddress: string | null
  /** ФИО руководителя — подставляется в «Представитель». */
  managerName: string | null
  managerPost: string | null
  /** 'LEGAL' | 'INDIVIDUAL' — ИП отличается от ООО набором полей. */
  type: string | null
  /** ACTIVE / LIQUIDATED / ... — ликвидированного контрагента лучше не подписывать. */
  status: string | null
}

export interface AddressSuggestion {
  value: string
  /** Нормализованный вариант с индексом — идёт в документы. */
  unrestrictedValue: string
  fiasId: string | null
  postalCode: string | null
  city: string | null
  /** Район города — у нас есть поле district у объектов. */
  cityDistrict: string | null
  street: string | null
  house: string | null
  flat: string | null
  latitude: number | null
  longitude: number | null
  /** Ближайшее метро, если DaData его знает. */
  metro: string | null
}

export interface BankSuggestion {
  name: string
  bik: string | null
  correspondentAccount: string | null
  swift: string | null
  address: string | null
}

interface RawSuggestion {
  value?: string
  unrestricted_value?: string
  data?: Record<string, unknown>
}

async function query(type: DadataSuggestType, payload: Record<string, unknown>): Promise<RawSuggestion[]> {
  const token = process.env.DADATA_API_KEY
  if (!token) throw new DadataError('DADATA_API_KEY не задан в окружении')

  const res = await fetch(`${DADATA_BASE}/suggest/${type}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Token ${token}`,
    },
    body: JSON.stringify(payload),
    // Подсказки меняются редко, но кэш Next.js тут не нужен: запросы уникальны
    // по строке ввода, а Data Cache только раздувался бы.
    cache: 'no-store',
  })

  if (!res.ok) throw new DadataError(`DaData вернула ${res.status}`, res.status)
  const json = (await res.json()) as { suggestions?: RawSuggestion[] }
  return json.suggestions ?? []
}

function str(data: Record<string, unknown> | undefined, path: string): string | null {
  if (!data) return null
  const value = path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key]
    return undefined
  }, data)
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  return s === '' ? null : s
}

function num(data: Record<string, unknown> | undefined, key: string): number | null {
  const raw = str(data, key)
  if (raw === null) return null
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) ? n : null
}

export async function suggestParty(input: string, count = 7): Promise<PartySuggestion[]> {
  const q = input.trim()
  if (q.length < 3) return []

  const suggestions = await query('party', { query: q, count })
  return suggestions.map((s) => ({
    name: str(s.data, 'name.short_with_opf') ?? s.value ?? '',
    fullName: str(s.data, 'name.full_with_opf') ?? s.unrestricted_value ?? s.value ?? '',
    inn: str(s.data, 'inn'),
    kpp: str(s.data, 'kpp'),
    ogrn: str(s.data, 'ogrn'),
    legalAddress: str(s.data, 'address.unrestricted_value') ?? str(s.data, 'address.value'),
    managerName: str(s.data, 'management.name'),
    managerPost: str(s.data, 'management.post'),
    type: str(s.data, 'type'),
    status: str(s.data, 'state.status'),
  }))
}

export async function suggestAddress(input: string, count = 7): Promise<AddressSuggestion[]> {
  const q = input.trim()
  if (q.length < 3) return []

  const suggestions = await query('address', { query: q, count })
  return suggestions.map((s) => ({
    value: s.value ?? '',
    unrestrictedValue: s.unrestricted_value ?? s.value ?? '',
    fiasId: str(s.data, 'fias_id'),
    postalCode: str(s.data, 'postal_code'),
    city: str(s.data, 'city') ?? str(s.data, 'settlement'),
    cityDistrict: str(s.data, 'city_district'),
    street: str(s.data, 'street_with_type'),
    house: str(s.data, 'house'),
    flat: str(s.data, 'flat'),
    latitude: num(s.data, 'geo_lat'),
    longitude: num(s.data, 'geo_lon'),
    metro: str(s.data, 'metro.0.name'),
  }))
}

export async function suggestBank(input: string, count = 7): Promise<BankSuggestion[]> {
  const q = input.trim()
  if (q.length < 3) return []

  const suggestions = await query('bank', { query: q, count })
  return suggestions.map((s) => ({
    name: str(s.data, 'name.payment') ?? s.value ?? '',
    bik: str(s.data, 'bic'),
    correspondentAccount: str(s.data, 'correspondent_account'),
    swift: str(s.data, 'swift'),
    address: str(s.data, 'address.value'),
  }))
}
