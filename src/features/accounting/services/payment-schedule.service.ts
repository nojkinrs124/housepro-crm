// Построение графика платежей по договору.
//
// Чистая функция без БД и без React — её гоняют юнит-тесты
// (src/tests/unit/payment-schedule.test.ts), а Server Action только сохраняет
// результат в accounting_transactions. Файл намеренно не содержит 'use server'
// и 'use client': его импортируют и экшены, и предпросмотр на странице договора.

export type SchedulePeriodicity = 'monthly' | 'quarterly' | 'semiannual' | 'yearly' | 'once'

export const PERIODICITY_LABELS: Record<SchedulePeriodicity, string> = {
  monthly: 'Ежемесячно',
  quarterly: 'Раз в квартал',
  semiannual: 'Раз в полгода',
  yearly: 'Раз в год',
  once: 'Разовый платёж',
}

const MONTHS_IN_PERIOD: Record<SchedulePeriodicity, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  yearly: 12,
  once: 0,
}

export interface ScheduleInput {
  /** Начало действия договора, ISO-дата (YYYY-MM-DD). */
  startDate: string
  /** Окончание. null — считаем 12 месяцев от начала (типовой срок аренды). */
  endDate?: string | null
  /** Сумма одного периодического платежа. */
  amount: number
  periodicity: SchedulePeriodicity
  /** День месяца для платежа. По умолчанию — день из startDate. */
  dayOfMonth?: number | null
  /** Депозит отдельной первой строкой графика. */
  depositAmount?: number | null
  /**
   * Пропорционально уменьшать сумму неполного последнего периода.
   * По умолчанию выключено: агентства чаще берут полную сумму периода,
   * а «неожиданно другая» цифра в графике вызывает больше вопросов, чем пользы.
   */
  prorateLastPeriod?: boolean
  /**
   * Ежегодная индексация ставки, % (например, 7 — рост на 7%).
   * Прописана почти в каждом длинном договоре аренды, а считалась руками.
   */
  indexationPercent?: number | null
  /** Через сколько месяцев применяется индексация. По умолчанию — раз в год. */
  indexationPeriodMonths?: number | null
  /** Предохранитель от бесконечного графика (например, при кривых датах). */
  maxItems?: number
}

export type ScheduleItemKind = 'deposit' | 'rent'

export interface ScheduleItem {
  /** Порядковый номер строки в графике, начиная с 1. */
  seq: number
  /** Срок оплаты, ISO-дата. */
  dueDate: string
  amount: number
  periodStart: string
  periodEnd: string
  kind: ScheduleItemKind
  /** Человекочитаемое описание — уходит в description начисления. */
  label: string
  /** Сколько раз к этой строке применена индексация (0 — базовая ставка). */
  indexationSteps?: number
}

const DEFAULT_MAX_ITEMS = 120

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function parseDate(value: string): Date | null {
  const d = new Date(`${value.slice(0, 10)}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

/**
 * Прибавляет месяцы, сохраняя «день платежа» и подрезая его под длину месяца:
 * 31 января + 1 месяц = 28 (или 29) февраля, а не 3 марта, как получилось бы
 * при наивном setMonth. Дальше по графику день снова становится 31-м, если
 * месяц позволяет — поэтому day передаётся отдельно, а не берётся из base.
 */
export function addMonthsKeepingDay(base: Date, months: number, day: number): Date {
  const year = base.getUTCFullYear()
  const monthIndex = base.getUTCMonth() + months
  const targetYear = year + Math.floor(monthIndex / 12)
  const targetMonth = ((monthIndex % 12) + 12) % 12
  const clampedDay = Math.min(day, daysInMonth(targetYear, targetMonth))
  return new Date(Date.UTC(targetYear, targetMonth, clampedDay))
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function shortDate(d: Date): string {
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
}

/**
 * Строит график. Никогда не бросает исключений на кривом вводе — возвращает
 * пустой массив, а вызывающий показывает пользователю понятную ошибку.
 */
export function buildPaymentSchedule(input: ScheduleInput): ScheduleItem[] {
  const start = parseDate(input.startDate)
  if (!start || !Number.isFinite(input.amount) || input.amount <= 0) return []

  const maxItems = input.maxItems ?? DEFAULT_MAX_ITEMS
  const items: ScheduleItem[] = []
  let seq = 0

  // Депозит — отдельная строка со сроком в день начала договора.
  if (input.depositAmount && input.depositAmount > 0) {
    seq += 1
    items.push({
      seq,
      dueDate: isoDate(start),
      amount: input.depositAmount,
      periodStart: isoDate(start),
      periodEnd: isoDate(start),
      kind: 'deposit',
      label: 'Обеспечительный платёж (депозит)',
    })
  }

  if (input.periodicity === 'once') {
    seq += 1
    items.push({
      seq,
      dueDate: isoDate(start),
      amount: input.amount,
      periodStart: isoDate(start),
      periodEnd: isoDate(parseDate(input.endDate ?? input.startDate) ?? start),
      kind: 'rent',
      label: 'Оплата по договору',
    })
    return items
  }

  const step = MONTHS_IN_PERIOD[input.periodicity]
  const explicitEnd = input.endDate ? parseDate(input.endDate) : null
  // Договор без даты окончания (бессрочный) всё равно нуждается в графике —
  // строим на год вперёд, дальше пользователь продлит.
  const end = explicitEnd ?? addMonthsKeepingDay(start, 12, start.getUTCDate())
  if (end.getTime() <= start.getTime()) return items

  const anchorDay =
    input.dayOfMonth && input.dayOfMonth >= 1 && input.dayOfMonth <= 31
      ? input.dayOfMonth
      : start.getUTCDate()

  // Границы периодов.
  //
  // Если день платежа совпадает с днём начала договора (обычный случай), периоды
  // просто идут от начала: 20.09 → 20.10 → 20.11.
  //
  // Если день платежа задан ОТДЕЛЬНО («заехали 20-го, платим 5-го»), первый период —
  // короткий, от заезда до первого «пятого числа», а дальше периоды выравниваются
  // по дню платежа. Наивный вариант (день платежа внутри периода, начатого от даты
  // заезда) давал сроки задним числом либо просто игнорировал выбранный день.
  const boundaries: Date[] = [start]
  if (anchorDay === start.getUTCDate()) {
    for (let i = 1; i <= maxItems; i += 1) {
      boundaries.push(addMonthsKeepingDay(start, step * i, start.getUTCDate()))
    }
  } else {
    let firstAnchor = addMonthsKeepingDay(start, 0, anchorDay)
    if (firstAnchor.getTime() <= start.getTime()) {
      firstAnchor = addMonthsKeepingDay(start, step, anchorDay)
    }
    for (let i = 0; i <= maxItems; i += 1) {
      boundaries.push(addMonthsKeepingDay(firstAnchor, step * i, anchorDay))
    }
  }

  for (let i = 0; i < boundaries.length - 1 && items.length < maxItems; i += 1) {
    const periodStart = boundaries[i]
    if (periodStart.getTime() >= end.getTime()) break

    const rawPeriodEnd = new Date(boundaries[i + 1].getTime() - 86_400_000)
    const periodEnd = rawPeriodEnd.getTime() > end.getTime() ? end : rawPeriodEnd

    // Индексация: ставка растёт ступенями через indexationPeriodMonths месяцев
    // от начала договора. Считаем от даты, а не от номера строки, — при
    // квартальной оплате «через год» это четвёртая строка, а не двенадцатая.
    const monthsFromStart =
      (periodStart.getUTCFullYear() - start.getUTCFullYear()) * 12 +
      (periodStart.getUTCMonth() - start.getUTCMonth())
    const indexationPeriod = input.indexationPeriodMonths && input.indexationPeriodMonths > 0
      ? input.indexationPeriodMonths
      : 12
    const indexationSteps =
      input.indexationPercent && input.indexationPercent > 0
        ? Math.floor(monthsFromStart / indexationPeriod)
        : 0

    let amount = indexationSteps > 0
      ? Math.round(input.amount * Math.pow(1 + (input.indexationPercent ?? 0) / 100, indexationSteps))
      : input.amount

    const baseAmount = amount
    if (input.prorateLastPeriod && periodEnd.getTime() < rawPeriodEnd.getTime()) {
      const fullDays = Math.round((rawPeriodEnd.getTime() - periodStart.getTime()) / 86_400_000) + 1
      const actualDays = Math.round((periodEnd.getTime() - periodStart.getTime()) / 86_400_000) + 1
      amount = Math.round((baseAmount * actualDays) / fullDays)
    }

    seq += 1
    items.push({
      seq,
      dueDate: isoDate(periodStart),
      amount,
      periodStart: isoDate(periodStart),
      periodEnd: isoDate(periodEnd),
      kind: 'rent',
      indexationSteps,
      label:
        (input.periodicity === 'monthly' && periodStart.getUTCDate() === anchorDay
          ? `Аренда за ${monthLabel(periodStart)}`
          : `Аренда за период ${shortDate(periodStart)} — ${shortDate(periodEnd)}`) +
        (indexationSteps > 0 ? ` (индексация +${input.indexationPercent}% ×${indexationSteps})` : ''),
    })
  }

  return items
}

export function scheduleTotal(items: ScheduleItem[]): number {
  return items.reduce((sum, i) => sum + i.amount, 0)
}
