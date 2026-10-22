// Единственный способ завести начисление аренды в accounting_transactions.
//
// До 22.10.2026 начисления создавались в четырёх местах (график договора,
// мастер сделки, «Поступление от арендатора», платёж с карточки договора), и
// каждое место решало про категорию по-своему. Из-за этого залог попадал в
// категорию «Арендный платёж», а значит — в долю собственника при взаиморасчёте
// и в базу процента агентства: комиссия считалась с возвратных денег.
//
// Файл без 'use server' и без 'use client': половина — чистая функция, которую
// проверяют юнит-тесты (src/tests/unit/charges.test.ts), половина — запись в БД.

import type { createClient } from '@/lib/supabase/server'
import type { Insert } from '@/types/database'
import { todayIso } from '@/lib/timezone'

type Client = Awaited<ReturnType<typeof createClient>>

/**
 * Что именно зачисляется. От вида зависит категория, а от категории — попадёт
 * ли строка в доход агентства и в расчёт с собственником.
 */
export type ChargeKind = 'rent' | 'deposit' | 'management_fee'

/** Код категории по виду начисления. Коды стабильные, названия правит пользователь. */
export const CHARGE_CATEGORY_CODE: Record<ChargeKind, string> = {
  // Арендный платёж: пассивный доход агентства (транзит), база процента.
  rent: 'tenant_payment',
  // Залог возвратный: деньги собственника, не доход и не база комиссии.
  deposit: 'deposit',
  // Вознаграждение за управление, заведённое отдельной операцией.
  management_fee: 'management_fee',
}

export interface ChargeItem {
  kind: ChargeKind
  amount: number
  /** Подпись строки — уходит в description. */
  label: string
  /** Срок оплаты. Нет срока — берётся сегодняшняя дата. */
  dueDate?: string | null
  /** planned — начисление в графике, completed — деньги уже получены. */
  status?: 'planned' | 'completed'
  /** Номер строки в графике (только для плановых начислений). */
  seq?: number | null
  periodStart?: string | null
  periodEnd?: string | null
  paidAt?: string | null
  paymentMethod?: string | null
  contactId?: string | null
}

export interface ChargeLinks {
  organizationId: string
  createdBy: string
  contractId?: string | null
  dealId?: string | null
  propertyId?: string | null
  engagementId?: string | null
}

/** Код категории для вида начисления. Чистая функция — под тестом. */
export function chargeCategoryCode(kind: ChargeKind): string {
  return CHARGE_CATEGORY_CODE[kind]
}

/**
 * Вид начисления по строке графика и типу договора.
 *
 * Строка графика знает только «депозит / аренда», а платёж по договору
 * управления — это вознаграждение за управление, а не аренда: собственник
 * платит агентству, а не арендатор собственнику.
 */
export function chargeKindFor(
  scheduleKind: 'deposit' | 'rent',
  contractType: string | null | undefined,
): ChargeKind {
  if (scheduleKind === 'deposit') return 'deposit'
  return contractType === 'property_management' ? 'management_fee' : 'rent'
}

/**
 * Строки для вставки. Отдельно от записи, чтобы проверить в тесте главное:
 * залог уходит в «Депозит», а не в «Арендный платёж».
 */
export function buildChargeRows(
  items: ChargeItem[],
  links: ChargeLinks,
  categoryIds: Partial<Record<ChargeKind, string | null>>,
  today: string = todayIso(),
): Insert<'accounting_transactions'>[] {
  return items.map((item) => {
    const status = item.status ?? 'planned'
    return {
      type: 'income' as const,
      status,
      amount: item.amount,
      date: item.dueDate || today,
      due_date: item.dueDate ?? null,
      paid_at: status === 'completed' ? (item.paidAt ?? new Date().toISOString()) : null,
      description: item.label,
      category_id: categoryIds[item.kind] ?? null,
      contract_id: links.contractId ?? null,
      deal_id: links.dealId ?? null,
      property_id: links.propertyId ?? null,
      engagement_id: links.engagementId ?? null,
      contact_id: item.contactId ?? null,
      payment_method: item.paymentMethod ?? null,
      created_by: links.createdBy,
      organization_id: links.organizationId,
      schedule_seq: item.seq ?? null,
      period_start: item.periodStart ?? null,
      period_end: item.periodEnd ?? null,
    }
  })
}

/**
 * Категории всех нужных видов — одним запросом вместо одного на каждый вид.
 * Если категории в организации нет (удалили системную), вернётся null: строка
 * всё равно сохранится, но в отчётах будет «без категории» — это видно, а не
 * молча потеряно.
 */
export async function loadChargeCategoryIds(
  supabase: Client,
  kinds: ChargeKind[],
): Promise<Partial<Record<ChargeKind, string | null>>> {
  const unique = [...new Set(kinds)]
  const codes = unique.map((k) => CHARGE_CATEGORY_CODE[k])
  const { data } = await supabase.from('accounting_categories').select('id, code').in('code', codes)
  const byCode = new Map((data ?? []).map((c) => [c.code, c.id]))

  const result: Partial<Record<ChargeKind, string | null>> = {}
  for (const kind of unique) result[kind] = byCode.get(CHARGE_CATEGORY_CODE[kind]) ?? null
  return result
}

export interface InsertChargesResult {
  error: string | null
  count: number
}

/** Записать начисления в БД. Единственный вход для всех сценариев. */
export async function insertCharges(
  supabase: Client,
  items: ChargeItem[],
  links: ChargeLinks,
): Promise<InsertChargesResult> {
  if (items.length === 0) return { error: null, count: 0 }

  const categoryIds = await loadChargeCategoryIds(supabase, items.map((i) => i.kind))
  const rows = buildChargeRows(items, links, categoryIds)
  const { error } = await supabase.from('accounting_transactions').insert(rows)
  return { error: error?.message ?? null, count: error ? 0 : rows.length }
}
