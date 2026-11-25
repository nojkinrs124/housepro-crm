import { describe, it, expect } from 'vitest'
import { MeterReadingsBatchSchema } from '@/lib/schemas/meters-api'
import {
  normalizeContour,
  matchTelegramMeter,
  planTelegramReading,
  logicalReadings,
  resolveCorrectionTarget,
  isDuplicateTelegramReading,
  buildTelegramPreview,
  formatTelegramAuditLabel,
  type PreviewMeter,
} from '@/features/meters/services/telegram-readings'
import { validateReadingPhoto, photoExtension, READING_PHOTO_MAX_BYTES } from '@/features/meters/services/photo-upload'

const r = (date: string, value: number, id = date) => ({ id, reading_date: date, value })

describe('MeterReadingsBatchSchema — контракт бота', () => {
  const base = {
    property_id: '11111111-1111-4111-8111-111111111111',
    reading_date: '2026-11-23',
    source: 'telegram',
    telegram: { user_id: 42, username: '@ivan', chat_id: -1004299917388, thread_id: 99, message_id: 555 },
    readings: [{ kind: 'cold_water', contour: 'ХВС кухня', serial_number: '12345', value: 123.4 }],
    photo_urls: ['https://x.supabase.co/storage/v1/object/public/files/a.jpg'],
    dry_run: true,
  }

  it('принимает пакет из Telegram как есть', () => {
    expect(MeterReadingsBatchSchema.safeParse(base).success).toBe(true)
  })

  it('source=telegram без блока telegram — ошибка', () => {
    const res = MeterReadingsBatchSchema.safeParse({ ...base, telegram: undefined })
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error.issues.some(i => i.path.includes('telegram'))).toBe(true)
  })

  it('source=telegram без контура в строке — ошибка', () => {
    const res = MeterReadingsBatchSchema.safeParse({
      ...base,
      readings: [{ kind: 'cold_water', value: 1 }],
    })
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error.issues.some(i => i.path.includes('contour'))).toBe(true)
  })

  it('dry_run — строго boolean', () => {
    expect(MeterReadingsBatchSchema.safeParse({ ...base, dry_run: 'yes' }).success).toBe(false)
  })

  it('photo_urls без схемы http(s) — ошибка', () => {
    expect(MeterReadingsBatchSchema.safeParse({ ...base, photo_urls: ['ftp://x/a.jpg'] }).success).toBe(false)
  })

  it('старый пакет менеджера без source и контура остаётся валидным', () => {
    const res = MeterReadingsBatchSchema.safeParse({
      property_id: base.property_id,
      readings: [{ kind: 'electricity', value: 7449 }],
    })
    expect(res.success).toBe(true)
  })

  it('top-level correction_reason — от 1 до 300 символов', () => {
    expect(MeterReadingsBatchSchema.safeParse({ ...base, correction_reason: 'опечатка в цифре' }).success).toBe(true)
    expect(MeterReadingsBatchSchema.safeParse({ ...base, correction_reason: '' }).success).toBe(false)
    expect(MeterReadingsBatchSchema.safeParse({ ...base, correction_reason: 'x'.repeat(301) }).success).toBe(false)
  })

  it('per-line correction_reason тоже ограничен', () => {
    const res = MeterReadingsBatchSchema.safeParse({
      ...base,
      readings: [{ kind: 'cold_water', contour: 'ХВС кухня', value: 1, correction_reason: 'x'.repeat(301) }],
    })
    expect(res.success).toBe(false)
  })
})

describe('formatTelegramAuditLabel', () => {
  it('records the Telegram actor in the audit label', () => {
    expect(formatTelegramAuditLabel('Квартира 83', '2026-11-23', 'Telegram @manager (id 42)'))
      .toBe('Показания счётчиков из Telegram: Квартира 83 (2026-11-23) (Telegram @manager (id 42))')
  })
})

describe('normalizeContour', () => {
  it('регистр, ё/е и кратные пробелы не мешают', () => {
    expect(normalizeContour('  ГВС  Ванная ')).toBe(normalizeContour('гвс ванная'))
    expect(normalizeContour('ХВС кухня')).toBe(normalizeContour('хвс  КУХНЯ'))
  })
})

describe('matchTelegramMeter — строго по контуру и виду', () => {
  const meters = [
    { id: 'm1', kind: 'cold_water', title: 'ХВС кухня', contour: 'ХВС кухня' },
    { id: 'm2', kind: 'cold_water', title: 'ХВС ванная', contour: 'ХВС ванная' },
    { id: 'm3', kind: 'electricity', title: 'Свет', contour: 'Свет' },
  ]

  it('находит по точному контуру и виду', () => {
    expect(matchTelegramMeter(meters, 'ХВС ванная', 'cold_water')).toMatchObject({ id: 'm2' })
  })

  it('контур совпадает с точностью до регистра/ё', () => {
    expect(matchTelegramMeter(meters, 'хвс  КУХНЯ', 'cold_water')).toMatchObject({ id: 'm1' })
  })

  it('вид не тот — не находит (не угадывает)', () => {
    expect(matchTelegramMeter(meters, 'ХВС кухня', 'hot_water')).toHaveProperty('error')
  })

  it('нет прибора — ошибка, а не «завести новый»', () => {
    expect(matchTelegramMeter(meters, 'ГВС кухня', 'hot_water')).toHaveProperty('error')
  })

  it('пустой контур — ошибка', () => {
    expect(matchTelegramMeter(meters, '   ', 'cold_water')).toHaveProperty('error')
    expect(matchTelegramMeter(meters, null, 'cold_water')).toHaveProperty('error')
  })
})

describe('planTelegramReading', () => {
  const meter = { tariff: 38.06 }

  it('первое показание — без расхода, суммы и предыдущего', () => {
    expect(planTelegramReading(meter, [], '2026-11-23', 100)).toMatchObject({
      consumption: null, amount: null, previous_value: null,
    })
  })

  it('считает расход, сумму и предыдущее значение', () => {
    const plan = planTelegramReading(meter, [r('2026-10-23', 100)], '2026-11-23', 106.25)
    expect(plan).toMatchObject({ consumption: 6.25, amount: 237.88, previous_value: 100 })
  })

  it('без тарифа — расход есть, суммы нет', () => {
    expect(planTelegramReading({ tariff: null }, [r('2026-10-23', 10)], '2026-11-23', 15))
      .toMatchObject({ consumption: 5, amount: null, previous_value: 10 })
  })

  it('показание меньше предыдущего — ошибка', () => {
    expect(planTelegramReading(meter, [r('2026-10-23', 500)], '2026-11-23', 400)).toHaveProperty('error')
  })

  it('показание на ту же дату — ошибка с требованием исправления, без перезаписи', () => {
    const plan = planTelegramReading(meter, [r('2026-11-23', 500)], '2026-11-23', 510)
    expect(plan).toHaveProperty('error')
    expect(plan.manual_correction_required).toBe(true)
  })
})

describe('logicalReadings — действующие показания (append-only)', () => {
  it('исключает исправленное, оставляя исправление', () => {
    const rows = [
      { id: 'a', reading_date: '2026-10-23', value: 100, corrects_reading_id: null },
      { id: 'b', reading_date: '2026-10-23', value: 120, corrects_reading_id: 'a' },
      { id: 'c', reading_date: '2026-11-23', value: 150, corrects_reading_id: null },
    ]
    expect(logicalReadings(rows).map(x => x.id)).toEqual(['b', 'c'])
  })

  it('цепочка исправлений оставляет только последнее звено', () => {
    const rows = [
      { id: 'a', reading_date: '2026-10-23', value: 100, corrects_reading_id: null },
      { id: 'b', reading_date: '2026-10-23', value: 120, corrects_reading_id: 'a' },
      { id: 'c', reading_date: '2026-10-23', value: 130, corrects_reading_id: 'b' },
    ]
    expect(logicalReadings(rows).map(x => x.id)).toEqual(['c'])
  })

  it('исходные строки не удаляются из массива', () => {
    const rows = [
      { id: 'a', reading_date: '2026-10-23', value: 100, corrects_reading_id: null },
      { id: 'b', reading_date: '2026-10-23', value: 120, corrects_reading_id: 'a' },
    ]
    expect(logicalReadings(rows).map(x => x.id)).toEqual(['b'])
    // Исходная строка остаётся в массиве — история не переписывается.
    expect(rows).toHaveLength(2)
  })
})

describe('resolveCorrectionTarget', () => {
  const rows = [
    { id: 'a', reading_date: '2026-10-23', value: 100, corrects_reading_id: null },
    { id: 'b', reading_date: '2026-11-23', value: 150, corrects_reading_id: null },
  ]

  it('по умолчанию берёт действующее показание на ту же дату', () => {
    expect(resolveCorrectionTarget(rows, '2026-11-23')).toMatchObject({ id: 'b' })
  })

  it('явный идентификатор приоритетнее', () => {
    expect(resolveCorrectionTarget(rows, '2026-11-23', 'a')).toMatchObject({ id: 'a' })
  })

  it('нечего исправлять — null', () => {
    expect(resolveCorrectionTarget(rows, '2026-09-23')).toBeNull()
  })

  it('исправленное ранее показание целью не берётся', () => {
    const chain = [...rows, { id: 'c', reading_date: '2026-11-23', value: 160, corrects_reading_id: 'b' }]
    expect(resolveCorrectionTarget(chain, '2026-11-23', 'b')).toBeNull()
    expect(resolveCorrectionTarget(chain, '2026-11-23')).toMatchObject({ id: 'c' })
  })
})

describe('isDuplicateTelegramReading — повторная доставка апдейта', () => {
  const existing = [{ source_chat_id: -100, source_message_id: 5, meter_id: 'm1' }]

  it('тот же чат/сообщение/прибор — повтор', () => {
    expect(isDuplicateTelegramReading(existing, { chat_id: -100, message_id: 5 }, 'm1')).toBe(true)
  })

  it('другой прибор в том же сообщении — не повтор', () => {
    expect(isDuplicateTelegramReading(existing, { chat_id: -100, message_id: 5 }, 'm2')).toBe(false)
  })

  it('другое сообщение — не повтор', () => {
    expect(isDuplicateTelegramReading(existing, { chat_id: -100, message_id: 6 }, 'm1')).toBe(false)
  })
})

describe('buildTelegramPreview — предпросмотр dry_run', () => {
  const meters: PreviewMeter[] = [
    {
      id: 'm1', kind: 'cold_water', title: 'ХВС кухня', contour: 'ХВС кухня', serial_number: '12345',
      unit: 'м³', tariff: 38.06, history: [r('2026-10-23', 100)],
    },
    {
      id: 'm2', kind: 'hot_water', title: 'ГВС ванная', contour: 'ГВС ванная', serial_number: '99999',
      unit: 'м³', tariff: 209.1, history: [],
    },
  ]

  it('считает расход, сумму, предыдущее значение и тариф', () => {
    const [line] = buildTelegramPreview(
      [{ kind: 'cold_water', contour: 'ХВС кухня', value: 106.25 }],
      meters,
      '2026-11-23',
    )
    expect(line).toMatchObject({
      contour: 'ХВС кухня', kind: 'cold_water', value: 106.25,
      consumption: 6.25, amount: 237.88, previous_value: 100, tariff: 38.06,
      meter_id: 'm1', warnings: [],
    })
    expect(line.error).toBeUndefined()
  })

  it('неизвестный контур — ошибка и meter_id=null, ничего не заводим', () => {
    const [line] = buildTelegramPreview([{ kind: 'gas', contour: 'Газ', value: 5 }], meters, '2026-11-23')
    expect(line.meter_id).toBeNull()
    expect(line.error).toBeTruthy()
  })

  it('повтор сообщения помечается duplicate', () => {
    const [line] = buildTelegramPreview(
      [{ kind: 'cold_water', contour: 'ХВС кухня', value: 106.25 }],
      meters,
      '2026-11-23',
      { ref: { chat_id: -100, message_id: 5 }, existing: [{ source_chat_id: -100, source_message_id: 5, meter_id: 'm1' }] },
    )
    expect(line.duplicate).toBe(true)
  })

  it('показание на ту же дату без причины — manual_correction_required', () => {
    const withSameDay: PreviewMeter[] = [{ ...meters[0], history: [r('2026-11-23', 100)] }]
    const [line] = buildTelegramPreview(
      [{ kind: 'cold_water', contour: 'ХВС кухня', value: 110 }],
      withSameDay,
      '2026-11-23',
    )
    expect(line.manual_correction_required).toBe(true)
    expect(line.error).toBeTruthy()
  })

  it('исправление с причиной — ссылается на исходное показание и считает расход без него', () => {
    const withSameDay: PreviewMeter[] = [
      { ...meters[0], history: [r('2026-11-23', 150, 'b'), r('2026-10-23', 100, 'a')] },
    ]
    const [line] = buildTelegramPreview(
      [{ kind: 'cold_water', contour: 'ХВС кухня', value: 160, correction_reason: 'опечатка в цифре' }],
      withSameDay,
      '2026-11-23',
    )
    expect(line.correction).toEqual({ target_id: 'b', reason: 'опечатка в цифре' })
    expect(line).toMatchObject({ previous_value: 100, consumption: 60, amount: 2283.6 })
    expect(line.error).toBeUndefined()
  })

  it('серийный номер не совпал — предупреждение, но показание принимается', () => {
    const [line] = buildTelegramPreview(
      [{ kind: 'cold_water', contour: 'ХВС кухня', serial_number: '00000', value: 106.25 }],
      meters,
      '2026-11-23',
    )
    expect(line.error).toBeUndefined()
    expect(line.warnings.some(w => w.includes('серийный'))).toBe(true)
  })

  it('общий correction_reason применяется к строке с показанием на ту же дату', () => {
    const withSameDay: PreviewMeter[] = [
      { ...meters[0], history: [r('2026-11-23', 150, 'b'), r('2026-10-23', 100, 'a')] },
    ]
    const [line] = buildTelegramPreview(
      [{ kind: 'cold_water', contour: 'ХВС кухня', value: 160 }],
      withSameDay,
      '2026-11-23',
      { correctionReason: 'опечатка в цифре' },
    )
    expect(line.correction).toEqual({ target_id: 'b', reason: 'опечатка в цифре' })
  })

  it('явный corrects_reading_id + общий reason образуют исправление', () => {
    const withHist: PreviewMeter[] = [{ ...meters[0], history: [r('2026-10-23', 100, 'a')] }]
    const [line] = buildTelegramPreview(
      [{ kind: 'cold_water', contour: 'ХВС кухня', value: 110, corrects_reading_id: 'a' }],
      withHist,
      '2026-11-23',
      { correctionReason: 'перепутали прибор' },
    )
    expect(line.correction).toEqual({ target_id: 'a', reason: 'перепутали прибор' })
  })

  it('общий correction_reason не превращает новое показание в исправление', () => {
    const [line] = buildTelegramPreview(
      [{ kind: 'cold_water', contour: 'ХВС кухня', value: 160 }],
      meters,
      '2026-11-23',
      { correctionReason: 'опечатка' },
    )
    expect(line.correction).toBeUndefined()
    expect(line.error).toBeUndefined()
  })

  it('corrects_reading_id на уже исправленное показание — отказ', () => {
    // b исправлено через c → цель b недоступна
    const hist = [
      { id: 'b', reading_date: '2026-11-23', value: 150, corrects_reading_id: null },
      { id: 'c', reading_date: '2026-11-23', value: 160, corrects_reading_id: 'b' },
      { id: 'a', reading_date: '2026-10-23', value: 100, corrects_reading_id: null },
    ]
    const [line] = buildTelegramPreview(
      [{ kind: 'cold_water', contour: 'ХВС кухня', value: 170, corrects_reading_id: 'b', correction_reason: 'ещё раз' }],
      [{ ...meters[0], history: hist }],
      '2026-11-23',
    )
    expect(line.error).toBeTruthy()
  })
})

describe('validateReadingPhoto', () => {
  it('принимает JPEG, PNG, WEBP', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(validateReadingPhoto({ type, size: 1024 })).toBeNull()
    }
  })

  it('отклоняет прочие типы', () => {
    expect(validateReadingPhoto({ type: 'image/gif', size: 10 })).toBeTruthy()
    expect(validateReadingPhoto({ type: 'application/pdf', size: 10 })).toBeTruthy()
  })

  it('отклоняет пустой и слишком большой файл', () => {
    expect(validateReadingPhoto({ type: 'image/jpeg', size: 0 })).toBeTruthy()
    expect(validateReadingPhoto({ type: 'image/jpeg', size: READING_PHOTO_MAX_BYTES + 1 })).toBeTruthy()
    expect(validateReadingPhoto({ type: 'image/jpeg', size: READING_PHOTO_MAX_BYTES })).toBeNull()
  })

  it('расширение по MIME', () => {
    expect(photoExtension('image/jpeg')).toBe('jpg')
    expect(photoExtension('image/png')).toBe('png')
    expect(photoExtension('image/webp')).toBe('webp')
  })
})
