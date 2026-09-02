/**
 * Единая карта реестров CRM: какая таблица стоит за разделом, какие у него
 * статусы и в какой колонке лежит ответственный.
 *
 * Нужна там, где код одинаков для всех списков, — групповые действия над
 * выделенными строками и панель фильтров. Без неё пришлось бы писать десять
 * почти одинаковых Server Actions.
 *
 * Наборы статусов сверены с CHECK-констрейнтами базы 02.09.2026. Расхождение
 * здесь означает молча не сохраняющуюся смену статуса (так уже было с лидами),
 * поэтому значения берутся из общих словарей фич, а не переписываются руками.
 *
 * Файл намеренно без 'use client': его читают и серверные экшены, и клиентские
 * компоненты (см. проверку границы client/server).
 */

import { LEAD_STATUSES } from '@/features/leads/config/lead-statuses'
import { DEAL_STAGES, DEAL_STAGE_CANCELLED } from '@/features/deals/config/deal-stages'
import { PROPERTY_STATUS_LABELS } from '@/features/properties/config/property-labels'

export interface StatusOption { value: string; label: string }

export interface RegistryDef {
  /** Таблица в Supabase */
  table: string
  /** Ресурс для requirePermission */
  resource:
    | 'contacts' | 'deals' | 'leads' | 'properties' | 'contracts'
    | 'employees' | 'accounting' | 'tasks' | 'showings' | 'collections'
  /** Путь для revalidatePath после группового действия */
  path: string
  /** Формы существительного для «Удалить 1 договор / 2 договора / 5 договоров» */
  nouns: readonly [string, string, string]
  /** Колонка с человекочитаемым названием записи — попадает в журнал аудита */
  labelColumn: string
  /** Колонка статуса; нет — раздел не поддерживает групповую смену статуса */
  statusColumn?: string
  /** true — статус хранится как boolean (у сотрудников это is_active) */
  statusIsBoolean?: boolean
  statuses?: readonly StatusOption[]
  /** Колонка ответственного; нет — раздел не поддерживает групповое назначение */
  assigneeColumn?: string
  /** false — групповое удаление запрещено (сотрудника отключают, а не стирают) */
  deletable?: boolean
}

const CONTACT_STATUSES = [
  { value: 'new',      label: 'Новый' },
  { value: 'active',   label: 'Активный' },
  { value: 'vip',      label: 'VIP' },
  { value: 'inactive', label: 'Неактивный' },
] as const

export const CONTRACT_STATUSES = [
  { value: 'draft',     label: 'Черновик' },
  { value: 'generated', label: 'Создан' },
  { value: 'signed',    label: 'Подписан' },
  { value: 'completed', label: 'Завершён' },
  { value: 'cancelled', label: 'Отменён' },
] as const

export const SHOWING_STATUSES = [
  { value: 'planned',   label: 'Запланирован' },
  { value: 'completed', label: 'Проведён' },
  { value: 'cancelled', label: 'Отменён' },
  { value: 'no_show',   label: 'Не явились' },
] as const

export const TASK_STATUSES = [
  { value: 'todo',        label: 'К выполнению' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'done',        label: 'Выполнено' },
  { value: 'cancelled',   label: 'Отменено' },
] as const

export const TRANSACTION_STATUSES = [
  { value: 'planned',   label: 'Запланировано' },
  { value: 'completed', label: 'Выполнено' },
  { value: 'cancelled', label: 'Отменено' },
] as const

const REGISTRY_MAP = {
  leads: {
    table: 'leads', resource: 'leads', path: '/leads',
    nouns: ['лид', 'лида', 'лидов'],
    labelColumn: 'full_name',
    statusColumn: 'status',
    statuses: LEAD_STATUSES.map(s => ({ value: s.value, label: s.label })),
    assigneeColumn: 'assigned_to',
  },
  deals: {
    table: 'deals', resource: 'deals', path: '/deals',
    nouns: ['сделку', 'сделки', 'сделок'],
    labelColumn: 'deal_number',
    statusColumn: 'status',
    statuses: [...DEAL_STAGES.map(s => ({ value: s.value, label: s.label })), { ...DEAL_STAGE_CANCELLED }],
    assigneeColumn: 'manager_id',
  },
  contacts: {
    table: 'contacts', resource: 'contacts', path: '/contacts',
    nouns: ['контакт', 'контакта', 'контактов'],
    labelColumn: 'full_name',
    statusColumn: 'status', statuses: CONTACT_STATUSES,
    assigneeColumn: 'manager_id',
  },
  contracts: {
    table: 'contracts', resource: 'contracts', path: '/contracts',
    nouns: ['договор', 'договора', 'договоров'],
    labelColumn: 'contract_number',
    statusColumn: 'status', statuses: CONTRACT_STATUSES,
    assigneeColumn: 'manager_id',
  },
  properties: {
    table: 'properties', resource: 'properties', path: '/properties',
    nouns: ['объект', 'объекта', 'объектов'],
    labelColumn: 'title',
    statusColumn: 'status',
    statuses: Object.entries(PROPERTY_STATUS_LABELS).map(([value, s]) => ({ value, label: s.label })),
    assigneeColumn: 'manager_id',
  },
  showings: {
    table: 'showings', resource: 'showings', path: '/showings',
    nouns: ['показ', 'показа', 'показов'],
    labelColumn: 'scheduled_at',
    statusColumn: 'status', statuses: SHOWING_STATUSES,
    assigneeColumn: 'agent_id',
  },
  tasks: {
    table: 'tasks', resource: 'tasks', path: '/tasks',
    nouns: ['задачу', 'задачи', 'задач'],
    labelColumn: 'title',
    statusColumn: 'status', statuses: TASK_STATUSES,
    assigneeColumn: 'assigned_to',
  },
  collections: {
    table: 'property_collections', resource: 'collections', path: '/collections',
    nouns: ['подборку', 'подборки', 'подборок'],
    labelColumn: 'title',
  },
  employees: {
    table: 'users', resource: 'employees', path: '/employees',
    nouns: ['сотрудника', 'сотрудников', 'сотрудников'],
    labelColumn: 'full_name',
    // Сотрудника не удаляют: на него ссылаются сделки, договоры и задачи.
    // Групповое действие здесь — снять или вернуть доступ.
    statusColumn: 'is_active', statusIsBoolean: true,
    statuses: [{ value: 'true', label: 'Активен' }, { value: 'false', label: 'Неактивен' }],
    deletable: false,
  },
  transactions: {
    table: 'accounting_transactions', resource: 'accounting', path: '/accounting',
    nouns: ['операцию', 'операции', 'операций'],
    labelColumn: 'description',
    statusColumn: 'status', statuses: TRANSACTION_STATUSES,
    assigneeColumn: 'employee_id',
  },
} as const satisfies Record<string, RegistryDef>

export type RegistryKey = keyof typeof REGISTRY_MAP

/**
 * Доступ к карте идёт через этот тип, а не через литеральный: иначе на разделе
 * без статусов (подборки) TypeScript не видит поля statusColumn у всего union
 * и общий код по реестрам не типизируется.
 */
export const REGISTRIES: Record<RegistryKey, RegistryDef> = REGISTRY_MAP

/** «1 договор», «2 договора», «5 договоров» */
export function plural(n: number, forms: readonly [string, string, string]): string {
  const mod100 = n % 100
  const mod10 = n % 10
  if (mod100 >= 11 && mod100 <= 14) return `${n} ${forms[2]}`
  if (mod10 === 1) return `${n} ${forms[0]}`
  if (mod10 >= 2 && mod10 <= 4) return `${n} ${forms[1]}`
  return `${n} ${forms[2]}`
}
