export type UserRole = 'admin' | 'manager' | 'agent' | 'accountant'

export type ClientStatus = 'new' | 'in_progress' | 'active' | 'closed' | 'vip' | 'blacklist'

export type PropertyType = 'apartment' | 'house' | 'commercial' | 'office' | 'warehouse' | 'land'

export type DealType = 'rent' | 'sale' | 'management' | 'subrent' | 'commercial'

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

export interface User {
  id: string
  email: string
  full_name: string
  role: UserRole
  phone?: string
  avatar_url?: string
  is_active: boolean
  created_at: string
}

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
  created_at: string
  updated_at: string
}

export interface ContactRepresentative {
  id: string
  contact_id: string
  full_name: string
  position?: string
  phone?: string
  email?: string
  basis_type: 'charter' | 'power_of_attorney' | 'other'
  basis_details?: string
  is_primary?: boolean
  created_at: string
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
  deal_type: DealType
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
  contract_number?: string
  contract_type: ContractType
  client_id?: string
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

export interface FileRecord {
  id: string
  file_name?: string
  file_url?: string
  file_type?: string
  contract_id?: string
  client_id?: string
  property_id?: string
  deal_id?: string
  uploaded_by?: string
  created_at: string
}

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
  client_id?: string
  owner_id?: string
  deal_id?: string
  property_id?: string
  contract_id?: string
  payment_id?: string
}

export interface Log {
  id: string
  user_id?: string
  action: string
  entity_type?: string
  entity_id?: string
  old_data?: Record<string, unknown>
  new_data?: Record<string, unknown>
  created_at: string
  user?: User
}

export interface DocumentTemplate {
  id: string
  name: string
  template_type: ContractType
  file_url: string
  created_by?: string
  created_at: string
}

export interface Deal {
  id: string
  deal_number?: number
  deal_type: DealType
  status: string
  client_id?: string
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

export interface CompanySettings {
  id: string
  name?: string
  inn?: string
  ogrn?: string
  address?: string
  phone?: string
  email?: string
  logo_url?: string
  created_at: string
  updated_at: string
}

// Supabase Database type (simplified)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any

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
  recurring_rule_id?: string
  legacy_payment_id?: string
  created_at: string
  created_by?: string
  // Relations
  category?: AccountingCategory
  contract?: { id: string; contract_number?: string; contract_type?: string }
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
