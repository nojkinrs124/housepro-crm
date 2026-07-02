import { z } from 'zod'

// ─── Общие примитивы ─────────────────────────────────────────────────────────

const optStr = z.string().trim().nullable().optional()
const optDate = z
  .string()
  .nullable()
  .optional()
  .transform(v => (v === '' || v === null || v === undefined ? null : v))
  .refine(v => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), { message: 'Некорректная дата' })
const optPositiveNum = z
  .union([z.string(), z.number()])
  .transform((v) => (v === '' || v === null || v === undefined ? null : Number(v)))
  .refine((v) => v === null || (!isNaN(v) && v > 0), { message: 'Укажите положительное число' })
  .nullable()
  .optional()
const uuid = z
  .string()
  .nullable()
  .optional()
  .transform(v => (v === '' || v === null || v === undefined ? null : v))
  .refine(v => v === null || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v), {
    message: 'Некорректный UUID',
  })

// ─── Contact ──────────────────────────────────────────────────────────────────

export const ContactSchema = z
  .object({
    full_name: z.string().trim().min(1, 'Имя обязательно').max(200, 'Максимум 200 символов'),
    phone: optStr,
    email: z
      .string()
      .trim()
      .email('Введите корректный email')
      .nullable()
      .optional()
      .or(z.literal(''))
      .transform((v) => v || null),
    telegram: optStr,
    whatsapp: optStr,
    birth_date: optDate,
    role: z.enum(['client', 'owner', 'both'], { message: 'Неверная роль' }),
    status: z.enum(['new', 'active', 'vip', 'inactive']).default('new'),
    source: optStr,
    comment: optStr,
    // Тип лица
    client_type: z.enum(['individual', 'legal_entity']).default('individual'),
    // Паспорт (физлицо)
    passport_series: optStr,
    passport_number: optStr,
    passport_issued_date: optDate,
    passport_issued_by: optStr,
    passport_department_code: optStr,
    // Адрес регистрации (физлицо)
    country: optStr,
    region: optStr,
    city: optStr,
    street: optStr,
    house_number: optStr,
    building: optStr,
    apartment: optStr,
    // Реквизиты (юрлицо)
    company_name: optStr,
    inn: optStr,
    kpp: optStr,
    ogrn: optStr,
    legal_address: optStr,
    bank_name: optStr,
    bank_account: optStr,
    corr_account: optStr,
    bik: optStr,
  })
  .superRefine((data, ctx) => {
    if (data.client_type === 'legal_entity') {
      if (!data.company_name) {
        ctx.addIssue({ code: 'custom', path: ['company_name'], message: 'Укажите название организации' })
      }
      if (!data.inn) {
        ctx.addIssue({ code: 'custom', path: ['inn'], message: 'Укажите ИНН' })
      }
    }
  })

export type ContactInput = z.infer<typeof ContactSchema>

// ─── Representative (представитель юрлица) ────────────────────────────────────

export const RepresentativeSchema = z.object({
  contact_id: z.string().uuid('Некорректный контакт'),
  full_name: z.string().trim().min(1, 'ФИО обязательно').max(200),
  position: optStr,
  phone: optStr,
  email: z
    .string()
    .trim()
    .email('Введите корректный email')
    .nullable()
    .optional()
    .or(z.literal(''))
    .transform((v) => v || null),
  basis_type: z.enum(['charter', 'power_of_attorney', 'other']).default('power_of_attorney'),
  basis_details: optStr,
  is_primary: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === 'on' || v === 'true')
    .optional(),
})

export type RepresentativeInput = z.infer<typeof RepresentativeSchema>

// ─── Deal ─────────────────────────────────────────────────────────────────────

export const DealSchema = z.object({
  deal_type: z.enum(['rent', 'sale', 'management', 'commercial', 'subrent'], {
    message: 'Неверный тип сделки',
  }),
  status: z
    .enum(['new', 'showing', 'negotiation', 'contract', 'payment', 'completed', 'cancelled'])
    .optional(),
  owner_contact_id: uuid,
  client_contact_id: uuid,
  owner_representative_id: uuid,
  client_representative_id: uuid,
  property_id: uuid,
  amount: optPositiveNum,
  commission: optPositiveNum,
  notes: optStr,
})

export type DealInput = z.infer<typeof DealSchema>

// ─── Payment ──────────────────────────────────────────────────────────────────

export const PaymentCreateSchema = z.object({
  contract_id: uuid,
  amount: z
    .union([z.string(), z.number()])
    .transform((v) => Number(v))
    .refine((v) => !isNaN(v) && v > 0, { message: 'Укажите корректную сумму' }),
  payment_type: z.string().min(1, 'Тип платежа обязателен').default('rent'),
  due_date: optDate,
  notes: optStr,
})

export const PaymentUpdateSchema = z.object({
  amount: z
    .union([z.string(), z.number()])
    .transform((v) => Number(v))
    .refine((v) => !isNaN(v) && v > 0, { message: 'Укажите корректную сумму' }),
  payment_type: z.string().min(1),
  payment_status: z.enum(['pending', 'paid', 'partial', 'overdue', 'cancelled'], {
    message: 'Недопустимый статус',
  }),
  due_date: optDate,
  notes: optStr,
})

export type PaymentCreateInput = z.infer<typeof PaymentCreateSchema>
export type PaymentUpdateInput = z.infer<typeof PaymentUpdateSchema>

// ─── Contract ─────────────────────────────────────────────────────────────────

export const ContractSchema = z.object({
  contract_type: z.enum(
    [
      'rent_apartment',
      'rent_commercial',
      'sale',
      'agency_owner',
      'agency_client',
      'agency_legal_entity',
      'property_management',
      'sublease',
    ],
    { message: 'Неверный тип договора' }
  ),
  status: z
    .enum(['draft', 'generated', 'signed', 'completed', 'cancelled'])
    .optional()
    .default('draft'),
  owner_contact_id: uuid,
  client_contact_id: uuid,
  owner_representative_id: uuid,
  client_representative_id: uuid,
  client_id: uuid,
  property_id: uuid,
  base_contract_id: uuid,
  company_profile_id: uuid,
  amount: optPositiveNum,
  deposit: optPositiveNum,
  start_date: optDate,
  end_date: optDate,
  notes: optStr,
})

export type ContractInput = z.infer<typeof ContractSchema>

// ─── Contract type-specific data (сейчас только rent_apartment) ───────────────

const optNonNegNum = z
  .union([z.string(), z.number()])
  .transform(v => (v === '' || v === null || v === undefined ? null : Number(v)))
  .refine(v => v === null || (!isNaN(v) && v >= 0), { message: 'Укажите неотрицательное число' })
  .nullable()
  .optional()

const optBool = z
  .union([z.boolean(), z.string()])
  .transform(v => v === true || v === 'true' || v === 'on')
  .optional()

export const CohabitantSchema = z.object({
  full_name: z.string().trim().min(1),
  passport: optStr,
})

export const InventoryItemSchema = z.object({
  name: z.string().trim().min(1),
  qty: optNonNegNum,
  unit_price: optNonNegNum,
  condition: optStr,
})

export const RentApartmentDataSchema = z.object({
  cohabitants: z.array(CohabitantSchema).default([]),
  children_count: optNonNegNum,
  pets_allowed: optBool,
  pets_species: optStr,
  pets_count: optNonNegNum,
  renewal_notice_months: optNonNegNum,
  termination_notice_days: optNonNegNum,
  late_return_penalty_per_day: optNonNegNum,
  landlord_access_notice_days: optNonNegNum,
  utilities_included_in_rent: optBool,
  utilities_paid_by_tenant: optStr,
  concierge_internet_payer: z.enum(['tenant', 'landlord']).optional(),
  copies_count: optNonNegNum,
  handover_date: optDate,
  handover_keys_count: optNonNegNum,
  electricity_meter_reading: optStr,
  hot_water_meter_reading: optStr,
  cold_water_meter_reading: optStr,
  inventory_items: z.array(InventoryItemSchema).default([]),
  return_date: optDate,
  return_keys_count: optNonNegNum,
  return_claims: optStr,
})

export type RentApartmentDataInput = z.infer<typeof RentApartmentDataSchema>
