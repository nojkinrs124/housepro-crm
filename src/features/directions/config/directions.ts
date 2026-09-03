/**
 * Направления работы агентства и их воронки — единый источник правды.
 *
 * До 03.09.2026 все типы сделок ехали по одной воронке из шести стадий
 * (new → showing → negotiation → contract → payment → completed). Она не описывала
 * толком ни один процесс: в аренде между «Новой» и «Показом» умещалось пять
 * реальных шагов, а при подборе для арендатора договор подписывается ДО поиска,
 * тогда как воронка ставила его предпоследним.
 *
 * Теперь у каждого направления своя воронка. `deals.deal_type` хранит направление,
 * `deals.status` — стадию. Коды стадий намеренно переиспользуются между
 * направлениями там, где это один и тот же шаг с одинаковым смыслом: это упрощает
 * сводную аналитику. Поэтому принадлежность стадии направлению всегда проверяется
 * парой (направление, стадия), а не одним статусом.
 *
 * Файл намеренно без 'use client': его импортируют и серверные страницы,
 * и клиентские компоненты (см. проверку границы client/server).
 */

import { Home, Building2, KeyRound, Search, type LucideIcon } from 'lucide-react'
import type { StageColorKey } from '@/lib/design/stageColors'
import type { PreconditionCode } from './preconditions'

export type DirectionCode = 'rent_agent' | 'management' | 'sale' | 'tenant_search'

export interface StageConfig {
  /** Значение `deals.status`. */
  value: string
  /** Название стадии в степпере и бейдже. */
  label: string
  /** Заголовок колонки на канбане — короче лейбла и во множественном числе. */
  board: string
  /** Ключ оформления колонки (см. lib/design/stageColors.ts). */
  stage: StageColorKey
  /** Что должно быть верно, чтобы ВОЙТИ в эту стадию. */
  requires?: readonly PreconditionCode[]
}

export interface DirectionConfig {
  value: DirectionCode
  label: string
  /** Для узких мест — бейджей в реестре и мобильных списков. */
  shortLabel: string
  icon: LucideIcon
  /** Одна строка о том, что это за работа. Показывается при выборе направления. */
  description: string
  /** Порядок массива = порядок воронки слева направо. */
  stages: readonly StageConfig[]
  /** Стадия, после которой работа считается закрытой успешно. */
  terminalStage: string
  /** Код тарифа по умолчанию из справочника service_plans. */
  defaultPlanCode?: string
}

/** Отменённая работа не занимает места в воронке — она вне последовательности. */
export const STAGE_CANCELLED: StageConfig = {
  value: 'cancelled',
  label: 'Отменена',
  board: 'Отменены',
  stage: 'red',
  requires: ['cancel_reason'],
}

export const DIRECTIONS: readonly DirectionConfig[] = [
  {
    value: 'rent_agent',
    label: 'Аренда, тариф «Агент»',
    shortLabel: 'Аренда',
    icon: Home,
    description: 'Объект сдаётся от лица собственника. Комиссия разовая, при заселении.',
    defaultPlanCode: 'agent',
    terminalStage: 'completed',
    stages: [
      { value: 'sourcing',        label: 'Поиск и контакт',          board: 'Поиск',        stage: 'blue' },
      { value: 'meeting',         label: 'Встреча',                  board: 'Встречи',      stage: 'yellow', requires: ['meeting_scheduled'] },
      { value: 'agency_contract', label: 'Договор с собственником',  board: 'Договор',      stage: 'orange', requires: ['meeting_done'] },
      { value: 'preparation',     label: 'Подготовка и реклама',     board: 'Подготовка',   stage: 'purple', requires: ['agency_owner_contract_signed', 'plan_selected'] },
      { value: 'showings',        label: 'Показы',                   board: 'Показы',       stage: 'cyan',   requires: ['photos_uploaded', 'published'] },
      { value: 'tenant_check',    label: 'Проверка и договор найма', board: 'Проверка',     stage: 'gray',   requires: ['interested_client'] },
      { value: 'move_in',         label: 'Заселение',                board: 'Заселение',    stage: 'gray',   requires: ['rent_contract_signed'] },
      { value: 'completed',       label: 'Завершена',                board: 'Завершены',    stage: 'green',  requires: ['commission_accrued'] },
      STAGE_CANCELLED,
    ],
  },
  {
    value: 'management',
    label: 'Управление',
    shortLabel: 'Управление',
    icon: Building2,
    description: 'Объект сдаётся от лица агентства. После заселения переходит в непрерывное обслуживание.',
    defaultPlanCode: 'management',
    terminalStage: 'in_service',
    stages: [
      { value: 'sourcing',       label: 'Поиск и контакт',          board: 'Поиск',       stage: 'blue' },
      { value: 'meeting',        label: 'Встреча',                  board: 'Встречи',     stage: 'yellow', requires: ['meeting_scheduled'] },
      { value: 'mgmt_contract',  label: 'Договор управления',       board: 'Договор',     stage: 'orange', requires: ['meeting_done', 'plan_selected', 'settlement_scheme_set'] },
      { value: 'handover',       label: 'Приёмка объекта',          board: 'Приёмка',     stage: 'purple', requires: ['mgmt_contract_signed'] },
      { value: 'preparation',    label: 'Подготовка и реклама',     board: 'Подготовка',  stage: 'purple', requires: ['handover_completed'] },
      { value: 'showings',       label: 'Показы',                   board: 'Показы',      stage: 'cyan',   requires: ['photos_uploaded', 'published'] },
      { value: 'tenant_check',   label: 'Проверка и договор найма', board: 'Проверка',    stage: 'gray',   requires: ['interested_client'] },
      { value: 'move_in',        label: 'Заселение',                board: 'Заселение',   stage: 'gray',   requires: ['rent_contract_signed'] },
      { value: 'in_service',     label: 'В обслуживании',           board: 'Обслуживание', stage: 'green', requires: ['engagement_started'] },
      STAGE_CANCELLED,
    ],
  },
  {
    value: 'sale',
    label: 'Продажа и покупка',
    shortLabel: 'Продажа',
    icon: KeyRound,
    description: 'Проверка документов, предварительный и основной договор, регистрация перехода права.',
    terminalStage: 'completed',
    stages: [
      { value: 'sourcing',       label: 'Поиск и контакт',            board: 'Поиск',        stage: 'blue' },
      { value: 'valuation',      label: 'Встреча и оценка',           board: 'Оценка',       stage: 'yellow', requires: ['meeting_scheduled'] },
      { value: 'agency_contract', label: 'Договор с собственником',   board: 'Договор',      stage: 'orange', requires: ['valuation_done'] },
      { value: 'docs_check',     label: 'Проверка документов',        board: 'Документы',    stage: 'purple', requires: ['sale_agency_contract_signed'] },
      { value: 'preparation',    label: 'Подготовка и реклама',       board: 'Подготовка',   stage: 'purple', requires: ['docs_checked'] },
      { value: 'showings',       label: 'Показы',                     board: 'Показы',       stage: 'cyan',   requires: ['published'] },
      { value: 'preliminary',    label: 'Предварительный договор',    board: 'Предварительный', stage: 'gray', requires: ['buyer_found'] },
      { value: 'main_contract',  label: 'Основной договор',           board: 'Основной',     stage: 'gray',   requires: ['preliminary_terms_set'] },
      { value: 'registration',   label: 'Регистрация перехода права', board: 'Регистрация',  stage: 'gray',   requires: ['main_contract_signed'] },
      { value: 'completed',      label: 'Завершена',                  board: 'Завершены',    stage: 'green',  requires: ['settlement_closed'] },
      STAGE_CANCELLED,
    ],
  },
  {
    value: 'tenant_search',
    label: 'Подбор для арендатора',
    shortLabel: 'Подбор',
    icon: Search,
    description: 'Обращается арендатор. Договор на подбор подписывается ДО начала поиска.',
    defaultPlanCode: 'tenant_search',
    terminalStage: 'completed',
    stages: [
      { value: 'inquiry',         label: 'Обращение',           board: 'Обращения',  stage: 'blue' },
      { value: 'search_contract', label: 'Договор на подбор',   board: 'Договор',    stage: 'yellow', requires: ['commission_fixed'] },
      { value: 'searching',       label: 'Поиск вариантов',     board: 'Поиск',      stage: 'orange', requires: ['search_contract_signed'] },
      { value: 'collection_sent', label: 'Подборка отправлена', board: 'Подборка',   stage: 'purple', requires: ['collection_built'] },
      { value: 'viewings',        label: 'Просмотры',           board: 'Просмотры',  stage: 'cyan',   requires: ['collection_sent'] },
      { value: 'rent_contract',   label: 'Договор найма',       board: 'Договор найма', stage: 'gray', requires: ['property_chosen'] },
      { value: 'completed',       label: 'Завершена',           board: 'Завершены',  stage: 'green',  requires: ['commission_accrued'] },
      STAGE_CANCELLED,
    ],
  },
] as const

export const DIRECTION_VALUES: DirectionCode[] = DIRECTIONS.map(d => d.value)

export const DIRECTION_LABELS: Record<string, string> =
  Object.fromEntries(DIRECTIONS.map(d => [d.value, d.label]))

export const DIRECTION_SHORT_LABELS: Record<string, string> =
  Object.fromEntries(DIRECTIONS.map(d => [d.value, d.shortLabel]))

/**
 * Объединение стадий всех направлений — ровно этот список стоит в CHECK на
 * `deals.status`. Расхождение кода с базой стережёт scripts/checks/stage-dictionary.mjs:
 * когда такое разошлось у статусов лидов, смена статуса падала PATCH 400,
 * а интерфейс ошибку проглатывал.
 */
export const ALL_STAGE_VALUES: string[] = [
  ...new Set(DIRECTIONS.flatMap(d => d.stages.map(s => s.value))),
].sort()

export function getDirection(code: string | null | undefined): DirectionConfig | undefined {
  return DIRECTIONS.find(d => d.value === code)
}

export function stagesOf(code: string | null | undefined): readonly StageConfig[] {
  return getDirection(code)?.stages ?? []
}

export function getStage(direction: string | null | undefined, stage: string): StageConfig | undefined {
  return stagesOf(direction).find(s => s.value === stage)
}

export function isStageOf(direction: string | null | undefined, stage: string): boolean {
  return getStage(direction, stage) !== undefined
}

/** Позиция стадии в воронке; -1 для отменённой и для чужой стадии. */
export function stageIndex(direction: string | null | undefined, stage: string): number {
  if (stage === STAGE_CANCELLED.value) return -1
  return stagesOf(direction).findIndex(s => s.value === stage)
}

export function terminalStageOf(direction: string | null | undefined): string | undefined {
  return getDirection(direction)?.terminalStage
}

export function isTerminal(direction: string | null | undefined, stage: string): boolean {
  return stage === STAGE_CANCELLED.value || stage === terminalStageOf(direction)
}

/** Лейбл стадии с учётом направления: коды переиспользуются, названия — нет. */
export function stageLabel(direction: string | null | undefined, stage: string): string {
  return getStage(direction, stage)?.label ?? stage
}

/** Бейдж стадии: завершение — `good`, отмена — `neutral`, остальное — `warn`. */
export function stageBadgeClass(direction: string | null | undefined, stage: string): string {
  if (stage === STAGE_CANCELLED.value) return 'hp-badge-neutral'
  if (stage === terminalStageOf(direction)) return 'hp-badge-good'
  if (stageIndex(direction, stage) === 0) return 'hp-badge-info'
  return 'hp-badge-warn'
}

/**
 * Вехи автоматизации — события, которые двигают работу сами: подписан договор,
 * прошла оплата, сделка закрыта.
 *
 * Автоматизации оперируют вехами, а не кодами стадий: код стадии у каждого
 * направления свой, а «подписан договор» означает одно и то же везде. До
 * пересборки автоматизация двигала сделку на жёстко зашитую стадию `contract`,
 * которой теперь нет ни в одной воронке.
 */
export type Milestone = 'contract' | 'payment' | 'completed' | 'collection'

/**
 * Не каждая веха бывает в каждом направлении: «подборка отправлена» осмысленна
 * только при подборе для арендатора. Отсутствие вехи означает, что
 * автоматизация по этому событию в данном направлении ничего не двигает.
 */
export const MILESTONE_STAGE: Record<DirectionCode, Partial<Record<Milestone, string>>> = {
  rent_agent: {
    contract:  'agency_contract',
    payment:   'move_in',
    completed: 'completed',
  },
  management: {
    contract:  'mgmt_contract',
    payment:   'move_in',
    // Управление не «завершается»: после заселения объект уходит в обслуживание
    // и живёт там годами.
    completed: 'in_service',
  },
  sale: {
    contract:  'main_contract',
    payment:   'registration',
    completed: 'completed',
  },
  tenant_search: {
    contract:   'search_contract',
    payment:    'rent_contract',
    completed:  'completed',
    collection: 'collection_sent',
  },
}

/** Стадия, соответствующая вехе в данном направлении. */
export function stageForMilestone(direction: string | null | undefined, milestone: Milestone): string | undefined {
  const d = getDirection(direction)
  return d ? MILESTONE_STAGE[d.value][milestone] : undefined
}

/** Есть ли у направления такая веха. */
export function hasMilestone(direction: string | null | undefined, milestone: Milestone): boolean {
  return stageForMilestone(direction, milestone) !== undefined
}
