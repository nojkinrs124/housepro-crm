// Единый справочник типов договоров.
// Используется формой создания/редактирования договора, генерацией DOCX,
// загрузкой шаблонов и всеми списками/детальными страницами.
//
// group:
//   'direct' — договор напрямую между собственником и клиентом, агентство стороной не является
//   'agency' — агентство (HousePro) само выступает одной из сторон (party1)
//
// party1Role / party2Role:
//   'agency' — сторона фиксирована и подставляется из company_settings
//   'owner'  — выбирается из контактов с ролью owner/both
//   'client' — выбирается из контактов с ролью client/both

import { Home, Building2, HandCoins, ClipboardList, FileSignature, Briefcase, Settings, Repeat, type LucideIcon } from 'lucide-react'

export type ContractPartyRole = 'agency' | 'owner' | 'client'

export interface ContractTypeConfig {
  value: string
  label: string
  shortLabel: string
  icon: LucideIcon
  group: 'direct' | 'agency'
  party1Role: ContractPartyRole
  party2Role: ContractPartyRole
  party1Label: string
  party2Label: string
  /** Если задано — список объектов фильтруется по property_type */
  propertyTypes?: string[]
  /** Сторона 2 должна быть юр. лицом (client_type = legal_entity) */
  requiresLegalEntity?: boolean
  /** Нужен договор-основание (для субаренды — исходный договор аренды) */
  requiresBaseContract?: boolean
  /** DOCX заголовок для базовой генерации без шаблона */
  docTitle: string
  /**
   * Направление работы, в котором заключается такой договор. Нужно, чтобы
   * предложить тарифы именно этого направления, а не весь справочник, и чтобы
   * проверить, что тариф договору подходит.
   *
   * У договоров группы 'direct' его нет: они заключаются между собственником и
   * клиентом напрямую, агентство стороной не является и вознаграждения по ним
   * не получает.
   */
  direction?: 'rent_agent' | 'management' | 'sale' | 'tenant_search'

  // ── Финансы и сроки ──
  amountLabel: string
  amountPlaceholder?: string
  showDeposit: boolean
  depositLabel?: string
  /** 'range' — период (дата начала/окончания), 'single' — одна дата сделки */
  dateMode: 'range' | 'single'
  startDateLabel: string
  endDateLabel?: string
}

export const CONTRACT_TYPES: ContractTypeConfig[] = [
  {
    value: 'rent_apartment',
    label: 'Аренда квартиры',
    shortLabel: 'Аренда квартиры',
    icon: Home,
    group: 'direct',
    party1Role: 'owner',
    party2Role: 'client',
    party1Label: 'Собственник',
    party2Label: 'Арендатор',
    propertyTypes: ['apartment', 'house'],
    docTitle: 'ДОГОВОР НАЙМА ЖИЛОГО ПОМЕЩЕНИЯ',
    amountLabel: 'Арендная плата (₽/мес)',
    amountPlaceholder: '50 000',
    showDeposit: true,
    depositLabel: 'Залог (₽)',
    dateMode: 'range',
    startDateLabel: 'Дата начала аренды',
    endDateLabel: 'Дата окончания аренды',
  },
  {
    value: 'rent_commercial',
    label: 'Аренда коммерческой недвижимости',
    shortLabel: 'Коммерческая аренда',
    icon: Building2,
    group: 'direct',
    party1Role: 'owner',
    party2Role: 'client',
    party1Label: 'Собственник',
    party2Label: 'Арендатор',
    propertyTypes: ['commercial', 'office', 'warehouse', 'land'],
    docTitle: 'ДОГОВОР АРЕНДЫ НЕЖИЛОГО ПОМЕЩЕНИЯ',
    amountLabel: 'Арендная плата (₽/мес)',
    amountPlaceholder: '150 000',
    showDeposit: true,
    depositLabel: 'Обеспечительный платёж (₽)',
    dateMode: 'range',
    startDateLabel: 'Дата начала аренды',
    endDateLabel: 'Дата окончания аренды',
  },
  {
    value: 'sale',
    label: 'Купля-продажа недвижимости',
    shortLabel: 'Купля-продажа',
    icon: HandCoins,
    group: 'direct',
    party1Role: 'owner',
    party2Role: 'client',
    party1Label: 'Продавец',
    party2Label: 'Покупатель',
    docTitle: 'ДОГОВОР КУПЛИ-ПРОДАЖИ НЕДВИЖИМОСТИ',
    amountLabel: 'Цена продажи (₽)',
    amountPlaceholder: '8 500 000',
    showDeposit: true,
    depositLabel: 'Задаток (₽)',
    dateMode: 'single',
    startDateLabel: 'Дата сделки',
  },
  {
    value: 'agency_owner',
    direction: 'rent_agent',
    label: 'Агентский договор с собственником',
    shortLabel: 'Агентский (собственник)',
    icon: ClipboardList,
    group: 'agency',
    party1Role: 'agency',
    party2Role: 'owner',
    party1Label: 'Агентство (Исполнитель)',
    party2Label: 'Собственник (Принципал)',
    docTitle: 'АГЕНТСКИЙ ДОГОВОР С СОБСТВЕННИКОМ',
    amountLabel: 'Вознаграждение агентства (₽)',
    amountPlaceholder: '30 000',
    showDeposit: false,
    dateMode: 'range',
    startDateLabel: 'Дата начала действия',
    endDateLabel: 'Дата окончания действия',
  },
  {
    value: 'agency_client',
    direction: 'tenant_search',
    label: 'Агентский договор с заказчиком',
    shortLabel: 'Агентский (заказчик)',
    icon: FileSignature,
    group: 'agency',
    party1Role: 'agency',
    party2Role: 'client',
    party1Label: 'Агентство (Исполнитель)',
    party2Label: 'Заказчик',
    docTitle: 'АГЕНТСКИЙ ДОГОВОР С ЗАКАЗЧИКОМ',
    amountLabel: 'Вознаграждение агентства (₽)',
    amountPlaceholder: '50 000',
    showDeposit: false,
    dateMode: 'range',
    startDateLabel: 'Дата начала действия',
    endDateLabel: 'Дата окончания действия',
  },
  {
    value: 'agency_legal_entity',
    direction: 'tenant_search',
    label: 'Агентский договор с юр. лицом',
    shortLabel: 'Агентский (юр. лицо)',
    icon: Briefcase,
    group: 'agency',
    party1Role: 'agency',
    party2Role: 'client',
    party1Label: 'Агентство (Исполнитель)',
    party2Label: 'Заказчик (юр. лицо)',
    requiresLegalEntity: true,
    docTitle: 'АГЕНТСКИЙ ДОГОВОР С ЮРИДИЧЕСКИМ ЛИЦОМ',
    amountLabel: 'Вознаграждение агентства (₽)',
    amountPlaceholder: '100 000',
    showDeposit: false,
    dateMode: 'range',
    startDateLabel: 'Дата начала действия',
    endDateLabel: 'Дата окончания действия',
  },
  {
    value: 'property_management',
    direction: 'management',
    label: 'Договор управления недвижимостью',
    shortLabel: 'Управление',
    icon: Settings,
    group: 'agency',
    party1Role: 'agency',
    party2Role: 'owner',
    party1Label: 'Агентство (Управляющий)',
    party2Label: 'Собственник',
    docTitle: 'ДОГОВОР ДОВЕРИТЕЛЬНОГО УПРАВЛЕНИЯ',
    amountLabel: 'Вознаграждение за управление (₽/мес)',
    amountPlaceholder: '15 000',
    showDeposit: false,
    dateMode: 'range',
    startDateLabel: 'Дата начала управления',
    endDateLabel: 'Дата окончания управления',
  },
  {
    value: 'sublease',
    direction: 'management',
    label: 'Договор субаренды',
    shortLabel: 'Субаренда',
    icon: Repeat,
    group: 'agency',
    party1Role: 'agency',
    party2Role: 'client',
    party1Label: 'Агентство (Арендатор/Субарендодатель)',
    party2Label: 'Субарендатор',
    requiresBaseContract: true,
    docTitle: 'ДОГОВОР СУБАРЕНДЫ',
    amountLabel: 'Субарендная плата (₽/мес)',
    amountPlaceholder: '50 000',
    showDeposit: true,
    depositLabel: 'Залог (₽)',
    dateMode: 'range',
    startDateLabel: 'Дата начала субаренды',
    endDateLabel: 'Дата окончания субаренды',
  },
]

export const CONTRACT_TYPE_MAP: Record<string, ContractTypeConfig> = Object.fromEntries(
  CONTRACT_TYPES.map(t => [t.value, t])
)

export const CONTRACT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  CONTRACT_TYPES.map(t => [t.value, t.shortLabel])
)

export function getContractTypeConfig(value: string | null | undefined): ContractTypeConfig | undefined {
  if (!value) return undefined
  return CONTRACT_TYPE_MAP[value]
}

/**
 * Типы договоров, по которым объект кому-то сдан. Именно они приводят в
 * управление арендатора: в договоре аренды сторона «клиент» —
 * client_contact_id — это и есть наниматель, а объект тот же (property_id).
 */
export const RENT_CONTRACT_TYPES = ['rent_apartment', 'rent_commercial', 'sublease']

/**
 * Действующая аренда: договор не отменён и ещё не закончился. Бессрочный
 * (без end_date) считается действующим — так же, как в разделе «Управление».
 */
export function isActiveRentContract(
  c: { contract_type?: string | null; status?: string | null; end_date?: string | null },
  todayStr: string = new Date().toISOString().slice(0, 10)
): boolean {
  if (!RENT_CONTRACT_TYPES.includes(c.contract_type ?? '')) return false
  if (c.status === 'cancelled') return false
  if (c.end_date && c.end_date < todayStr) return false
  return true
}
