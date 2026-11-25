import { z } from 'zod'
import { METER_KINDS } from '@/features/meters/config/meter-kinds'

// Схема только для /api/v1/meters (Telegram-бот), формы UI сюда не ходят —
// тот же приём, что в tasks-api.ts и accounting-api.ts.
//
// Контракт согласован с плагином бота:
//   { property_id, reading_date, readings: [{kind, contour, serial_number, value}],
//     source: 'telegram', telegram: {user_id, username, chat_id, thread_id, message_id},
//     photo_urls: [url], dry_run?: true }
// `tariff`/`note` оставлены для обратной совместимости (старый бот их присылал),
// `correction_reason`/`corrects_reading_id` — append-only исправление показания.

const KIND_VALUES = METER_KINDS.map(k => k.value) as [string, ...string[]]

/** http(s)-ссылка на фото. Проверяем схему регуляркой, а не `z.url()`: список
 *  допустимых URL ограничен публичными ссылками нашего хранилища и Telegram. */
const photoUrl = z
  .string()
  .trim()
  .regex(/^https?:\/\/\S+$/i, 'Ссылка на фото должна начинаться с http(s)://')

export const MeterReadingLineSchema = z.object({
  kind: z.enum(KIND_VALUES, { message: 'Неизвестный тип счётчика' }),
  // Контур прибора: «ХВС кухня», «ГВС ванная». Ключ сопоставления с прибором
  // объекта (вместе с видом) — без него бот не угадывает и не заводит прибор.
  contour: z.string().trim().max(100).nullable().optional(),
  // Серийный номер — необязательное подтверждение; ключ сопоставления — контур+вид.
  serial_number: z.string().trim().max(100).nullable().optional(),
  value: z.coerce.number().min(0, 'Показание не может быть отрицательным'),
  // Тариф необязателен и для Telegram игнорируется: бот тариф не меняет.
  tariff: z.coerce.number().positive().nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
  // Append-only исправление: причина обязательна, если это правка существующего
  // показания. Исходная строка не перезаписывается — новая ссылается на неё.
  correction_reason: z.string().trim().min(1, 'Причина исправления обязательна').max(300).nullable().optional(),
  corrects_reading_id: z.string().uuid('Некорректный UUID показания').nullable().optional(),
})

export const TelegramSourceSchema = z.object({
  user_id: z.coerce.number().int().nullable().optional(),
  username: z.string().trim().max(200).nullable().optional(),
  chat_id: z.coerce.number().int(),
  thread_id: z.coerce.number().int().nullable().optional(),
  message_id: z.coerce.number().int(),
})

export const MeterReadingsBatchSchema = z
  .object({
    property_id: z.string().uuid('Некорректный UUID объекта'),
    reading_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'reading_date — YYYY-MM-DD')
      .nullable()
      .optional(),
    source: z.enum(['manager', 'tenant', 'telegram']).nullable().optional(),
    telegram: TelegramSourceSchema.nullable().optional(),
    photo_urls: z.array(photoUrl).max(10, 'Не больше 10 фото на пакет').optional(),
    // Общая причина исправления на весь пакет (1–300 символов). Бот парсит её
    // один раз и проставляет на строки-исправления; здесь — запасной источник,
    // если причина не продублирована в строке.
    correction_reason: z.string().trim().min(1, 'Причина исправления обязательна').max(300).nullable().optional(),
    dry_run: z.boolean().optional(),
    readings: z.array(MeterReadingLineSchema).min(1, 'Нет ни одного показания').max(10),
  })
  .superRefine((val, ctx) => {
    if (val.source !== 'telegram') return
    if (!val.telegram) {
      ctx.addIssue({ code: 'custom', path: ['telegram'], message: 'Для source=telegram нужен блок telegram' })
    }
    // Строгое сопоставление: без контура прибор не найти, а угадывать нельзя.
    val.readings.forEach((line, i) => {
      if (!line.contour || !line.contour.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['readings', i, 'contour'],
          message: 'Для Telegram укажите контур прибора (например «ХВС кухня»)',
        })
      }
    })
  })

export type MeterReadingsBatchInput = z.infer<typeof MeterReadingsBatchSchema>
export type MeterReadingLineInput = z.infer<typeof MeterReadingLineSchema>
export type TelegramSourceInput = z.infer<typeof TelegramSourceSchema>
