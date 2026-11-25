import { computeAmount, computeConsumption } from './anomalies'
import { logicalReadings } from './telegram-readings'

export type MeterCorrectionInput = {
  value: number
  reading_date: string
  correction_reason: string
}

export type MeterCorrectionParseResult =
  | { ok: true; data: MeterCorrectionInput }
  | { ok: false; error: string }

export function parseMeterCorrectionInput(input: {
  value: unknown
  reading_date: unknown
  correction_reason: unknown
}): MeterCorrectionParseResult {
  const rawValue = String(input.value ?? '').replace(/\s/g, '').replace(',', '.')
  const value = Number(rawValue)
  if (!rawValue || !Number.isFinite(value) || value < 0) {
    return { ok: false, error: 'Введите корректное неотрицательное показание' }
  }

  const readingDate = typeof input.reading_date === 'string' ? input.reading_date : ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(readingDate)) {
    return { ok: false, error: 'Укажите дату показания' }
  }
  const parsedDate = new Date(`${readingDate}T00:00:00.000Z`)
  if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== readingDate) {
    return { ok: false, error: 'Укажите корректную дату показания' }
  }

  const correctionReason = typeof input.correction_reason === 'string'
    ? input.correction_reason.trim()
    : ''
  if (!correctionReason || correctionReason.length > 300) {
    return { ok: false, error: 'Укажите причину исправления (до 300 символов)' }
  }

  return {
    ok: true,
    data: { value, reading_date: readingDate, correction_reason: correctionReason },
  }
}

export function planMeterCorrection(input: {
  targetId: string
  input: MeterCorrectionInput
  tariff: number | null
  history: Array<{
    id: string
    reading_date: string
    value: number
    corrects_reading_id?: string | null
  }>
}):
  | { ok: true; data: MeterCorrectionInput & { target_id: string; previous_value: number | null; consumption: number | null; amount: number | null } }
  | { ok: false; error: string } {
  const target = input.history.find(row => row.id === input.targetId)
  if (!target) return { ok: false, error: 'Исходное показание не найдено' }
  if (target.reading_date !== input.input.reading_date) {
    return { ok: false, error: 'Дата исправления должна совпадать с датой исходного показания' }
  }

  const logical = logicalReadings(input.history)
  if (!logical.some(row => row.id === target.id)) {
    return { ok: false, error: 'Это показание уже исправлено — выберите последнюю версию' }
  }

  const previous = logical
    .filter(row => row.id !== target.id && row.reading_date < target.reading_date)
    .sort((a, b) => b.reading_date.localeCompare(a.reading_date))[0] ?? null
  if (previous && input.input.value < previous.value) {
    return { ok: false, error: `Показание меньше предыдущего (${previous.value})` }
  }

  const consumption = computeConsumption(previous?.value ?? null, input.input.value)
  const amount = computeAmount(consumption, input.tariff)

  return {
    ok: true,
    data: {
      ...input.input,
      target_id: target.id,
      previous_value: previous?.value ?? null,
      consumption,
      amount,
    },
  }
}
