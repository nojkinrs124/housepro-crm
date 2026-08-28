import { z } from 'zod'

// Отдельный файл (не в schemas/index.ts) — эти схемы используются только новым API v1
// роутом /api/v1/tasks для Telegram-бота, не формами в UI (см. src/lib/schemas/accounting-api.ts
// для того же паттерна на транзакциях).

const uuid = z
  .string()
  .nullable()
  .optional()
  .transform((v) => (v === '' || v === null || v === undefined ? null : v))
  .refine((v) => v === null || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v), {
    message: 'Некорректный UUID',
  })

export const TaskCreateSchema = z.object({
  title: z.string().trim().min(1, 'title обязателен').max(300),
  description: z.string().trim().max(2000).nullable().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  deadline: z
    .string()
    .nullable()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || !isNaN(Date.parse(v)), { message: 'deadline должен быть датой' }),
  deal_id: uuid,
  lead_id: uuid,
  property_id: uuid,
  contract_id: uuid,
})

export type TaskCreateInput = z.infer<typeof TaskCreateSchema>

export const TaskStatusUpdateSchema = z.object({
  status: z.enum(['todo', 'in_progress', 'done'], { message: 'Неверный статус задачи' }),
})
