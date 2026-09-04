/**
 * Готовность записи — единый ответ на вопрос «что не сработает, если это поле
 * пустое».
 *
 * Заводить сущности строго по порядку (собственник → объект → лид → сделка →
 * договор) в жизни не получается: звонок приходит раньше карточки, договор
 * подписывают до того, как принесли паспорт. Поэтому CRM ничего не запрещает —
 * она показывает, какая функция молча не заработает, пока поле пустое, и куда
 * идти дозаполнять.
 *
 * Файл намеренно без импортов из supabase и без JSX: правила проверяются
 * юнит-тестами и одинаково работают на сервере и на клиенте.
 */

export type ReadinessLevel = 'blocker' | 'warn'

export interface ReadinessIssue {
  /** Стабильный ключ — по нему тесты и подавление повторов */
  id: string
  level: ReadinessLevel
  /** Чего не хватает, в одну строку */
  missing: string
  /** Что из-за этого не работает — то, ради чего вообще стоит идти дозаполнять */
  effect: string
  /** Куда идти чинить */
  href?: string
}

/** Пусто ли значение: null, undefined и строка из пробелов считаются пустыми. */
const empty = (v: unknown): boolean =>
  v === null || v === undefined || (typeof v === 'string' && v.trim() === '')

const sortIssues = (issues: ReadinessIssue[]): ReadinessIssue[] =>
  issues.sort((a, b) => (a.level === b.level ? 0 : a.level === 'blocker' ? -1 : 1))

// ─── Объект ───────────────────────────────────────────────────────────────────

export interface PropertyReadinessInput {
  id: string
  title?: string | null
  address?: string | null
  description?: string | null
  price?: number | null
  status?: string | null
  deal_type?: string | null
  owner_id?: string | null
  latitude?: number | null
  longitude?: number | null
  site_publish?: boolean | null
  avito_publish?: boolean | null
  management_fee?: number | null
}

export interface PropertyReadinessContext {
  /** Есть ли по объекту действующий договор аренды/найма */
  hasActiveRentContract?: boolean
  /** Заведено ли по объекту действующее обслуживание (management_engagements) */
  hasActiveEngagement?: boolean
}

export function checkProperty(
  p: PropertyReadinessInput,
  ctx: PropertyReadinessContext = {}
): ReadinessIssue[] {
  const issues: ReadinessIssue[] = []
  const edit = `/properties/${p.id}/edit`

  if (empty(p.owner_id)) {
    issues.push({
      id: 'property.owner',
      level: 'blocker',
      missing: 'Не указан собственник',
      effect: 'В управлении и в отчёте собственник будет пустым, договор подписывать не с кем',
      href: edit,
    })
  }

  // Тип сделки «Управление» в карточке и объект в управлении — разные вещи, и
  // это неочевидно: человек ставит тип и ждёт объект в разделе. Раздел читает
  // `management_engagements`, а туда попадают только принятые объекты — со
  // своим договором, собственником и схемой расчёта.
  if (p.deal_type === 'management' && ctx.hasActiveEngagement === false) {
    issues.push({
      id: 'property.engagement',
      level: 'warn',
      missing: 'Объект не принят в управление',
      effect:
        'В разделе «Объекты в управлении» его не будет: нет ни договора, ни схемы расчёта ' +
        'с собственником, ни акта приёма — считать и отчитываться не по чему',
      href: `/management/new?property_id=${p.id}`,
    })
  }

  // Координаты приходят только из подсказки DaData: адрес, вбитый руками,
  // выглядит правильно, но на карту и в фид площадок не попадает.
  if (empty(p.latitude) || empty(p.longitude)) {
    issues.push({
      id: 'property.geo',
      level: 'warn',
      missing: 'Нет координат адреса',
      effect: 'Объект не уйдёт на Яндекс и Домклик и не встанет на карту в подборке — введите адрес через подсказку',
      href: edit,
    })
  }

  const wantsFeed = p.site_publish === true || p.avito_publish === true || p.status === 'available'
  if (wantsFeed && empty(p.description)) {
    issues.push({
      id: 'property.description',
      level: 'warn',
      missing: 'Нет описания',
      effect: 'Объявление не выгрузится на площадки — описание обязательно',
      href: edit,
    })
  }
  if (wantsFeed && empty(p.price)) {
    issues.push({
      id: 'property.price',
      level: 'warn',
      missing: 'Не указана цена',
      effect: 'Объявление не выгрузится на площадки и объект не попадёт в подборки по бюджету',
      href: edit,
    })
  }

  // Статус объекта и договор аренды расходятся — самая дорогая рассинхронизация:
  // в одну сторону объект числится свободным и продолжает висеть в рекламе,
  // в другую — арендатор не появляется в «Управлении».
  if (ctx.hasActiveRentContract === true && p.status === 'available') {
    issues.push({
      id: 'property.rented_but_available',
      level: 'blocker',
      missing: 'По объекту есть договор аренды, но статус — «Доступно»',
      effect: 'Сданный объект продолжит выгружаться на площадки как свободный',
      href: edit,
    })
  }
  if (ctx.hasActiveRentContract === false && p.status === 'rented') {
    issues.push({
      id: 'property.available_but_rented',
      level: 'warn',
      missing: 'Объект помечен сданным, но договора аренды нет',
      effect: 'Арендатор не появится в «Управлении», а начисления по аренде не создадутся',
      href: `/contracts/new?property_id=${p.id}`,
    })
  }

  if (p.deal_type === 'management' && empty(p.management_fee)) {
    issues.push({
      id: 'property.management_fee',
      level: 'warn',
      missing: 'Не указано вознаграждение за управление',
      effect: 'В отчёте собственнику вознаграждение агентства посчитается нулём',
      href: edit,
    })
  }

  return sortIssues(issues)
}

// ─── Контакт ──────────────────────────────────────────────────────────────────

export interface ContactReadinessInput {
  id: string
  client_type?: string | null
  role?: string | null
  phone?: string | null
  email?: string | null
  passport_series?: string | null
  passport_number?: string | null
  passport_issued_by?: string | null
  company_name?: string | null
  inn?: string | null
  ogrn?: string | null
  legal_address?: string | null
  bank_account?: string | null
}

export function checkContact(c: ContactReadinessInput): ReadinessIssue[] {
  const issues: ReadinessIssue[] = []
  const edit = `/contacts/${c.id}/edit`
  const isLegal = c.client_type === 'legal_entity'

  if (empty(c.phone)) {
    issues.push({
      id: 'contact.phone',
      level: 'warn',
      missing: 'Нет телефона',
      effect: 'Контакт не найдётся при проверке дублей и по нему не позвонить из карточки',
      href: edit,
    })
  }

  // Напоминания об оплате уходят почтой и молча пропускаются, если адреса нет:
  // в интерфейсе это выглядит как «напоминание отправлено», а письма нет.
  if (empty(c.email)) {
    issues.push({
      id: 'contact.email',
      level: 'warn',
      missing: 'Нет email',
      effect: 'Напоминания об оплате и документы на подпись этому контакту не уйдут',
      href: edit,
    })
  }

  if (isLegal) {
    const missing = [
      empty(c.company_name) && 'название',
      empty(c.inn) && 'ИНН',
      empty(c.ogrn) && 'ОГРН',
      empty(c.legal_address) && 'юридический адрес',
      empty(c.bank_account) && 'расчётный счёт',
    ].filter((v): v is string => typeof v === 'string')

    if (missing.length > 0) {
      issues.push({
        id: 'contact.legal_details',
        level: 'warn',
        missing: `Не заполнены реквизиты: ${missing.join(', ')}`,
        effect: 'В договоре на месте реквизитов останутся пропуски',
        href: edit,
      })
    }
  } else {
    const missing = [
      (empty(c.passport_series) || empty(c.passport_number)) && 'серия и номер',
      empty(c.passport_issued_by) && 'кем выдан',
    ].filter((v): v is string => typeof v === 'string')

    if (missing.length > 0) {
      issues.push({
        id: 'contact.passport',
        level: 'warn',
        missing: `Не заполнен паспорт: ${missing.join(', ')}`,
        effect: 'В договоре на месте паспортных данных останутся пропуски',
        href: edit,
      })
    }
  }

  return sortIssues(issues)
}

// ─── Лид ──────────────────────────────────────────────────────────────────────

export interface LeadReadinessInput {
  id: string
  phone?: string | null
  email?: string | null
  telegram?: string | null
  whatsapp?: string | null
  source?: string | null
  status?: string | null
}

export function checkLead(l: LeadReadinessInput): ReadinessIssue[] {
  const issues: ReadinessIssue[] = []
  const edit = `/leads/${l.id}/edit`

  const noContact = empty(l.phone) && empty(l.email) && empty(l.telegram) && empty(l.whatsapp)
  if (noContact) {
    issues.push({
      id: 'lead.contact',
      level: 'blocker',
      missing: 'Нет ни одного способа связи',
      effect: 'С обращением ничего не сделать — телефон, почта или мессенджер обязательны',
      href: edit,
    })
  }

  if (empty(l.source)) {
    issues.push({
      id: 'lead.source',
      level: 'warn',
      missing: 'Не указан источник',
      effect: 'Аналитика по площадкам будет пустой — не видно, какая реклама окупается',
      href: edit,
    })
  }

  return sortIssues(issues)
}

// ─── Договор ──────────────────────────────────────────────────────────────────

export interface ContractReadinessInput {
  id: string
  contract_type?: string | null
  property_id?: string | null
  owner_contact_id?: string | null
  client_contact_id?: string | null
  start_date?: string | null
  end_date?: string | null
  amount?: number | null
  contract_number?: string | null
}

/** Договоры-услуги агентства заключаются без объекта — там объект не требуется. */
const CONTRACT_TYPES_WITHOUT_PROPERTY = new Set([
  'agency_owner',
  'agency_client',
  'agency_legal_entity',
])

export function checkContract(c: ContractReadinessInput): ReadinessIssue[] {
  const issues: ReadinessIssue[] = []
  const edit = `/contracts/${c.id}/edit`

  if (empty(c.property_id) && !CONTRACT_TYPES_WITHOUT_PROPERTY.has(c.contract_type ?? '')) {
    issues.push({
      id: 'contract.property',
      level: 'blocker',
      missing: 'Не выбран объект',
      effect: 'Договор не попадёт в карточку объекта, а арендатор — в раздел «Управление»',
      href: edit,
    })
  }

  if (empty(c.owner_contact_id) || empty(c.client_contact_id)) {
    issues.push({
      id: 'contract.parties',
      level: 'blocker',
      missing: 'Указаны не обе стороны',
      effect: 'Документ сформируется с пропусками, отправить на подпись будет некому',
      href: edit,
    })
  }

  if (empty(c.start_date) || empty(c.end_date)) {
    issues.push({
      id: 'contract.dates',
      level: 'warn',
      missing: 'Не заполнены даты начала и окончания',
      effect: 'Не посчитается срок действия и не будет предупреждения об истечении',
      href: edit,
    })
  }

  if (empty(c.amount)) {
    issues.push({
      id: 'contract.amount',
      level: 'warn',
      missing: 'Не указана сумма',
      effect: 'График начислений построить не из чего',
      href: edit,
    })
  }

  if (empty(c.contract_number)) {
    issues.push({
      id: 'contract.number',
      level: 'warn',
      missing: 'Нет номера договора',
      effect: 'В документе останется пропуск на месте номера',
      href: edit,
    })
  }

  return sortIssues(issues)
}

// ─── Операция учёта ───────────────────────────────────────────────────────────

export interface TransactionReadinessInput {
  id: string
  type?: string | null
  category_id?: string | null
  property_id?: string | null
  contract_id?: string | null
  status?: string | null
  /** Плановая дата операции */
  date?: string | null
  due_date?: string | null
}

export function checkTransaction(
  t: TransactionReadinessInput,
  todayStr: string = new Date().toISOString().slice(0, 10)
): ReadinessIssue[] {
  const issues: ReadinessIssue[] = []

  // «Запланировано» с прошедшим сроком — обычно деньги уже пришли, а статус
  // переставить забыли. В прибыль идут только выполненные операции, поэтому
  // отчёт молча занижает доход.
  const plannedDate = t.due_date ?? t.date ?? null
  if (t.status === 'planned' && plannedDate && plannedDate < todayStr) {
    issues.push({
      id: 'transaction.stale_planned',
      level: 'warn',
      missing: 'Операция числится запланированной, хотя срок уже прошёл',
      effect: 'В прибыль и в отчёт идут только выполненные операции — деньги получены, но нигде не учтены',
    })
  }

  // Календарь строится по сроку оплаты: без due_date начисление существует,
  // но нигде не всплывает и напоминание по нему не уходит.
  if (t.status === 'planned' && empty(t.due_date)) {
    issues.push({
      id: 'transaction.due_date',
      level: 'warn',
      missing: 'У запланированной операции нет срока оплаты',
      effect: 'Начисление не появится в календаре и напоминание по нему не уйдёт',
    })
  }

  if (empty(t.category_id)) {
    issues.push({
      id: 'transaction.category',
      level: 'warn',
      missing: 'Не выбрана категория',
      effect: 'Операция не попадёт в «Структуру месяца» — там останется пропуск',
    })
  }

  // Расход без договора привязать к объекту больше нечем: коммуналка и ремонт
  // просто выпадут из доходности объекта.
  if (t.type === 'expense' && empty(t.contract_id) && empty(t.property_id)) {
    issues.push({
      id: 'transaction.property',
      level: 'warn',
      missing: 'Расход не привязан ни к объекту, ни к договору',
      effect: 'Коммуналка и ремонт не попадут в доходность объекта и в отчёт собственнику',
    })
  }

  return sortIssues(issues)
}

// ─── Сводка ───────────────────────────────────────────────────────────────────

export interface ReadinessSummary {
  issues: ReadinessIssue[]
  blockers: number
  warnings: number
  ok: boolean
}

export function summarize(issues: ReadinessIssue[]): ReadinessSummary {
  const blockers = issues.filter(i => i.level === 'blocker').length
  return {
    issues,
    blockers,
    warnings: issues.length - blockers,
    ok: issues.length === 0,
  }
}
