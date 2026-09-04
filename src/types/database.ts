import type { CounterpartySnapshot } from '@/features/contacts/config/counterparty'

export type UserRole = 'admin' | 'manager' | 'agent' | 'accountant'

export type ClientStatus = 'new' | 'in_progress' | 'active' | 'closed' | 'vip' | 'blacklist'

export type PropertyType = 'apartment' | 'house' | 'commercial' | 'office' | 'warehouse' | 'land'

/**
 * Направление работы — то, что лежит в `deals.deal_type`.
 *
 * Не путать с `PropertyPurpose` ниже: у объекта и лида колонка называется так же,
 * но означает другое — назначение объекта, а не процесс агентства. До 03.09.2026
 * оба смысла обслуживал один словарь `DEAL_TYPE_LABELS`, из-за чего в каталоге
 * сайта и в реестре лидов показывались названия воронок.
 */
export type Direction = 'rent_agent' | 'management' | 'sale' | 'tenant_search'

/** @deprecated Читать как `Direction`. Оставлено, чтобы не переписывать импорты разом. */
export type DealType = Direction

/** Назначение объекта — `properties.deal_type` и `leads.deal_type`. */
export type PropertyPurpose = 'rent' | 'sale' | 'management' | 'subrent'

/**
 * Стадия работы — `deals.status`. Объединение стадий всех направлений: коды
 * переиспользуются там, где это один и тот же шаг, поэтому принадлежность стадии
 * всегда проверяется парой (направление, стадия), а не одним значением.
 */
export type DealStage =
  | 'sourcing' | 'inquiry'
  | 'meeting' | 'valuation'
  | 'agency_contract' | 'mgmt_contract' | 'search_contract'
  | 'handover' | 'docs_check'
  | 'preparation' | 'searching'
  | 'showings' | 'collection_sent' | 'viewings'
  | 'tenant_check' | 'preliminary'
  | 'move_in' | 'main_contract' | 'rent_contract'
  | 'registration'
  | 'in_service' | 'completed' | 'cancelled'

/** Схема расчёта с собственником при управлении — `contracts.settlement_scheme`. */
export type SettlementScheme = 'percent' | 'fixed'

/** Способ начисления вознаграждения — `service_plans.charge_type`. */
export type ChargeType = 'deal_percent' | 'monthly_percent' | 'owner_fixed' | 'flat_fee' | 'negotiated'

/** Состояние объекта в управлении — `management_engagements.status`. */
export type EngagementStatus = 'onboarding' | 'active' | 'paused' | 'ended'

/** За чей счёт расход — `accounting_transactions.borne_by`. */
export type ExpenseBearer = 'agency' | 'owner'

/** Источник показания счётчика — `meter_readings.source`. */
export type ReadingSource = 'manager' | 'tenant'

/** Статус заявки на бытовую услугу — `service_requests.status`. */
export type ServiceRequestStatus = 'new' | 'accepted' | 'in_progress' | 'done' | 'rejected'

/** Роль внешнего пользователя в личном кабинете — `portal_access.role`. */
export type PortalRole = 'owner' | 'tenant'

/** Отметки чек-листов стадий — `deals.stage_progress`: код стадии → закрытые пункты. */
export type StageProgress = Record<string, string[]>

export type PropertyStatus = 'available' | 'reserved' | 'rented' | 'sold' | 'inactive'

export type ContractType =
  | 'rent_apartment'
  | 'rent_commercial'
  | 'sale'
  | 'agency_owner'
  | 'agency_client'
  | 'agency_legal_entity'
  | 'property_management'
  | 'sublease'

export type ContractStatus = 'draft' | 'generated' | 'signed' | 'completed' | 'cancelled'

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled'

export type TaskPriority = 'low' | 'medium' | 'high'

/**
 * Сотрудник. Форма берётся из схемы — раньше здесь были 8 полей из 13, и половина
 * значилась обязательной, хотя колонка nullable.
 * `role` в базе просто text, приложение сужает его до UserRole.
 */
export type User = Omit<Row<'users'>, 'role'> & { role: UserRole }

/**
 * Минимум для «шапки» интерфейса — сайдбар, хедер, мобильная навигация.
 * Страницы тянут эти поля частичным select'ом, полная строка им не нужна.
 */
export type UserBadge = Pick<Row<'users'>, 'id' | 'full_name' | 'avatar_url' | 'role'>

export type ContactRole = 'client' | 'owner' | 'both'
export type ContactStatus = 'new' | 'active' | 'vip' | 'inactive'

export interface Contact {
  id: string
  full_name: string
  phone?: string
  telegram?: string
  whatsapp?: string
  email?: string
  // Legacy field
  passport?: string
  // Structured passport fields
  passport_series?: string
  passport_number?: string
  passport_issued_date?: string
  passport_issued_by?: string
  passport_department_code?: string
  birth_date?: string
  role: ContactRole
  // Address
  country?: string
  region?: string
  city?: string
  street?: string
  house_number?: string
  building?: string
  apartment?: string
  comment?: string
  source?: string
  status: ContactStatus
  // Тип лица и реквизиты юрлица
  client_type?: 'individual' | 'legal_entity'
  company_name?: string
  inn?: string
  kpp?: string
  ogrn?: string
  legal_address?: string
  bank_name?: string
  bank_account?: string
  corr_account?: string
  bik?: string
  // Ответственный риелтор — колонка «Риелтор» в реестре контактов
  manager_id?: string
  // Снимок последней проверки контрагента в ЕГРЮЛ (см. counterparty.actions.ts)
  counterparty_check?: CounterpartySnapshot | null
  counterparty_checked_at?: string | null
  // Согласие на обработку ПДн (152-ФЗ)
  consent_pd_at?: string | null
  consent_pd_version?: string | null
  consent_source?: string | null
  consent_revoked_at?: string | null
  // Ссылка на основную карточку, если этот контакт был слит как дубль
  merged_into?: string | null
  created_at: string
  updated_at: string
}


export interface Client {
  id: string
  full_name: string
  phone?: string
  telegram?: string
  whatsapp?: string
  passport?: string
  birth_date?: string
  comment?: string
  source?: string
  status: ClientStatus
  manager_id?: string
  created_at: string
  manager?: User
}

export interface Owner {
  id: string
  full_name: string
  phone?: string
  passport?: string
  comment?: string
  created_at: string
}

export interface Property {
  id: string
  title: string
  property_type: PropertyType
  deal_type: PropertyPurpose
  address: string
  district?: string
  price?: number
  deposit?: number
  area?: number
  living_area?: number
  kitchen_area?: number
  rooms?: number
  floor?: number
  total_floors?: number
  ceiling_height?: number
  // House/Building
  house_type?: string
  wall_material?: string
  year_built?: number
  has_elevator?: boolean
  has_parking?: boolean
  // Communications
  has_internet?: boolean
  has_tv?: boolean
  heating_type?: string
  water_supply_type?: string
  // Financial
  management_fee?: number
  utilities_included?: string
  // Ownership
  ownership_basis?: string
  land_area?: number
  cadastral_number?: string
  encumbrances?: string
  // Content
  description?: string
  photo_urls?: string[]
  video_url?: string
  // Relations
  owner_id?: string
  manager_id?: string
  status: PropertyStatus
  created_at: string
  updated_at?: string
  owner?: Owner
  manager?: User
  // Публичный сайт «ХаусПро» — объект виден анонимным посетителям /catalog
  site_publish?: boolean
  // Авито
  avito_publish?: boolean
  avito_status?: AvitoPropertyStatus | null
  avito_ad_id?: string | null
  avito_error?: string | null
  avito_synced_at?: string | null
}

export type AvitoPropertyStatus = 'pending' | 'active' | 'error' | 'removed'

export interface AvitoSettings {
  id: string
  organization_id: string
  client_id?: string | null
  client_secret?: string | null
  avito_user_id?: string | null
  contact_phone?: string | null
  feed_token: string
  is_enabled: boolean
  access_token?: string | null
  token_expires_at?: string | null
  last_synced_at?: string | null
  last_sync_error?: string | null
  created_at: string
  updated_at: string
}

export interface Contract {
  id: string
  contract_number?: string | null
  contract_type: ContractType
  owner_contact_id?: string
  client_contact_id?: string
  owner_representative_id?: string
  client_representative_id?: string
  property_id?: string
  deal_id?: string
  base_contract_id?: string
  company_profile_id?: string
  manager_id?: string
  start_date?: string
  end_date?: string
  amount?: number
  deposit?: number
  // Данные, специфичные для типа договора (сейчас используется только rent_apartment) —
  // см. RentApartmentDataSchema в src/lib/schemas/index.ts
  contract_type_data?: Record<string, unknown>
  status: ContractStatus
  generated_docx_url?: string
  generated_pdf_url?: string
  created_at: string
  client?: Client
  property?: Property
  manager?: User
}

/** Загруженный файл. Все поля кроме id в базе nullable — так и есть в схеме. */
export type FileRecord = Row<'files'>

export interface Task {
  id: string
  title: string
  description?: string
  assigned_to?: string
  created_by?: string
  status: TaskStatus
  priority: TaskPriority
  deadline?: string
  created_at: string
  assignee?: User
  // Relationships
  lead_id?: string
  /** Контакт задачи. Раньше назывался client_id и указывал на удалённую таблицу clients. */
  contact_id?: string
  deal_id?: string
  property_id?: string
  contract_id?: string
  payment_id?: string
}



export interface Deal {
  id: string
  deal_number?: number
  deal_type: DealType
  status: string
  property_id?: string
  owner_contact_id?: string
  client_contact_id?: string
  owner_representative_id?: string
  client_representative_id?: string
  amount?: number
  commission?: number
  notes?: string
  manager_id?: string
  // Условия сделки — блок «Объект и условия» на карточке
  advance_amount?: number
  down_payment?: number
  bargain_amount?: number
  expected_close_date?: string
  bank_approval_date?: string
  payment_method?: string
  bank_name?: string
  source?: string
  created_at: string
  updated_at?: string
}


// Схема БД — генерируется из живой базы, править руками нечего.
// Перегенерировать после миграции: npm run db:types
export type { Database, Json } from './supabase'

type Tables = import('./supabase').Database['public']['Tables']

/** Строка таблицы прямо из схемы: Row<'deals'>, Row<'showings'>. */
export type Row<T extends keyof Tables> = Tables[T]['Row']

/** Payload для .insert() — обязательные колонки обязательны, остальные нет. */
export type Insert<T extends keyof Tables> = Tables[T]['Insert']

/**
 * Payload для .update() — все поля необязательны.
 * Использовать вместо `Record<string, unknown>`: тот отключает проверку имён
 * колонок, и опечатка вроде `company_type` вместо `legal_form` доходит до прода.
 */
export type Update<T extends keyof Tables> = Tables[T]['Update']

export type PaymentStatus = 'pending' | 'paid' | 'partial' | 'overdue' | 'cancelled'
export type PaymentType = 'rent' | 'deposit' | 'commission' | 'penalty' | 'other'

export interface Payment {
  id: string
  contract_id?: string
  amount: number
  payment_type?: PaymentType
  payment_status?: PaymentStatus
  payment_date?: string
  due_date?: string
  notes?: string
  created_by?: string
  created_at: string
  contract?: Contract
  created_by_user?: User
}

// ─── Accounting Module ────────────────────────────────────────────────────────

export type AccountingTransactionType = 'income' | 'expense'
export type AccountingTransactionStatus = 'planned' | 'completed' | 'cancelled'
export type AccountingPaymentMethod = 'cash' | 'bank' | 'card' | 'other'
export type AccountingFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface AccountingCategory {
  id: string
  name: string
  type: AccountingTransactionType
  color: string
  icon: string
  is_system: boolean
  sort_order: number
  created_at: string
  created_by?: string
}

export interface AccountingRecurringRule {
  id: string
  name: string
  type: AccountingTransactionType
  amount: number
  category_id?: string
  frequency: AccountingFrequency
  day_of_month?: number
  start_date: string
  end_date?: string
  employee_id?: string
  notes?: string
  is_active: boolean
  last_generated_date?: string
  created_at: string
  created_by?: string
  // Relations
  category?: AccountingCategory
  employee?: User
}

export interface AccountingTransaction {
  id: string
  type: AccountingTransactionType
  amount: number
  category_id?: string
  date: string
  description?: string
  status: AccountingTransactionStatus
  payment_method?: AccountingPaymentMethod
  due_date?: string
  contract_id?: string
  deal_id?: string
  contact_id?: string
  employee_id?: string
  property_id?: string
  /** Обслуживание объекта: по нему операция попадает во взаиморасчёт с собственником. */
  engagement_id?: string | null
  /** За чей счёт расход — от этого зависит, чей результат он уменьшает. */
  borne_by?: 'agency' | 'owner' | null
  recurring_rule_id?: string
  legacy_payment_id?: string
  created_at: string
  created_by?: string
  // Relations
  category?: AccountingCategory
  contract?: { id: string; contract_number?: string | null; contract_type?: string }
  property?: { id: string; title?: string; address?: string }
  deal?: { id: string; deal_type?: string }
  contact?: { id: string; full_name: string }
  employee?: User
}

export interface AccountingStats {
  totalIncome: number
  totalExpense: number
  profit: number
  incomeThisMonth: number
  expenseThisMonth: number
  profitThisMonth: number
  plannedIncome: number
  plannedExpense: number
}
