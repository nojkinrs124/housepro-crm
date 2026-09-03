import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import {
  STAGE_CANCELLED,
  getStage,
  isStageOf,
  stageIndex,
  stageLabel,
  terminalStageOf,
  getDirection,
} from '@/features/directions/config/directions'
import { PRECONDITIONS, type PreconditionCode } from '@/features/directions/config/preconditions'
import { unmetItems } from '@/features/directions/config/stage-checklists'

type Client = SupabaseClient<Database>

/** Договоры, которые считаются заключёнными. Черновик не подтверждает ничего. */
const SIGNED_STATUSES = new Set(['generated', 'signed', 'completed'])

export interface DealFacts {
  id: string
  deal_type: string
  status: string
  property_id: string | null
  plan_id: string | null
  stage_progress: Record<string, string[]>
  /** Типы заключённых договоров по этой работе или её объекту. */
  signedContractTypes: Set<string>
  /** Схема расчёта выбрана хотя бы в одном договоре управления. */
  hasSettlementScheme: boolean
  photoCount: number
  isPublished: boolean
  hasIncome: boolean
  /** Аванс или задаток по предварительному договору. */
  advanceAmount: number | null
  /** Срок выхода на основную сделку. */
  expectedCloseDate: string | null
}

/**
 * Предусловия, которые система проверяет по данным.
 *
 * Остальные коды из `preconditions.ts` система проверить не может — «побывали на
 * объекте», «собственник согласился» происходят в реальном мире. Их держит
 * чек-лист стадии: обязательные пункты не дают уйти дальше (FR-004). Поэтому
 * отсутствие кода в этой карте означает «проверяется чек-листом», а не
 * «проверка забыта».
 */
const DATA_CHECKS: Partial<Record<PreconditionCode, (f: DealFacts) => boolean>> = {
  agency_owner_contract_signed: f => f.signedContractTypes.has('agency_owner'),
  sale_agency_contract_signed:  f => f.signedContractTypes.has('agency_owner')
                                  || f.signedContractTypes.has('agency_legal_entity'),
  mgmt_contract_signed:         f => f.signedContractTypes.has('property_management')
                                  || f.signedContractTypes.has('sublease'),
  search_contract_signed:       f => f.signedContractTypes.has('agency_client')
                                  || f.signedContractTypes.has('agency_legal_entity'),
  rent_contract_signed:         f => f.signedContractTypes.has('rent_apartment')
                                  || f.signedContractTypes.has('rent_commercial'),
  main_contract_signed:         f => f.signedContractTypes.has('sale'),
  plan_selected:                f => f.plan_id !== null,
  settlement_scheme_set:        f => f.hasSettlementScheme,
  photos_uploaded:              f => f.photoCount > 0,
  published:                    f => f.isPublished,
  commission_accrued:           f => f.hasIncome,
  // Предварительный договор без суммы аванса и срока выхода на сделку — это
  // не договорённость, а протокол о намерениях: по нему нельзя ни удержать
  // задаток, ни напомнить о приближении срока.
  preliminary_terms_set:        f => Boolean(f.advanceAmount) && Boolean(f.expectedCloseDate),
}

/**
 * Собирает факты о сделке одним заходом: четыре запроса вместо выборок в цикле.
 */
export async function collectDealFacts(supabase: Client, dealId: string): Promise<DealFacts | null> {
  const { data: deal } = await supabase
    .from('deals')
    .select('id, deal_type, status, property_id, plan_id, stage_progress, advance_amount, expected_close_date')
    .eq('id', dealId)
    .maybeSingle()
  if (!deal) return null

  const propertyId = deal.property_id

  const [{ data: contracts }, { data: property }, { data: income }] = await Promise.all([
    // Договор мог быть заведён и от сделки, и просто от объекта — учитываем оба пути.
    propertyId
      ? supabase.from('contracts').select('contract_type, status, settlement_scheme')
          .or(`deal_id.eq.${dealId},property_id.eq.${propertyId}`)
      : supabase.from('contracts').select('contract_type, status, settlement_scheme').eq('deal_id', dealId),
    propertyId
      ? supabase.from('properties').select('photo_urls, site_publish, avito_publish').eq('id', propertyId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('accounting_transactions').select('id')
      .eq('deal_id', dealId).eq('type', 'income').limit(1),
  ])

  const signed = (contracts ?? []).filter(c => SIGNED_STATUSES.has(c.status))

  const progress = (deal.stage_progress ?? {}) as Record<string, string[]>

  return {
    id: deal.id,
    deal_type: deal.deal_type,
    status: deal.status,
    property_id: propertyId,
    plan_id: deal.plan_id,
    stage_progress: progress,
    signedContractTypes: new Set(signed.map(c => c.contract_type)),
    hasSettlementScheme: signed.some(c => c.settlement_scheme !== null),
    photoCount: property?.photo_urls?.length ?? 0,
    isPublished: Boolean(property?.site_publish || property?.avito_publish),
    hasIncome: (income ?? []).length > 0,
    advanceAmount: deal.advance_amount,
    expectedCloseDate: deal.expected_close_date,
  }
}

export interface TransitionVerdict {
  allowed: boolean
  /** Причина отказа — показывается пользователю дословно. */
  reason?: string
}

/**
 * Можно ли перевести сделку на стадию.
 *
 * Правила:
 *  — стадия обязана принадлежать направлению сделки;
 *  — из терминальной стадии и из отмены двигаться нельзя, кроме возврата в работу;
 *  — назад двигаться можно свободно: это исправление ошибки, а не обход контроля;
 *  — вперёд — только когда закрыты обязательные пункты чек-листа текущей стадии
 *    и выполнены предусловия целевой.
 *
 * Отказ всегда называет причину: FR-003 требует объяснения, а не «ошибки
 * валидации», по которой непонятно, что делать дальше.
 */
export function canMoveStage(facts: DealFacts, toStage: string): TransitionVerdict {
  const direction = facts.deal_type
  const config = getDirection(direction)
  if (!config) {
    return { allowed: false, reason: `У сделки неизвестное направление «${direction}»` }
  }

  if (toStage === facts.status) return { allowed: true }

  if (!isStageOf(direction, toStage)) {
    return {
      allowed: false,
      reason: `Стадия «${stageLabel(direction, toStage)}» не применяется в направлении «${config.label}»`,
    }
  }

  const isCancelling = toStage === STAGE_CANCELLED.value
  const wasCancelled = facts.status === STAGE_CANCELLED.value
  const terminal = terminalStageOf(direction)

  if (facts.status === terminal && !isCancelling) {
    return {
      allowed: false,
      reason: `Сделка уже на стадии «${stageLabel(direction, terminal)}» — дальше двигать некуда`,
    }
  }

  // Отмена и возврат из отмены разрешены всегда: это решение человека, а не
  // шаг воронки. Причину отмены запрашивает форма.
  if (isCancelling || wasCancelled) return { allowed: true }

  const fromIndex = stageIndex(direction, facts.status)
  const toIndex = stageIndex(direction, toStage)

  // Назад — свободно: работу вернули на шаг раньше, потому что ошиблись.
  if (toIndex < fromIndex) return { allowed: true }

  const unmet = unmetItems(direction, facts.status, facts.stage_progress)
  if (unmet.length > 0) {
    const list = unmet.map(i => `«${i.title}»`).join(', ')
    return {
      allowed: false,
      reason: `На стадии «${stageLabel(direction, facts.status)}» не закрыты обязательные пункты: ${list}`,
    }
  }

  const target = getStage(direction, toStage)
  for (const code of target?.requires ?? []) {
    const check = DATA_CHECKS[code]
    if (check && !check(facts)) {
      return { allowed: false, reason: PRECONDITIONS[code].message }
    }
  }

  return { allowed: true }
}
