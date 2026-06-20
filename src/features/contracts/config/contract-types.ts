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

export type ContractPartyRole = 'agency' | 'owner' | 'client'

export interface ContractTypeConfig {
  value: string
  label: string
  shortLabel: string
  icon: string
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
}

export const CONTRACT_TYPES: ContractTypeConfig[] = [
  {
    value: 'rent_apartment',
    label: '🏠 Аренда квартиры',
    shortLabel: 'Аренда квартиры',
    icon: '🏠',
    group: 'direct',
    party1Role: 'owner',
    party2Role: 'client',
    party1Label: 'Собственник',
    party2Label: 'Арендатор',
    propertyTypes: ['apartment', 'house'],
    docTitle: 'ДОГОВОР НАЙМА ЖИЛОГО ПОМЕЩЕНИЯ',
  },
  {
    value: 'rent_commercial',
    label: '🏢 Аренда коммерческой недвижимости',
    shortLabel: 'Коммерческая аренда',
    icon: '🏢',
    group: 'direct',
    party1Role: 'owner',
    party2Role: 'client',
    party1Label: 'Собственник',
    party2Label: 'Арендатор',
    propertyTypes: ['commercial', 'office', 'warehouse', 'land'],
    docTitle: 'ДОГОВОР АРЕНДЫ НЕЖИЛОГО ПОМЕЩЕНИЯ',
  },
  {
    value: 'sale',
    label: '💰 Купля-продажа недвижимости',
    shortLabel: 'Купля-продажа',
    icon: '💰',
    group: 'direct',
    party1Role: 'owner',
    party2Role: 'client',
    party1Label: 'Продавец',
    party2Label: 'Покупатель',
    docTitle: 'ДОГОВОР КУПЛИ-ПРОДАЖИ НЕДВИЖИМОСТИ',
  },
  {
    value: 'agency_owner',
    label: '📋 Агентский договор с собственником',
    shortLabel: 'Агентский (собственник)',
    icon: '📋',
    group: 'agency',
    party1Role: 'agency',
    party2Role: 'owner',
    party1Label: 'Агентство (Исполнитель)',
    party2Label: 'Собственник (Принципал)',
    docTitle: 'АГЕНТСКИЙ ДОГОВОР С СОБСТВЕННИКОМ',
  },
  {
    value: 'agency_client',
    label: '📋 Агентский договор с заказчиком',
    shortLabel: 'Агентский (заказчик)',
    icon: '📋',
    group: 'agency',
    party1Role: 'agency',
    party2Role: 'client',
    party1Label: 'Агентство (Исполнитель)',
    party2Label: 'Заказчик',
    docTitle: 'АГЕНТСКИЙ ДОГОВОР С ЗАКАЗЧИКОМ',
  },
  {
    value: 'agency_legal_entity',
    label: '🏢 Агентский договор с юр. лицом',
    shortLabel: 'Агентский (юр. лицо)',
    icon: '🏢',
    group: 'agency',
    party1Role: 'agency',
    party2Role: 'client',
    party1Label: 'Агентство (Исполнитель)',
    party2Label: 'Заказчик (юр. лицо)',
    requiresLegalEntity: true,
    docTitle: 'АГЕНТСКИЙ ДОГОВОР С ЮРИДИЧЕСКИМ ЛИЦОМ',
  },
  {
    value: 'property_management',
    label: '⚙️ Договор управления недвижимостью',
    shortLabel: 'Управление',
    icon: '⚙️',
    group: 'agency',
    party1Role: 'agency',
    party2Role: 'owner',
    party1Label: 'Агентство (Управляющий)',
    party2Label: 'Собственник',
    docTitle: 'ДОГОВОР ДОВЕРИТЕЛЬНОГО УПРАВЛЕНИЯ',
  },
  {
    value: 'sublease',
    label: '🔄 Договор субаренды',
    shortLabel: 'Субаренда',
    icon: '🔄',
    group: 'agency',
    party1Role: 'agency',
    party2Role: 'client',
    party1Label: 'Агентство (Арендатор/Субарендодатель)',
    party2Label: 'Субарендатор',
    requiresBaseContract: true,
    docTitle: 'ДОГОВОР СУБАРЕНДЫ',
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
