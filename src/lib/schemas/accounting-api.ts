import { z } from 'zod'

// Отдельный файл (не в schemas/index.ts) — эта схема используется только новым
// API v1 роутом для Telegram-бота, не формами в UI.

const uuid = z
  .string()
  .nullable()
  .optional()
  .transform((v) => (v === '' || v === null || v === undefined ? null : v))
  .refine((v) => v === null || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v), {
    message: 'Некорректный UUID',
  })

export const TransactionCreateSchema = z.object({
  type: z.enum(['income', 'expense'], { message: 'type должен быть income или expense' }),
  amount: z
    .union([z.string(), z.number()])
    .transform((v) => Number(v))
    .refine((v) => !isNaN(v) && v > 0, { message: 'amount должен быть положительным числом' }),
  category_id: uuid,
  description: z.string().trim().max(500).nullable().optional(),
  date: z
    .string()
    .optional()
    .transform((v) => (v ? v : new Date().toISOString().slice(0, 10)))
    .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v), { message: 'date должен быть в формате YYYY-MM-DD' }),
  status: z.enum(['completed', 'pending', 'planned']).default('completed'),
  payment_method: z.string().trim().max(100).nullable().optional(),
  contract_id: uuid,
  deal_id: uuid,
  contact_id: uuid,
})

export type TransactionCreateInput = z.infer<typeof TransactionCreateSchema>

export const DealStatusUpdateSchema = z.object({
  status: z.enum(['new', 'showing', 'negotiation', 'contract', 'payment', 'completed', 'cancelled'], {
    message: 'Неверный статус сделки',
  }),
})
