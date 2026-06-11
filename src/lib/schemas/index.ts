import { z } from 'zod'

// ─── Общие примитивы ─────────────────────────────────────────────────────────

const optStr = z.string().trim().nullable().optional()
const optDate = z.string().date().nullable().optional()
const optPositiveNum = z
  .union([z.string(), z.number()])
  .transform((v) => (v === '' || v === null || v === undefined ? null : Number(v)))
  .refine((v) => v === null || (!isNaN(v) && v > 0), { message: 'Укажите положительное число' })
  .nullable()
  .optional()
const uuid = z.string().uuid().nullable().optional()

// ─── Contact ──────────────────────────────────────────────────────────────────

export const ContactSchema = z.object({
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
  // Паспорт
  passport_series: optStr,
  passport_number: optStr,
  passport_issued_date: optDate,
  passport_issued_by: optStr,
  passport_department_code: optStr,
  // Адрес
  country: optStr,
  region: optStr,
  city: optStr,
  street: optStr,
  house_number: optStr,
  building: optStr,
  apartment: optStr,
})

export type ContactInput = z.infer<typeof ContactSchema>

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
      'sale_apartment',
      'sale_house',
      'property_management',
      'sublease',
      'agency_contract',
    ],
    { message: 'Неверный тип договора' }
  ),
  status: z
    .enum(['draft', 'generated', 'signed', 'completed', 'cancelled'])
    .optional()
    .default('draft'),
  owner_contact_id: uuid,
  client_contact_id: uuid,
  client_id: uuid,
  property_id: uuid,
  amount: optPositiveNum,
  deposit: optPositiveNum,
  start_date: optDate,
  end_date: optDate,
  notes: optStr,
})

export type ContractInput = z.infer<typeof ContractSchema>
