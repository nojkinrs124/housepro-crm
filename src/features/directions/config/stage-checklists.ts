/**
 * Чек-листы стадий: что нужно сделать, чтобы стадию можно было считать пройденной.
 *
 * Отличие от предусловий (`preconditions.ts`): предусловие — факт, который система
 * проверяет сама по данным (подписан ли договор, загружены ли фото). Пункт
 * чек-листа — действие в реальном мире, которое отмечает риелтор: «позвонил
 * собственнику», «снял замеры». Система не может узнать об этом сама, но обязана
 * не дать забыть.
 *
 * Обязательные пункты (`required: true`) блокируют переход на следующую стадию —
 * FR-004. Отметки хранятся в `deals.stage_progress`.
 *
 * Ключ — пара `направление:стадия`: коды стадий переиспользуются между
 * направлениями, а список дел на них разный.
 *
 * Файл намеренно без 'use client'.
 */

export interface ChecklistItem {
  code: string
  title: string
  /** Обязательный пункт не даёт уйти со стадии, пока не закрыт. */
  required: boolean
  /** Подсказка под пунктом — зачем он нужен. */
  hint?: string
}

export const STAGE_CHECKLISTS: Record<string, readonly ChecklistItem[]> = {
  // ── Аренда, тариф «Агент» ──
  'rent_agent:sourcing': [
    { code: 'source_saved',  title: 'Указан источник объявления',   required: true,  hint: 'Площадка, где нашли объект — это основа статистики по источникам' },
    { code: 'owner_called',  title: 'Дозвонились до собственника',  required: true },
    { code: 'object_asked',  title: 'Уточнили параметры объекта',   required: false },
  ],
  'rent_agent:meeting': [
    { code: 'visited',       title: 'Побывали на объекте',                 required: true },
    { code: 'services_told', title: 'Рассказали об услугах агентства',     required: true,  hint: 'Тарифы и что входит в каждый' },
    { code: 'plan_agreed',   title: 'Собственник согласился на тариф',     required: true },
    { code: 'docs_seen',     title: 'Посмотрели документы на объект',      required: false },
  ],
  'rent_agent:agency_contract': [
    { code: 'contract_made',   title: 'Подготовлен агентский договор', required: true },
    { code: 'contract_signed', title: 'Договор подписан обеими сторонами', required: true },
  ],
  'rent_agent:preparation': [
    { code: 'photos',      title: 'Сделана фотосъёмка',           required: true },
    { code: 'photos_up',   title: 'Фотографии загружены в объект', required: true },
    { code: 'description', title: 'Написано описание',             required: true },
    { code: 'cleaned',     title: 'Объект подготовлен к показам',  required: false, hint: 'Уборка, мелкие недочёты' },
  ],
  'rent_agent:showings': [
    { code: 'published',  title: 'Объявление размещено',       required: true },
    { code: 'shown',      title: 'Проведён хотя бы один показ', required: true },
  ],
  'rent_agent:tenant_check': [
    { code: 'passport',   title: 'Проверен паспорт арендатора',   required: true },
    { code: 'solvency',   title: 'Проверена платёжеспособность',  required: true },
    { code: 'owner_ok',   title: 'Собственник одобрил кандидата', required: true },
    { code: 'contract',   title: 'Подготовлен договор найма',     required: true },
  ],
  'rent_agent:move_in': [
    { code: 'signed',     title: 'Договор найма подписан',        required: true },
    { code: 'act',        title: 'Подписан акт приёма-передачи',  required: true },
    { code: 'meters',     title: 'Сняты показания счётчиков',     required: true },
    { code: 'keys',       title: 'Переданы ключи',                required: true },
    { code: 'commission', title: 'Получена комиссия',             required: true },
  ],

  // ── Управление ──
  'management:meeting': [
    { code: 'visited',       title: 'Побывали на объекте',                  required: true },
    { code: 'services_told', title: 'Рассказали об услугах агентства',      required: true },
    { code: 'plan_agreed',   title: 'Собственник выбрал тариф',             required: true },
    { code: 'scheme_agreed', title: 'Согласована схема расчёта',            required: true,  hint: 'Процент от платежа или фиксированная выплата собственнику' },
  ],
  'management:mgmt_contract': [
    { code: 'contract_made',   title: 'Подготовлен договор управления', required: true },
    { code: 'contract_signed', title: 'Договор подписан',               required: true },
  ],
  'management:handover': [
    { code: 'meters',    title: 'Сняты начальные показания счётчиков', required: true },
    { code: 'inventory', title: 'Составлена опись имущества',          required: true },
    { code: 'condition', title: 'Зафиксировано состояние объекта',     required: true },
    { code: 'keys',      title: 'Получены ключи',                      required: true },
    { code: 'docs',      title: 'Получены документы на объект',        required: false },
  ],
  'management:preparation': [
    { code: 'photos',      title: 'Сделана фотосъёмка',            required: true },
    { code: 'photos_up',   title: 'Фотографии загружены в объект', required: true },
    { code: 'description', title: 'Написано описание',             required: true },
  ],
  'management:showings': [
    { code: 'published', title: 'Объявление размещено',        required: true },
    { code: 'shown',     title: 'Проведён хотя бы один показ',  required: true },
  ],
  'management:tenant_check': [
    { code: 'passport', title: 'Проверен паспорт арендатора',  required: true },
    { code: 'solvency', title: 'Проверена платёжеспособность', required: true },
    { code: 'contract', title: 'Подготовлен договор найма',     required: true },
  ],
  'management:move_in': [
    { code: 'signed', title: 'Договор найма подписан',       required: true },
    { code: 'act',    title: 'Подписан акт приёма-передачи', required: true },
    { code: 'meters', title: 'Сняты показания на заселение', required: true },
    { code: 'keys',   title: 'Переданы ключи',               required: true },
  ],

  // ── Продажа и покупка ──
  'sale:valuation': [
    { code: 'visited',  title: 'Побывали на объекте',        required: true },
    { code: 'analogs',  title: 'Собраны аналоги по рынку',   required: true },
    { code: 'price',    title: 'Согласована цена выхода',    required: true },
  ],
  'sale:agency_contract': [
    { code: 'contract_made',   title: 'Подготовлен договор с собственником', required: true },
    { code: 'contract_signed', title: 'Договор подписан',                     required: true },
  ],
  'sale:docs_check': [
    { code: 'title_docs',  title: 'Проверены правоустанавливающие документы', required: true },
    { code: 'egrn',        title: 'Получена и проверена выписка ЕГРН',        required: true },
    { code: 'encumbrance', title: 'Проверены обременения и аресты',           required: true },
    { code: 'spouse',      title: 'Проверено согласие супруга',               required: true,  hint: 'Если объект приобретён в браке' },
    { code: 'registered',  title: 'Проверены зарегистрированные лица',        required: true },
    { code: 'debts',       title: 'Проверены долги по коммунальным платежам', required: false },
    { code: 'perepl',      title: 'Проверены перепланировки',                 required: false },
  ],
  'sale:preparation': [
    { code: 'photos',      title: 'Сделана фотосъёмка',   required: true },
    { code: 'photos_up',   title: 'Фотографии загружены', required: true },
    { code: 'description', title: 'Написано описание',    required: true },
  ],
  'sale:showings': [
    { code: 'published', title: 'Объявление размещено',       required: true },
    { code: 'shown',     title: 'Проведён хотя бы один показ', required: true },
  ],
  'sale:preliminary': [
    { code: 'terms',    title: 'Согласованы условия сделки',        required: true },
    { code: 'advance',  title: 'Зафиксирован аванс или задаток',    required: true },
    { code: 'deadline', title: 'Определён срок выхода на сделку',   required: true },
    { code: 'signed',   title: 'Предварительный договор подписан',  required: true },
  ],
  'sale:main_contract': [
    { code: 'draft',    title: 'Подготовлен основной договор', required: true },
    { code: 'checked',  title: 'Договор согласован сторонами', required: true },
    { code: 'signed',   title: 'Основной договор подписан',    required: true },
  ],
  'sale:registration': [
    { code: 'submitted', title: 'Документы поданы на регистрацию',    required: true },
    { code: 'registered', title: 'Переход права зарегистрирован',     required: true },
    { code: 'act',       title: 'Подписан акт приёма-передачи',       required: true },
    { code: 'settled',   title: 'Расчёты между сторонами завершены',  required: true },
  ],

  // ── Подбор для арендатора ──
  'tenant_search:inquiry': [
    { code: 'needs',      title: 'Выяснены требования к объекту', required: true },
    { code: 'budget',     title: 'Определён бюджет',              required: true },
    { code: 'entity',     title: 'Определён тип клиента',         required: true,  hint: 'Физическое лицо или юридическое — от этого зависит договор и пакет документов' },
    { code: 'commission', title: 'Обсуждён размер комиссии',      required: true },
  ],
  'tenant_search:search_contract': [
    { code: 'contract_made',   title: 'Подготовлен договор на подбор',        required: true },
    { code: 'commission_fixed', title: 'Комиссия зафиксирована в договоре',   required: true },
    { code: 'contract_signed', title: 'Договор подписан',                      required: true,  hint: 'Поиск начинается после договора — это порядок работы, а не формальность' },
  ],
  'tenant_search:searching': [
    { code: 'searched', title: 'Просмотрены площадки и база',   required: true },
    { code: 'called',   title: 'Прозвонены подходящие варианты', required: true },
  ],
  'tenant_search:collection_sent': [
    { code: 'built', title: 'Собрана подборка вариантов', required: true },
    { code: 'sent',  title: 'Подборка отправлена клиенту', required: true },
  ],
  'tenant_search:viewings': [
    { code: 'scheduled', title: 'Назначены просмотры',          required: true },
    { code: 'done',      title: 'Проведён хотя бы один просмотр', required: true },
    { code: 'feedback',  title: 'Собрана обратная связь клиента', required: false },
  ],
  'tenant_search:rent_contract': [
    { code: 'docs',   title: 'Собран пакет документов клиента', required: true },
    { code: 'draft',  title: 'Подготовлен договор найма',       required: true },
    { code: 'signed', title: 'Договор найма подписан',          required: true },
    { code: 'act',    title: 'Подписан акт приёма-передачи',    required: true },
  ],
}

export function checklistFor(direction: string | null | undefined, stage: string): readonly ChecklistItem[] {
  return STAGE_CHECKLISTS[`${direction}:${stage}`] ?? []
}

export function requiredItems(direction: string | null | undefined, stage: string): readonly ChecklistItem[] {
  return checklistFor(direction, stage).filter(i => i.required)
}

/** Незакрытые обязательные пункты стадии. Пустой массив = стадию можно закрывать. */
export function unmetItems(
  direction: string | null | undefined,
  stage: string,
  progress: Record<string, string[]> | null | undefined,
): readonly ChecklistItem[] {
  const done = new Set(progress?.[stage] ?? [])
  return requiredItems(direction, stage).filter(i => !done.has(i.code))
}
