/**
 * Расход по показаниям и поиск аномалий.
 *
 * Чистые функции без обращений к базе: по ним начисляются коммунальные платежи,
 * и ошибка здесь превращается в неверный счёт собственнику или арендатору —
 * такое обязано проверяться тестом, а не глазами.
 *
 * Файл намеренно без 'use client'.
 */

/** Разрыв больше этого — показания за период пропущены. */
const MAX_GAP_DAYS = 45

/** Во сколько раз расход должен отличаться от обычного, чтобы считаться скачком. */
const SPIKE_FACTOR = 3

/** Сколько прошлых периодов берём за «обычный расход». */
const BASELINE_PERIODS = 6

export interface Reading {
  id?: string
  reading_date: string
  value: number
}

export type AnomalyKind = 'decreased' | 'gap' | 'spike'

export interface Anomaly {
  kind: AnomalyKind
  /** Текст для карточки — объясняет, что не так и что с этим делать. */
  message: string
}

/** Разница дат в днях. Обе — YYYY-MM-DD. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`)
  const b = Date.parse(`${to}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.round((b - a) / 86400000)
}

/**
 * Расход между показаниями. Отрицательный означает, что счётчик открутили назад
 * или заменили — это не расход, а повод разобраться, поэтому возвращаем null.
 */
export function computeConsumption(previousValue: number | null, currentValue: number): number | null {
  if (previousValue === null) return null
  const delta = currentValue - previousValue
  return delta < 0 ? null : delta
}

/** Начисление по расходу и тарифу счётчика. */
export function computeAmount(consumption: number | null, tariff: number | null | undefined): number | null {
  if (consumption === null || tariff === null || tariff === undefined) return null
  // До копеек: коммунальные тарифы задаются с копейками, и округление до рубля
  // на каждом показании за год расходится с квитанцией на заметную сумму.
  return Math.round(consumption * tariff * 100) / 100
}

/**
 * Аномалии нового показания на фоне истории.
 *
 * `history` — предыдущие показания того же счётчика, от новых к старым.
 * Пустая история означает первое показание: сравнивать не с чем, аномалий нет.
 */
export function detectAnomalies(candidate: Reading, history: Reading[]): Anomaly[] {
  if (history.length === 0) return []

  const previous = history[0]
  const found: Anomaly[] = []

  if (candidate.value < previous.value) {
    found.push({
      kind: 'decreased',
      message:
        `Показание ${candidate.value} меньше предыдущего ${previous.value} за ${previous.reading_date}. ` +
        `Так бывает при замене счётчика — тогда отметьте это в примечании; иначе проверьте цифру.`,
    })
  }

  const gap = daysBetween(previous.reading_date, candidate.reading_date)
  if (gap > MAX_GAP_DAYS) {
    found.push({
      kind: 'gap',
      message:
        `С прошлого показания прошло ${gap} дней. Показания за пропущенные месяцы уже не восстановить — ` +
        `расход за период посчитается одной суммой.`,
    })
  }

  // Скачок ищем только когда есть на что опереться: по одному-двум периодам
  // «обычный расход» не определить, и любая цифра выглядела бы аномалией.
  const consumption = computeConsumption(previous.value, candidate.value)
  if (consumption !== null && history.length > 2) {
    const baseline = averageConsumption(history.slice(0, BASELINE_PERIODS + 1))
    if (baseline !== null && baseline > 0 && consumption > baseline * SPIKE_FACTOR) {
      found.push({
        kind: 'spike',
        message:
          `Расход ${consumption} при обычном ${Math.round(baseline * 10) / 10} — больше чем в ${SPIKE_FACTOR} раза. ` +
          `Проверьте показание и нет ли утечки.`,
      })
    }
  }

  return found
}

/**
 * Средний расход по истории показаний (от новых к старым).
 * null, если пар для сравнения не набралось.
 */
export function averageConsumption(history: Reading[]): number | null {
  const deltas: number[] = []
  for (let i = 0; i < history.length - 1; i++) {
    const delta = computeConsumption(history[i + 1].value, history[i].value)
    if (delta !== null) deltas.push(delta)
  }
  if (deltas.length === 0) return null
  return deltas.reduce((s, d) => s + d, 0) / deltas.length
}
