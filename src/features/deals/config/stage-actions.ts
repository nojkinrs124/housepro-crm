/**
 * Главное действие карточки сделки на каждой стадии.
 *
 * Правило (решение владельца 29.10.2026): в шапке сделки одна крупная кнопка —
 * следующий шаг по процессу текущей стадии; всё остальное уходит в меню «…».
 * Раньше главной всегда была «Оформить», а показ, договор, подборка висели
 * рядом на любой стадии — непонятно, что делать сейчас (QA 28.10.2026, R8).
 *
 * Чистая функция без 'use client'/'use server': возвращает данные, а не
 * элементы, поэтому её можно покрыть тестом и вызывать на сервере.
 */
import { isTerminal } from '@/features/directions/config/directions'

export interface StageAction {
  /** Текст кнопки — глагол, что сделать. */
  label: string
  href: string
  /** Код для data-testid и для исключения дубля в меню «…». */
  code: StageActionCode
}

export type StageActionCode =
  | 'meeting' | 'checklist' | 'contract_create' | 'contract_open'
  | 'property_prepare' | 'property_pick' | 'showing' | 'complete'
  | 'income' | 'edit_terms' | 'collection_create' | 'collection_open' | 'engagement'

export interface StageActionContext {
  dealId: string
  direction: string
  stage: string
  propertyId?: string | null
  clientContactId?: string | null
  clientIsLegal?: boolean
  /** Договоры сделки: тип, статус, id. */
  contracts: ReadonlyArray<{ id: string; contract_type: string; status: string }>
  collections: ReadonlyArray<{ id: string; sent_at: string | null }>
}

const CHECKLIST_ANCHOR = '#stage-checklist'

function showingHref(c: StageActionContext): string {
  const q = new URLSearchParams({ deal_id: c.dealId })
  if (c.propertyId) q.set('property_id', c.propertyId)
  if (c.clientContactId) q.set('contact_id', c.clientContactId)
  return `/showings/new?${q}`
}

/**
 * Договор нужного типа: нет — «Создать …», есть неподписанный — «Открыть
 * договор» (там подписание и документ), подписан — вести к чек-листу стадии.
 */
function contractStep(c: StageActionContext, types: string[], createLabel: string): StageAction {
  const existing = c.contracts.find(k => types.includes(k.contract_type))
  if (!existing) {
    return { code: 'contract_create', label: createLabel, href: `/contracts/new?deal_id=${c.dealId}&type=${types[0]}` }
  }
  if (existing.status !== 'signed' && existing.status !== 'active') {
    return { code: 'contract_open', label: 'Открыть и подписать договор', href: `/contracts/${existing.id}` }
  }
  return { code: 'checklist', label: 'Договор подписан — закрыть стадию', href: CHECKLIST_ANCHOR }
}

function prepareStep(c: StageActionContext): StageAction {
  return c.propertyId
    ? { code: 'property_prepare', label: 'Загрузить фото и опубликовать', href: `/properties/${c.propertyId}/edit` }
    : { code: 'property_pick', label: 'Указать объект сделки', href: `/deals/${c.dealId}/edit` }
}

const meeting = (c: StageActionContext, who: string): StageAction => ({
  code: 'meeting',
  label: 'Назначить встречу',
  href: `/tasks/new?deal_id=${c.dealId}&title=${encodeURIComponent(`Встреча с ${who}`)}`,
})
const checklist = (label: string): StageAction => ({ code: 'checklist', label, href: CHECKLIST_ANCHOR })
const showing = (c: StageActionContext, label = 'Назначить показ'): StageAction => ({ code: 'showing', label, href: showingHref(c) })
const complete = (c: StageActionContext, label: string): StageAction => ({ code: 'complete', label, href: `/deals/${c.dealId}/complete` })
const income = (c: StageActionContext): StageAction => ({
  code: 'income', label: 'Начислить комиссию', href: `/accounting/transactions/new?deal_id=${c.dealId}&type=income`,
})

/** Главная кнопка стадии; null — на завершённой или отменённой сделке. */
export function primaryStageAction(c: StageActionContext): StageAction | null {
  if (c.stage === 'cancelled' || isTerminal(c.direction, c.stage)) return null
  const key = `${c.direction}:${c.stage}`

  switch (key) {
    // ── Аренда, «Агент» ──
    case 'rent_agent:sourcing':        return meeting(c, 'собственником')
    case 'rent_agent:meeting':         return checklist('Отметить итоги встречи')
    case 'rent_agent:agency_contract': return contractStep(c, ['agency_owner'], 'Создать агентский договор')
    case 'rent_agent:preparation':     return prepareStep(c)
    case 'rent_agent:showings':        return showing(c)
    case 'rent_agent:tenant_check':    return complete(c, 'Оформить договор найма')
    case 'rent_agent:move_in':         return income(c)

    // ── Управление ──
    case 'management:sourcing':        return meeting(c, 'собственником')
    case 'management:meeting':         return checklist('Отметить итоги встречи')
    case 'management:mgmt_contract':   return contractStep(c, ['property_management', 'sublease'], 'Создать договор управления')
    case 'management:handover':
    case 'management:move_in':
      return c.propertyId
        ? { code: 'engagement', label: 'Принять объект в управление', href: `/management/new?deal_id=${c.dealId}&property_id=${c.propertyId}` }
        : prepareStep(c)
    case 'management:preparation':     return prepareStep(c)
    case 'management:showings':        return showing(c)
    case 'management:tenant_check':    return complete(c, 'Оформить договор найма')

    // ── Продажа ──
    case 'sale:sourcing':              return meeting(c, 'собственником')
    case 'sale:valuation':             return checklist('Зафиксировать оценку')
    case 'sale:agency_contract':       return contractStep(c, ['agency_owner', 'agency_legal_entity'], 'Создать договор с собственником')
    case 'sale:docs_check':            return checklist('Отметить проверку документов')
    case 'sale:preparation':           return prepareStep(c)
    case 'sale:showings':              return showing(c)
    case 'sale:preliminary':           return { code: 'edit_terms', label: 'Указать аванс и срок сделки', href: `/deals/${c.dealId}/edit` }
    case 'sale:main_contract':         return complete(c, 'Оформить договор купли-продажи')
    case 'sale:registration':          return income(c)

    // ── Подбор для арендатора ──
    case 'tenant_search:inquiry':      return { code: 'edit_terms', label: 'Указать комиссию', href: `/deals/${c.dealId}/edit` }
    case 'tenant_search:search_contract':
      return contractStep(c, c.clientIsLegal ? ['agency_legal_entity', 'agency_client'] : ['agency_client', 'agency_legal_entity'], 'Создать договор на подбор')
    case 'tenant_search:searching': {
      const col = c.collections[0]
      return col
        ? { code: 'collection_open', label: 'Открыть подборку', href: `/collections/${col.id}` }
        : { code: 'collection_create', label: 'Собрать подборку', href: `/collections/new?deal_id=${c.dealId}` }
    }
    case 'tenant_search:collection_sent': {
      const col = c.collections.find(k => !k.sent_at) ?? c.collections[0]
      return col
        ? { code: 'collection_open', label: col.sent_at ? 'Открыть подборку' : 'Отправить подборку', href: `/collections/${col.id}` }
        : { code: 'collection_create', label: 'Собрать подборку', href: `/collections/new?deal_id=${c.dealId}` }
    }
    case 'tenant_search:viewings':      return showing(c, 'Назначить просмотр')
    case 'tenant_search:rent_contract': return complete(c, 'Оформить договор найма')
  }
  // Стадия без особого шага — к чек-листу, он у каждой стадии свой.
  return checklist('Закрыть стадию')
}
