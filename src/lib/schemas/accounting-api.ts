import { z } from 'zod'
import { ALL_STAGE_VALUES } from '@/features/directions/config/directions'

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

/**
 * Смена стадии сделки через публичный API.
 *
 * Список стадий не дублируется здесь: он зависит от направления работы и живёт
 * в конфиге направлений. Своя копия тут осталась на старых шести стадиях, и
 * после перехода на направления API отвергал валидное `showings`, а
 * `negotiation` пропускал — тот падал уже на CHECK в базе, отдавая наружу 500
 * вместо внятной ошибки.
 *
 * Принадлежность стадии направлению проверяет сам роут: она зависит от данных
 * сделки, а не от формы запроса.
 */
export const DealStatusUpdateSchema = z.object({
  status: z.string().refine(v => ALL_STAGE_VALUES.includes(v), {
    message: 'Неизвестная стадия сделки',
  }),
})
