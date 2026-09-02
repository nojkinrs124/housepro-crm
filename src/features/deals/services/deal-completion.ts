/**
 * Оформление сделки одним действием: что именно нужно создать, когда клиент
 * пришёл и готов забирать.
 *
 * Раньше это была цепочка из пяти экранов — договор, график начислений, задача
 * на подписание, статус объекта, этап сделки — и любое звено легко забывалось:
 * договор есть, начислений нет, объект висит свободным. Здесь собрано всё, что
 * система может вывести из самой сделки, чтобы человеку осталось подтвердить.
 *
 * Файл без 'use client' и без обращений к базе: те же значения считает и форма
 * предпросмотра, и Server Action — иначе на экране одно, а в базе другое.
 */

import type { SchedulePeriodicity } from '@/features/accounting/services/payment-schedule.service'

/** Типы объектов, которым положен коммерческий договор аренды. */
const COMMERCIAL_PROPERTY_TYPES = ['commercial', 'office', 'warehouse', 'land']

/** Тип сделки → тип договора. Аренда уточняется по типу объекта. */
export function contractTypeForDeal(
  dealType: string | null | undefined,
  propertyType?: string | null
): string {
  const isCommercialProperty = COMMERCIAL_PROPERTY_TYPES.includes(propertyType ?? '')
  switch (dealType) {
    case 'sale':       return 'sale'
    case 'management': return 'property_management'
    case 'commercial': return 'rent_commercial'
    case 'subrent':    return 'sublease'
    case 'rent':
    default:           return isCommercialProperty ? 'rent_commercial' : 'rent_apartment'
  }
}

/**
 * Каким становится объект после оформления. Управление статус не меняет:
 * объект в доверительном управлении может быть и сдан, и свободен.
 */
export function propertyStatusAfterDeal(dealType: string | null | undefined): string | null {
  switch (dealType) {
    case 'sale':                                    return 'sold'
    case 'rent': case 'commercial': case 'subrent': return 'rented'
    default:                                        return null
  }
}

/** По каким договорам имеет смысл сразу разворачивать график начислений. */
export function needsSchedule(contractType: string): boolean {
  return ['rent_apartment', 'rent_commercial', 'sublease', 'property_management'].includes(contractType)
}

export function defaultPeriodicity(contractType: string): SchedulePeriodicity {
  return needsSchedule(contractType) ? 'monthly' : 'once'
}

/** Буквенный префикс номера договора — чтобы номер читался без открытия карточки. */
const NUMBER_PREFIX: Record<string, string> = {
  rent_apartment: 'АР',
  rent_commercial: 'АК',
  sublease: 'СА',
  sale: 'КП',
  property_management: 'ДУ',
  agency_owner: 'АГ',
  agency_client: 'АГ',
  agency_legal_entity: 'АГ',
}

/**
 * Номер вида «АР-2026-014»: тип, год, порядковый номер договора организации
 * в этом году. Руками номера не проставлялись вообще — в документах на их
 * месте оставался пропуск.
 */
export function suggestContractNumber(
  contractType: string,
  seqInYear: number,
  today: string = new Date().toISOString().slice(0, 10)
): string {
  const prefix = NUMBER_PREFIX[contractType] ?? 'ДГ'
  const year = today.slice(0, 4)
  return `${prefix}-${year}-${String(seqInYear).padStart(3, '0')}`
}

/** Прибавляет месяцы к дате-строке YYYY-MM-DD, схлопывая 31-е в конец короткого месяца. */
function addMonths(dateStr: string, months: number): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  const target = new Date(Date.UTC(y, m - 1 + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d, lastDay))
  return target
}

/**
 * Дата окончания по умолчанию. Наём жилья — 11 месяцев без одного дня:
 * договор на год и дольше подлежит государственной регистрации, поэтому
 * агентства заключают его на 11 месяцев. У продажи срока нет.
 */
export function defaultEndDate(startDate: string, contractType: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return null
  if (contractType === 'sale') return null

  const months = contractType === 'property_management' ? 12 : 11
  const end = addMonths(startDate, months)
  end.setUTCDate(end.getUTCDate() - 1)
  return end.toISOString().slice(0, 10)
}

/** Через сколько дней после оформления напомнить о подписанном экземпляре. */
const SIGN_TASK_DAYS = 3

export function defaultTaskDeadline(
  startDate: string,
  today: string = new Date().toISOString().slice(0, 10)
): string {
  const base = startDate > today ? today : startDate
  const [y, m, d] = base.split('-').map(Number)
  const deadline = new Date(Date.UTC(y, m - 1, d + SIGN_TASK_DAYS))
  return deadline.toISOString().slice(0, 10)
}

export function taskTitleForContract(contractType: string): string {
  if (contractType === 'sale') return 'Подписать договор и подать документы на регистрацию'
  if (contractType === 'property_management') return 'Подписать договор управления и принять объект'
  return 'Подписать договор и передать ключи'
}

export interface DealCompletionPlan {
  contractType: string
  contractNumber: string
  startDate: string
  endDate: string | null
  amount: number | null
  deposit: number | null
  periodicity: SchedulePeriodicity
  withSchedule: boolean
  propertyStatus: string | null
  taskTitle: string
  taskDeadline: string
}

/**
 * Полный набор значений по умолчанию для мастера оформления — одна точка,
 * из которой берут и форма, и Server Action.
 */
export function buildCompletionPlan(input: {
  dealType: string | null | undefined
  propertyType?: string | null
  amount?: number | null
  deposit?: number | null
  seqInYear: number
  startDate?: string | null
  today?: string
}): DealCompletionPlan {
  const today = input.today ?? new Date().toISOString().slice(0, 10)
  const startDate = input.startDate || today
  const contractType = contractTypeForDeal(input.dealType, input.propertyType)

  return {
    contractType,
    contractNumber: suggestContractNumber(contractType, input.seqInYear, today),
    startDate,
    endDate: defaultEndDate(startDate, contractType),
    amount: input.amount ?? null,
    deposit: input.deposit ?? null,
    periodicity: defaultPeriodicity(contractType),
    withSchedule: needsSchedule(contractType) && !!input.amount,
    propertyStatus: propertyStatusAfterDeal(input.dealType),
    taskTitle: taskTitleForContract(contractType),
    taskDeadline: defaultTaskDeadline(startDate, today),
  }
}
