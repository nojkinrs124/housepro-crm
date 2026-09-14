/**
 * Расчёт дохода собственника по тарифам — чистые функции без React.
 *
 * Используется калькулятором на /uslugi/sdat-kvartiru и Route Handler'ом
 * приёма заявок (пересчитывает суммы на сервере из ставки, а не доверяет
 * числам, пришедшим из браузера). Проценты — только из config.ts.
 *
 * Файл намеренно без 'use client'.
 */

import { formatMoney } from '@/lib/utils'
import { TARIFFS, TARIFF_IDS, type TariffId } from './config'

const MONTHS_IN_YEAR = 12

export interface TariffCalc {
  tariffId: TariffId
  /** На руки собственнику в месяц, ₽ */
  monthlyToOwner: number
  /**
   * За первый год, ₽. Для «Разового подбора» комиссия 0 — первая сделка
   * бесплатно, поэтому первый год = 12 × ставка.
   */
  firstYear: number
  /** Со второго года и дальше — за год, ₽, если наниматель не менялся */
  nextYears: number
  /**
   * Разовая комиссия при каждом новом заселении после первой сделки, ₽.
   * Есть только у «Разового подбора»; у ежемесячных тарифов — 0.
   */
  perNewTenant: number
}

export type CalcResult = Record<TariffId, TariffCalc>

function round(n: number): number {
  return Math.round(n)
}

/** Расчёт по всем трём тарифам от месячной ставки `rate` */
export function calculateIncome(rate: number): CalcResult {
  const safeRate = Number.isFinite(rate) && rate > 0 ? rate : 0

  const result = {} as CalcResult
  for (const id of TARIFF_IDS) {
    const tariff = TARIFFS[id]
    if (tariff.commissionKind === 'once') {
      // Разовый подбор: каждый месяц собственник получает ставку целиком.
      // Первая сделка бесплатна, дальше каждое новое заселение стоит percent% разово.
      result[id] = {
        tariffId: id,
        monthlyToOwner: round(safeRate),
        firstYear: round(safeRate * MONTHS_IN_YEAR),
        nextYears: round(safeRate * MONTHS_IN_YEAR),
        perNewTenant: round((safeRate * tariff.percent) / 100),
      }
    } else {
      const share = 1 - tariff.percent / 100
      const monthly = safeRate * share
      result[id] = {
        tariffId: id,
        monthlyToOwner: round(monthly),
        firstYear: round(monthly * MONTHS_IN_YEAR),
        nextYears: round(monthly * MONTHS_IN_YEAR),
        perNewTenant: 0,
      }
    }
  }
  return result
}

/**
 * Разница «Управление» − «Премиум» в рублях в месяц — цена гарантии платежа.
 * Именно эту строку показываем под результатом калькулятора.
 */
export function guaranteeCostPerMonth(rate: number): number {
  const calc = calculateIncome(rate)
  return calc.upravlenie.monthlyToOwner - calc.premium.monthlyToOwner
}

/**
 * Сумма по-русски с неразрывными пробелами: `32 000 ₽`.
 * Intl для ru-RU сам ставит U+00A0 между разрядами и перед знаком валюты.
 */
export function formatRub(amount: number): string {
  return formatMoney(amount)
}

/** Приводит ставку к допустимому диапазону и шагу ползунка */
export function clampRate(
  value: number,
  bounds: { min: number; max: number; step: number }
): number {
  if (!Number.isFinite(value)) return bounds.min
  const clamped = Math.min(bounds.max, Math.max(bounds.min, value))
  return Math.round(clamped / bounds.step) * bounds.step
}
