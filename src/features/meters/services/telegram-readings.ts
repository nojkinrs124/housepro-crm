/**
 * Показания счётчиков из Telegram — чистая логика сопоставления, предпросмотра
 * и append-only исправлений.
 *
 * Файл намеренно без 'use client' и без обращений к базе: по этим функциям
 * считаются начисления, поэтому они проверяются тестом, а не глазами. Роут
 * `/api/v1/meters` и предпросмотр (`dry_run`) вызывают ровно эти функции —
 * предпросмотр и запись не могут разойтись, потому что считает один код.
 */
import { planReading, type MeterRef } from './reading-batch'
import { METER_KIND_LABELS } from '@/features/meters/config/meter-kinds'
import type { Reading } from './anomalies'

/** Строка показания с идентификатором и обратной ссылкой исправления. */
export interface ReadingRow {
  id: string
  reading_date: string
  value: number
  /** Если задано — эта строка исправляет показание `corrects_reading_id`. */
  corrects_reading_id?: string | null
}

/**
 * Нормализация контура: «ХВС  кухня», «хвс кухня», «ХВС кухня» — одно и то же.
 * Регистр, ё/е и кратные пробелы не должны мешать сопоставлению, но совпадение
 * остаётся точным (не подстрокой): кухня и ванная — разные приборы.
 */
export function normalizeContour(s: string): string {
  return s.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim()
}

export interface TelegramMeterRef extends MeterRef {
  contour: string | null
  serial_number?: string | null
}

/**
 * Прибор, которым подписано показание. Строго: ищем действующий прибор по
 * точному контуру И виду. Ничего не заводим и не угадываем — если подписи нет
 * или прибор не найден, это ошибка, которую человек исправит в CRM.
 */
export function matchTelegramMeter<M extends TelegramMeterRef>(
  meters: M[],
  contour: string | null | undefined,
  kind: string,
): M | { error: string } {
  const want = normalizeContour(contour ?? '')
  if (!want) {
    return { error: 'не указан контур прибора — подпишите показание (например «ХВС кухня»)' }
  }
  const sameKind = meters.filter(m => m.kind === kind)
  const exact = sameKind.find(m => m.contour && normalizeContour(m.contour) === want)
  if (exact) return exact
  const kindLabel = METER_KIND_LABELS[kind] ?? kind
  return { error: `счётчик «${contour}» (${kindLabel}) не найден на объекте — заведите его в CRM` }
}

export interface TelegramPlan {
  consumption: number | null
  amount: number | null
  /** Значение предыдущего действующего показания, по которому посчитан расход. */
  previous_value: number | null
  warnings: string[]
  error?: string
  /**
   * Показание на эту дату уже есть, а исправление не запрошено. Молча
   * перезаписывать нельзя — сообщаем, что нужна явная правка.
   */
  manual_correction_required?: boolean
}

/**
 * Расчёт одного Telegram-показания по действующей истории. Обёртка над
 * `planReading`, которая отдельно размечает «на эту дату уже есть показание»:
 * это не отказ принять цифру, а требование оформить исправление явно
 * (append-only), и текст для человека другой.
 */
export function planTelegramReading(
  meter: { tariff: number | null },
  history: Reading[],
  readingDate: string,
  value: number,
): TelegramPlan {
  const earlier = history.filter(r => r.reading_date <= readingDate)
  const previous = earlier[0] ?? null
  const plan = planReading(history, readingDate, value, meter.tariff)
  if ('error' in plan) {
    const sameDay = earlier.some(r => r.reading_date === readingDate)
    if (sameDay) {
      return {
        consumption: null,
        amount: null,
        previous_value: previous?.value ?? null,
        warnings: [],
        error: `за ${readingDate} показание уже внесено — изменение оформляется исправлением, а не перезаписью`,
        manual_correction_required: true,
      }
    }
    return {
      consumption: null,
      amount: null,
      previous_value: previous?.value ?? null,
      warnings: [],
      error: plan.error,
    }
  }
  return {
    consumption: plan.consumption,
    amount: plan.amount,
    previous_value: previous?.value ?? null,
    warnings: plan.warnings,
  }
}

/**
 * Действующие (логические) показания. Исправленным считается показание, на
 * которое ссылается другое через `corrects_reading_id`; такие строки исключаются
 * из расчётов, а вместо них берётся исправление. Исходные строки остаются в
 * базе как есть — история не переписывается.
 */
export function logicalReadings<T extends ReadingRow>(rows: T[]): T[] {
  const corrected = new Set(
    rows.map(r => r.corrects_reading_id).filter((id): id is string => !!id),
  )
  return rows.filter(r => !corrected.has(r.id))
}

/**
 * Что именно исправляет новая строка. Явный `corrects_reading_id` — если он
 * задан; иначе действующее показание на ту же дату. Исправлять можно только
 * действующее показание (не исправленное ранее), иначе цепочка разъехалась бы.
 */
export function resolveCorrectionTarget<T extends ReadingRow>(
  rows: T[],
  readingDate: string,
  explicitId?: string | null,
): T | null {
  const logical = logicalReadings(rows)
  if (explicitId) return logical.find(r => r.id === explicitId) ?? null
  return logical.find(r => r.reading_date === readingDate) ?? null
}

/** Ключ повторной доставки апдейта: сообщение + прибор. */
export interface TelegramMessageRef {
  chat_id: number
  message_id: number
}

/**
 * Повторная доставка того же сообщения Telegram. Ключ — (чат, сообщение,
 * прибор): в одном сообщении может быть несколько приборов, поэтому `meter_id`
 * входит в ключ.
 */
export function isDuplicateTelegramReading(
  existing: Array<{ source_chat_id: number | null; source_message_id: number | null; meter_id: string }>,
  ref: TelegramMessageRef,
  meterId: string,
): boolean {
  return existing.some(
    r =>
      r.meter_id === meterId &&
      Number(r.source_chat_id) === ref.chat_id &&
      Number(r.source_message_id) === ref.message_id,
  )
}

/** Одна строка пакета из Telegram: `{kind, contour, serial_number, value}`. */
export interface TelegramLineInput {
  kind: string
  contour?: string | null
  serial_number?: string | null
  value: number
  tariff?: number | null
  correction_reason?: string | null
  corrects_reading_id?: string | null
}

/** Прибор объекта с действующей историей — вход предпросмотра. */
export interface PreviewMeter extends TelegramMeterRef {
  unit: string
  tariff: number | null
  history: ReadingRow[]
}

export interface TelegramPlannedLine {
  contour: string | null
  kind: string
  label: string
  meter_id: string | null
  unit: string | null
  value: number
  consumption: number | null
  amount: number | null
  previous_value: number | null
  tariff: number | null
  warnings: string[]
  error?: string
  /** Сообщение уже принималось — строку писать не нужно. */
  duplicate?: boolean
  /** Это исправление: `target_id` — исправляемое показание. */
  correction?: { target_id: string; reason: string }
  manual_correction_required?: boolean
}

/**
 * Предпросмотр пакета Telegram-показаний. Ничего не пишет: только сопоставляет
 * приборы, считает расход/сумму по действующей истории и размечает повторы и
 * исправления. Роут отдаёт это на `dry_run`, а затем повторяет тот же расчёт
 * при подтверждённой записи.
 */
export function buildTelegramPreview(
  lines: TelegramLineInput[],
  meters: PreviewMeter[],
  readingDate: string,
  opts: { ref?: TelegramMessageRef; existing?: Array<{ source_chat_id: number | null; source_message_id: number | null; meter_id: string }>; correctionReason?: string | null } = {},
): TelegramPlannedLine[] {
  return lines.map(line => {
    const label0 = line.contour?.trim() || METER_KIND_LABELS[line.kind] || line.kind
    const match = matchTelegramMeter(meters, line.contour, line.kind)
    if ('error' in match) {
      return {
        contour: line.contour ?? null,
        kind: line.kind,
        label: label0,
        meter_id: null,
        unit: null,
        value: line.value,
        consumption: null,
        amount: null,
        previous_value: null,
        tariff: null,
        warnings: [],
        error: match.error,
      }
    }
    const meter = match
    const label = line.contour?.trim() || meter.title || METER_KIND_LABELS[line.kind] || line.kind
    const duplicate = opts.ref && opts.existing
      ? isDuplicateTelegramReading(opts.existing, opts.ref, meter.id)
      : false

    // Серийный номер — не ключ сопоставления (ключ — контур и вид), но если он
    // расходится с прибором, это стоит сказать вслух: возможно, ошиблись прибором.
    const serialWarning =
      line.serial_number && meter.serial_number &&
      line.serial_number.trim() !== meter.serial_number.trim()
        ? `серийный номер «${line.serial_number}» не совпадает с прибором (№ ${meter.serial_number})`
        : null

    // Причина исправления: из строки, иначе — общая на пакет. Общая применяется
    // только к строкам, которые действительно исправляют показание (явный
    // corrects_reading_id или показание на ту же дату), чтобы не превратить
    // новое показание в исправление.
    const sameDayExists = meter.history.some(r => r.reading_date === readingDate)
    const reason =
      line.correction_reason?.trim() ||
      ((line.corrects_reading_id || sameDayExists) && opts.correctionReason?.trim()
        ? opts.correctionReason.trim()
        : '')
    if (reason) {
      const target = resolveCorrectionTarget(meter.history, readingDate, line.corrects_reading_id)
      if (!target) {
        return {
          contour: line.contour ?? null,
          kind: line.kind,
          label,
          meter_id: meter.id,
          unit: meter.unit,
          value: line.value,
          consumption: null,
          amount: null,
          previous_value: null,
          tariff: meter.tariff,
          warnings: serialWarning ? [serialWarning] : [],
          duplicate,
          error: `нечего исправлять: показание «${label}» за ${readingDate} не найдено`,
        }
      }
      const history = meter.history.filter(r => r.id !== target.id)
      const plan = planTelegramReading(meter, history, readingDate, line.value)
      return {
        contour: line.contour ?? null,
        kind: line.kind,
        label,
        meter_id: meter.id,
        unit: meter.unit,
        value: line.value,
        consumption: plan.consumption,
        amount: plan.amount,
        previous_value: plan.previous_value,
        tariff: meter.tariff,
        warnings: serialWarning ? [...plan.warnings, serialWarning] : plan.warnings,
        error: plan.error,
        duplicate,
        correction: { target_id: target.id, reason },
      }
    }

    const plan = planTelegramReading(meter, meter.history, readingDate, line.value)
    return {
      contour: line.contour ?? null,
      kind: line.kind,
      label,
      meter_id: meter.id,
      unit: meter.unit,
      value: line.value,
      consumption: plan.consumption,
      amount: plan.amount,
      previous_value: plan.previous_value,
      tariff: meter.tariff,
      warnings: serialWarning ? [...plan.warnings, serialWarning] : plan.warnings,
      error: plan.error,
      duplicate,
      manual_correction_required: plan.manual_correction_required,
    }
  })
}

export function formatTelegramAuditLabel(
  propertyTitle: string,
  readingDate: string,
  requester: string | null,
): string {
  const base = `Показания счётчиков из Telegram: ${propertyTitle} (${readingDate})`
  return requester ? `${base} (${requester})` : base
}
