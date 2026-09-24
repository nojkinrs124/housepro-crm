/**
 * Расчёт одного показания из пакета (бот присылает сразу ГВС+ХВС+свет).
 *
 * Чистая функция: по ней считается начисление арендатору, поэтому проверяется
 * тестом. Файл намеренно без 'use client'.
 */
import { computeAmount, computeConsumption, detectAnomalies, type Reading } from './anomalies'

export interface PlannedReading {
  consumption: number | null
  amount: number | null
  warnings: string[]
}

export type PlanResult = PlannedReading | { error: string }

/**
 * `history` — прошлые показания счётчика от новых к старым (любые даты:
 * функция сама отбросит те, что позже `readingDate`).
 */
export function planReading(
  history: Reading[],
  readingDate: string,
  value: number,
  tariff: number | null | undefined,
): PlanResult {
  const earlier = history.filter(r => r.reading_date <= readingDate)
  const sameDay = earlier.find(r => r.reading_date === readingDate)
  if (sameDay) {
    return { error: `за ${readingDate} уже есть показание ${sameDay.value}` }
  }
  const previous = earlier[0] ?? null
  if (previous && value < previous.value) {
    return {
      error: `показание ${value} меньше предыдущего ${previous.value} (${previous.reading_date}) — проверьте цифру или замену прибора`,
    }
  }
  const consumption = computeConsumption(previous?.value ?? null, value)
  return {
    consumption,
    amount: computeAmount(consumption, tariff),
    warnings: detectAnomalies({ reading_date: readingDate, value }, earlier).map(a => a.message),
  }
}

export interface MeterRef {
  id: string
  kind: string
  title: string | null
}

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim()

/**
 * Какой счётчик объекта имеется в виду. Воды на кухне и в ванной — два разных
 * прибора одного вида, поэтому одного `kind` мало: различаем по названию.
 *
 * Возвращает счётчик, `null` (такого нет — завести новый) или ошибку, если
 * приборов этого вида несколько, а название не указано: угадывать нельзя —
 * показание кухни, записанное в ванную, ломает расход обоих.
 */
export function pickMeter<M extends MeterRef>(
  meters: M[],
  kind: string,
  title?: string | null,
): M | null | { error: string } {
  const sameKind = meters.filter(m => m.kind === kind)
  const wanted = title ? norm(title) : ''
  if (wanted) {
    const exact = sameKind.find(m => m.title && norm(m.title) === wanted)
    if (exact) return exact
    const partial = sameKind.filter(m => {
      const t = m.title ? norm(m.title) : ''
      return t !== '' && (t.includes(wanted) || wanted.includes(t))
    })
    if (partial.length === 1) return partial[0]
    // Один безымянный прибор этого вида — это он и есть.
    if (partial.length === 0 && sameKind.length === 1 && !sameKind[0].title) return sameKind[0]
    if (partial.length > 1) {
      return { error: `под «${title}» подходят несколько счётчиков: ${partial.map(m => m.title).join(', ')}` }
    }
    return null
  }
  if (sameKind.length === 0) return null
  if (sameKind.length === 1) return sameKind[0]
  return {
    error: `счётчиков этого вида несколько (${sameKind.map(m => m.title ?? 'без названия').join(', ')}) — укажите, какой`,
  }
}
