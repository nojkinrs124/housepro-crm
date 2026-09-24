import { z } from 'zod'
import { METER_KINDS } from '@/features/meters/config/meter-kinds'

// Схема только для /api/v1/meters (Telegram-бот), формы UI сюда не ходят —
// тот же приём, что в tasks-api.ts и accounting-api.ts.

const KIND_VALUES = METER_KINDS.map(k => k.value) as [string, ...string[]]

export const MeterReadingLineSchema = z.object({
  kind: z.enum(KIND_VALUES, { message: 'Неизвестный тип счётчика' }),
  value: z.coerce.number().min(0, 'Показание не может быть отрицательным'),
  // Тариф необязателен: если передан — обновляет тариф счётчика и участвует
  // в расчёте этого показания; если нет — берётся текущий тариф счётчика.
  tariff: z.coerce.number().positive().nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
})

export const MeterReadingsBatchSchema = z.object({
  property_id: z.string().uuid('Некорректный UUID объекта'),
  reading_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'reading_date — YYYY-MM-DD')
    .nullable()
    .optional(),
  readings: z.array(MeterReadingLineSchema).min(1, 'Нет ни одного показания').max(10),
})

export type MeterReadingsBatchInput = z.infer<typeof MeterReadingsBatchSchema>
