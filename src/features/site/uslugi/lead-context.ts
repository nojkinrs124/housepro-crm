/**
 * Контекст заявки на страницах раздела «Услуги» — чистые типы и функции.
 *
 * Кнопки тарифов, калькулятор и карточки документов собирают контекст
 * (тариф, район, комнатность, ставка), форма его показывает и отправляет вместе
 * с лидом; Route Handler по нему заполняет комментарий и `leads.metadata`.
 *
 * Этот файл — общий для клиента и сервера, поэтому без 'use client'.
 * Клиентское хранилище с подпиской — в lead-context-store.ts.
 */

import {
  DISTRICTS,
  ROOMS_LABELS,
  ROOMS_OPTIONS,
  TARIFFS,
  TARIFF_IDS,
  tariffCommissionLabel,
  type District,
  type RoomsKey,
  type TariffId,
} from './config'
import { calculateIncome, formatRub } from './calc'

/** Откуда пришёл контекст — для аналитики и комментария лида */
export type LeadIntent =
  | 'tariff'          // кнопка карточки тарифа
  | 'calculator'      // «Получить расчёт по моему адресу»
  | 'document_sample' // «Запросить образец» на карточке документа
  | 'sticky_bar'      // липкая панель на мобильном
  | 'hero'            // CTA первого экрана

export interface UslugiLeadContext {
  intent?: LeadIntent
  tariffId?: TariffId
  district?: District
  rooms?: RoomsKey
  /** Ставка аренды, ₽/мес — из калькулятора */
  rate?: number
  /** id документа с карточки «Документы» */
  documentId?: string
}

export function isTariffId(v: unknown): v is TariffId {
  return typeof v === 'string' && (TARIFF_IDS as readonly string[]).includes(v)
}

export function isDistrict(v: unknown): v is District {
  return typeof v === 'string' && (DISTRICTS as readonly string[]).includes(v)
}

export function isRoomsKey(v: unknown): v is RoomsKey {
  return typeof v === 'string' && ROOMS_OPTIONS.some(o => o.key === v)
}

/**
 * Человекочитаемое описание контекста — строки для комментария лида.
 * Агент в CRM видит тариф, район, комнатность, ставку и расчёт без раскопок
 * в JSON. Суммы пересчитываются здесь из ставки, а не берутся из запроса.
 */
export function describeLeadContext(ctx: UslugiLeadContext): string[] {
  const lines: string[] = []

  if (ctx.tariffId) {
    const t = TARIFFS[ctx.tariffId]
    lines.push(`Тариф: ${t.name} (${tariffCommissionLabel(t)})`)
  }

  const place: string[] = []
  if (ctx.district) place.push(ctx.district)
  if (ctx.rooms) place.push(`комнат: ${ROOMS_LABELS[ctx.rooms]}`)
  if (place.length) lines.push(`Объект: ${place.join(', ')}`)

  if (typeof ctx.rate === 'number' && ctx.rate > 0) {
    lines.push(`Ставка из калькулятора: ${formatRub(ctx.rate)}/мес`)
    const calc = calculateIncome(ctx.rate)
    const ids: TariffId[] = ctx.tariffId ? [ctx.tariffId] : [...TARIFF_IDS]
    for (const id of ids) {
      const c = calc[id]
      lines.push(
        `${TARIFFS[id].calcName}: на руки ${formatRub(c.monthlyToOwner)}/мес, за первый год ${formatRub(c.firstYear)}`
      )
    }
  }

  if (ctx.documentId) lines.push(`Просил образец документа: ${ctx.documentId}`)

  return lines
}

/** Короткая подпись контекста над формой: «Управление · Советский · 2 комнаты · 35 000 ₽» */
export function summarizeLeadContext(ctx: UslugiLeadContext): string | null {
  const parts: string[] = []
  if (ctx.tariffId) parts.push(TARIFFS[ctx.tariffId].name)
  if (ctx.district) parts.push(ctx.district)
  if (ctx.rooms) parts.push(`комнат: ${ROOMS_LABELS[ctx.rooms]}`)
  if (typeof ctx.rate === 'number' && ctx.rate > 0) parts.push(`${formatRub(ctx.rate)}/мес`)
  return parts.length ? parts.join(' · ') : null
}
