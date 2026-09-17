/**
 * Сценарий «Занести в CRM» в Telegram-боте — чистая часть: типы, тексты,
 * промпты извлечения и карточка подтверждения.
 *
 * Принцип сценария: тип документа задаёт пользователь кнопкой, модель только
 * вычитывает поля, Postgres (`import_intake`) связывает и дедуплицирует.
 * До 17.09.2026 тип документа угадывала модель по общему промпту, а фото без
 * подписи и вовсе уходило ей как «чек» — отсюда и путаница.
 *
 * Здесь нет ни сети, ни базы — всё проверяется тестами. Оркестрация
 * (сессии, Storage, вызов модели) — в `src/lib/telegram/intake.ts`.
 *
 * Файл без 'use client'.
 */

import { LEAD_DEAL_TYPE_LABELS } from '@/features/leads/config/lead-deal-types'
import { DIRECTION_LABELS, getStage } from '@/features/directions/config/directions'

export type IntakeKind = 'unknown' | 'tenant' | 'owner' | 'property' | 'contract' | 'receipt'

/** Типы, по которым модель вычитывает поля и создаются записи CRM. */
export const INTAKE_DATA_KINDS: readonly IntakeKind[] = ['tenant', 'owner', 'property', 'contract']

export const INTAKE_KIND_LABELS: Record<IntakeKind, string> = {
  unknown: 'Не выбрано',
  tenant: '👤 Арендатор',
  owner: '🏠 Собственник',
  property: '🗂 Объект',
  contract: '📄 Договор',
  receipt: '🧾 Чек',
}

export interface IntakePerson {
  full_name?: string
  phone?: string
  email?: string
  birth_date?: string
  passport_series?: string
  passport_number?: string
  passport_issued_date?: string
  passport_issued_by?: string
  passport_department_code?: string
  country?: string
  region?: string
  city?: string
  street?: string
  house_number?: string
  building?: string
  apartment?: string
}

export interface IntakeProperty {
  title?: string
  property_type?: string
  deal_type?: string
  address?: string
  district?: string
  cadastral_number?: string
  area?: number
  living_area?: number
  land_area?: number
  rooms?: number
  floor?: number
  total_floors?: number
  year_built?: number
  ownership_basis?: string
  encumbrances?: string
  price?: number
  deposit?: number
  description?: string
}

export interface IntakeLead {
  deal_type?: string
  property_type?: string
  district?: string
  rooms?: number
  budget_min?: number
  budget_max?: number
  area_min?: number
  area_max?: number
  comment?: string
}

export interface IntakeDeal {
  direction?: string
  amount?: number
  notes?: string
}

/** То, что модель возвращает инструментом submit_extraction. */
export interface IntakeExtraction {
  contact?: IntakePerson
  tenant?: IntakePerson
  property?: IntakeProperty
  lead?: IntakeLead
  deal?: IntakeDeal
  /** Поля, в которых модель не уверена (плохо читается, противоречие). */
  uncertain?: string[]
}

export interface IntakeFileRef {
  path: string
  mime: string
  name: string
  source: 'photo' | 'document'
  media_group_id?: string
}

// ─── Промпты извлечения ─────────────────────────────────────────────────────

const PERSON_RULES = `Паспорт РФ: серия — 4 цифры (пиши «12 34»), номер — 6 цифр, «кем выдан» — полностью как в документе,
код подразделения вида «770-001», даты — YYYY-MM-DD. Адрес регистрации — со страницы с пропиской, разложи на
region / city / street / house_number / building / apartment. Телефон и e-mail — из подписей и текстовых
сообщений пользователя, не из паспорта. Что не читается или не найдено — не заполняй и назови поле в uncertain.
Ничего не выдумывай: пустое поле лучше угаданного.`

const PROPERTY_RULES = `Выписка ЕГРН / свидетельство: кадастровый номер вида 77:01:0001001:1234, адрес как в документе,
площади числом в м², этаж, этажность, год постройки, вид и основание права в ownership_basis
(«собственность, договор купли-продажи от …»), ограничения и обременения в encumbrances (ипотека, аренда,
арест — или не заполняй, если «не зарегистрировано»). Кадастровую стоимость — в price, только если она есть.
title — короткое имя вида «2к, Ленина 10»; property_type — apartment/house/commercial/office/warehouse/land.`

export const INTAKE_PROMPTS: Record<Exclude<IntakeKind, 'unknown' | 'receipt'>, string> = {
  tenant: `Ты вычитываешь документы АРЕНДАТОРА (человека, который хочет снять жильё) для CRM агентства недвижимости.
Заполни блок contact — данные человека. ${PERSON_RULES}
Блок lead — чего человек хочет, из подписей и сообщений: deal_type «rent» (снять) или «subrent», rooms, district,
budget_min/budget_max в рублях за месяц, comment — суть запроса одной фразой. Если пожеланий нет — lead не заполняй.
Блоки property, tenant, deal — не заполняй.`,

  owner: `Ты вычитываешь документы СОБСТВЕННИКА (человека, который сдаёт или продаёт жильё) для CRM агентства недвижимости.
Заполни блок contact — данные человека. ${PERSON_RULES}
Если среди документов есть выписка ЕГРН или свидетельство — заполни блок property. ${PROPERTY_RULES}
Блок lead: deal_type «let» (сдать) или «sell» (продать) — по подписям и сообщениям, по умолчанию «let»;
comment — суть одной фразой. Блок deal: direction «rent_agent» (сдать через агентство, по умолчанию),
«management» (передать в управление) или «sale» (продать) — только если пользователь это сказал.
Блок tenant — не заполняй.`,

  property: `Ты вычитываешь ПРАВОУСТАНАВЛИВАЮЩИЙ ДОКУМЕНТ на недвижимость (выписка ЕГРН, свидетельство, договор
дарения/приватизации) для CRM агентства недвижимости. Заполни блок property. ${PROPERTY_RULES}
Если в документе есть правообладатель (раздел о правах) — заполни блок contact его ФИО и, если есть, датой рождения
и паспортными данными. ${PERSON_RULES}
deal_type объекта в таких документах нет: заполняй только если пользователь написал «аренда»/«продажа»/«управление»
(rent/sale/management). Блоки lead, tenant, deal — не заполняй.`,

  contract: `Ты вычитываешь ДОГОВОР аренды/найма (или купли-продажи) для CRM агентства недвижимости.
Блок contact — наймодатель/собственник (сторона, которая сдаёт), блок tenant — наниматель/арендатор.
Для обоих: ${PERSON_RULES}
Блок property — объект договора. ${PROPERTY_RULES} Ставку в месяц — в property.price, залог — в property.deposit.
Блок deal: amount — ставка в месяц числом, notes — срок договора и особые условия одной строкой,
direction «rent_agent» (по умолчанию), «management» или «sale» — по сути договора.
Блок lead — не заполняй.`,
}

export const INTAKE_SYSTEM_PREAMBLE = `Ты — модуль распознавания документов внутри Telegram-бота HousePro CRM.
Отвечай ТОЛЬКО вызовом инструмента submit_extraction — никакого текста. Все значения — на русском, как в документе.
Числа — числом без пробелов и валюты. Даты — YYYY-MM-DD.`

/** Схема инструмента извлечения — одна на все типы, промпт говорит, какие блоки заполнять. */
const PERSON_SCHEMA = {
  type: 'object',
  properties: {
    full_name: { type: 'string', description: 'Фамилия Имя Отчество' },
    phone: { type: 'string' },
    email: { type: 'string' },
    birth_date: { type: 'string', description: 'YYYY-MM-DD' },
    passport_series: { type: 'string', description: '«12 34»' },
    passport_number: { type: 'string', description: '6 цифр' },
    passport_issued_date: { type: 'string', description: 'YYYY-MM-DD' },
    passport_issued_by: { type: 'string' },
    passport_department_code: { type: 'string', description: '«770-001»' },
    country: { type: 'string' },
    region: { type: 'string' },
    city: { type: 'string' },
    street: { type: 'string' },
    house_number: { type: 'string' },
    building: { type: 'string' },
    apartment: { type: 'string' },
  },
} as const

export const INTAKE_TOOL = {
  type: 'function',
  function: {
    name: 'submit_extraction',
    description: 'Вернуть вычитанные из документов данные. Заполняй только то, что действительно есть.',
    parameters: {
      type: 'object',
      properties: {
        contact: PERSON_SCHEMA,
        tenant: PERSON_SCHEMA,
        property: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            property_type: { type: 'string', enum: ['apartment', 'house', 'commercial', 'office', 'warehouse', 'land'] },
            deal_type: { type: 'string', enum: ['rent', 'sale', 'management', 'subrent'] },
            address: { type: 'string' },
            district: { type: 'string' },
            cadastral_number: { type: 'string' },
            area: { type: 'number' },
            living_area: { type: 'number' },
            land_area: { type: 'number' },
            rooms: { type: 'number' },
            floor: { type: 'number' },
            total_floors: { type: 'number' },
            year_built: { type: 'number' },
            ownership_basis: { type: 'string' },
            encumbrances: { type: 'string' },
            price: { type: 'number' },
            deposit: { type: 'number' },
            description: { type: 'string' },
          },
        },
        lead: {
          type: 'object',
          properties: {
            deal_type: { type: 'string', enum: ['rent', 'sale', 'let', 'sell', 'subrent'] },
            property_type: { type: 'string', enum: ['apartment', 'house', 'commercial', 'office', 'warehouse', 'land'] },
            district: { type: 'string' },
            rooms: { type: 'number' },
            budget_min: { type: 'number' },
            budget_max: { type: 'number' },
            area_min: { type: 'number' },
            area_max: { type: 'number' },
            comment: { type: 'string' },
          },
        },
        deal: {
          type: 'object',
          properties: {
            direction: { type: 'string', enum: ['rent_agent', 'management', 'sale', 'tenant_search'] },
            amount: { type: 'number' },
            notes: { type: 'string' },
          },
        },
        uncertain: {
          type: 'array',
          items: { type: 'string' },
          description: 'Названия полей, в которых не уверен, по-русски: «код подразделения», «кадастровый номер»',
        },
      },
    },
  },
} as const

// ─── Карточка подтверждения ─────────────────────────────────────────────────

const RU_DATE = (iso?: string) => {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso
}

/** «40 000 ₽» с обычным пробелом: toLocaleString ставит неразрывный, и он же уезжает в тесты и поиск. */
export const money = (n?: number) =>
  typeof n === 'number' && Number.isFinite(n) ? `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₽` : ''

function personLines(p: IntakePerson | undefined, title: string): string[] {
  if (!p) return [`<b>${title}:</b> не найден`]
  const lines = [`<b>${title}: ${p.full_name ?? '— ФИО не прочитано —'}</b>`]
  if (p.passport_series || p.passport_number) {
    let s = `Паспорт ${p.passport_series ?? '??'} № ${p.passport_number ?? '??'}`
    if (p.passport_issued_by) s += `, выдан ${p.passport_issued_by}`
    if (p.passport_issued_date) s += ` ${RU_DATE(p.passport_issued_date)}`
    if (p.passport_department_code) s += `, код ${p.passport_department_code}`
    lines.push(s)
  }
  if (p.birth_date) lines.push(`Родился(ась) ${RU_DATE(p.birth_date)}`)
  const addr = [p.region, p.city, p.street, p.house_number && `д. ${p.house_number}`, p.building && `к. ${p.building}`, p.apartment && `кв. ${p.apartment}`]
    .filter(Boolean)
    .join(', ')
  if (addr) lines.push(`Регистрация: ${addr}`)
  const contacts = [p.phone && `📞 ${p.phone}`, p.email && `✉️ ${p.email}`].filter(Boolean).join(' · ')
  lines.push(contacts || '📞 телефон не указан — допиши сообщением')
  return lines
}

function propertyLines(pr: IntakeProperty | undefined): string[] {
  if (!pr) return []
  const lines = [`<b>Объект: ${pr.title ?? pr.address ?? '— адрес не прочитан —'}</b>`]
  if (pr.title && pr.address) lines.push(pr.address)
  const facts = [
    pr.cadastral_number && `кадастр. ${pr.cadastral_number}`,
    pr.area && `${pr.area} м²`,
    pr.rooms && `${pr.rooms}-комн.`,
    pr.floor && `этаж ${pr.floor}${pr.total_floors ? `/${pr.total_floors}` : ''}`,
    pr.year_built && `${pr.year_built} г.`,
  ].filter(Boolean)
  if (facts.length) lines.push(facts.join(' · '))
  if (pr.ownership_basis) lines.push(`Право: ${pr.ownership_basis}`)
  if (pr.encumbrances) lines.push(`⚠️ Обременения: ${pr.encumbrances}`)
  if (pr.price) lines.push(`Ставка/цена: ${money(pr.price)}${pr.deposit ? `, залог ${money(pr.deposit)}` : ''}`)
  return lines
}

function leadLine(l: IntakeLead | undefined, kind: IntakeKind): string {
  const wish = l?.deal_type ? LEAD_DEAL_TYPE_LABELS[l.deal_type] : kind === 'tenant' ? 'Снять' : 'Сдать'
  const parts = [
    wish,
    l?.rooms && `${l.rooms}к`,
    l?.district,
    l?.budget_max && `до ${money(l.budget_max)}`,
    !l?.budget_max && l?.budget_min && `от ${money(l.budget_min)}`,
  ].filter(Boolean)
  return `Хочет: ${parts.join(', ')}${l?.comment ? ` — ${l.comment}` : ''}`
}

export function directionFor(kind: IntakeKind, x: IntakeExtraction): string {
  if (kind === 'tenant') return 'tenant_search'
  return x.deal?.direction && x.deal.direction !== 'tenant_search' ? x.deal.direction : 'rent_agent'
}

export function stageFor(kind: IntakeKind, direction: string): string {
  if (direction === 'tenant_search') return 'inquiry'
  if (kind === 'contract') return 'tenant_check'
  return 'sourcing'
}

/** Строка «Создам: …» — что именно появится в CRM после «✅ Создать». */
export function describeIntakePlan(kind: IntakeKind, x: IntakeExtraction, createDeal: boolean, fileCount: number): string[] {
  const out: string[] = []
  const direction = directionFor(kind, x)
  const stageLabel = getStage(direction, stageFor(kind, direction))?.label ?? stageFor(kind, direction)
  const dealText = `сделку «${DIRECTION_LABELS[direction] ?? direction}», стадия «${stageLabel}», на проверку`

  if (kind === 'tenant') {
    out.push(`контакт (клиент) · лид (источник Telegram)${createDeal ? ` · ${dealText}` : ''}`)
  } else if (kind === 'owner') {
    const withProp = x.property?.address ? ' · объект, связав с собственником' : ''
    out.push(`контакт (собственник)${withProp} · лид (источник Telegram)${createDeal ? ` · ${dealText}` : ''}`)
  } else if (kind === 'property') {
    out.push(`объект${x.contact?.full_name ? ' · контакт-собственника, связав их' : ''}`)
  } else if (kind === 'contract') {
    out.push(`собственника · арендатора · объект (сдан) · ${dealText}`)
  }
  if (fileCount) out.push(`приложу ${fileCount} ${plural(fileCount, 'файл', 'файла', 'файлов')} к карточке`)
  out.push('контакт с таким же телефоном или паспортом дополню, а не продублирую')
  return out
}

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few
  return many
}

export function renderIntakeCard(kind: IntakeKind, x: IntakeExtraction, opts: { createDeal: boolean; fileCount: number }): string {
  const blocks: string[] = []
  blocks.push(`${INTAKE_KIND_LABELS[kind]} — проверь, что прочитал:`)

  if (kind === 'tenant') {
    blocks.push(personLines(x.contact, 'Арендатор').join('\n'))
    blocks.push(leadLine(x.lead, kind))
  } else if (kind === 'owner') {
    blocks.push(personLines(x.contact, 'Собственник').join('\n'))
    const prop = propertyLines(x.property)
    if (prop.length) blocks.push(prop.join('\n'))
    blocks.push(leadLine(x.lead, kind))
  } else if (kind === 'property') {
    blocks.push(propertyLines(x.property).join('\n') || '<b>Объект:</b> адрес не прочитан')
    if (x.contact?.full_name) blocks.push(personLines(x.contact, 'Правообладатель').join('\n'))
  } else if (kind === 'contract') {
    blocks.push(personLines(x.contact, 'Собственник').join('\n'))
    blocks.push(personLines(x.tenant, 'Арендатор').join('\n'))
    blocks.push(propertyLines(x.property).join('\n') || '<b>Объект:</b> адрес не прочитан')
    if (x.deal?.amount || x.deal?.notes) {
      blocks.push(`Условия: ${[x.deal.amount && `${money(x.deal.amount)}/мес`, x.deal.notes].filter(Boolean).join(' · ')}`)
    }
  }

  if (x.uncertain?.length) blocks.push(`⚠️ Не уверен: ${x.uncertain.join(', ')}`)

  blocks.push(`<b>Создам:</b>\n${describeIntakePlan(kind, x, opts.createDeal, opts.fileCount).map((l) => `• ${l}`).join('\n')}`)
  blocks.push('<i>Что-то не так — просто напиши поправку («код 770-002», «телефон 8912…», «это управление»).</i>')
  return blocks.join('\n\n')
}

/** Чего не хватает, чтобы создать записи: пустой список — можно жать «Создать». */
export function intakeBlockers(kind: IntakeKind, x: IntakeExtraction): string[] {
  const out: string[] = []
  if ((kind === 'tenant' || kind === 'owner' || kind === 'contract') && !x.contact?.full_name?.trim()) {
    out.push(kind === 'tenant' ? 'ФИО арендатора' : 'ФИО собственника')
  }
  if (kind === 'contract' && !x.tenant?.full_name?.trim()) out.push('ФИО арендатора')
  if ((kind === 'property' || kind === 'contract') && !x.property?.address?.trim()) out.push('адрес объекта')
  return out
}

/** Текст сообщения-статуса, пока документы копятся. */
export function renderCollectingStatus(kind: IntakeKind, files: IntakeFileRef[], notes: string[]): string {
  const photos = files.filter((f) => f.source === 'photo').length
  const docs = files.length - photos
  const parts = [
    photos && `${photos} ${plural(photos, 'фото', 'фото', 'фото')}`,
    docs && `${docs} ${plural(docs, 'документ', 'документа', 'документов')}`,
    notes.length && `${notes.length} ${plural(notes.length, 'заметка', 'заметки', 'заметок')}`,
  ].filter(Boolean)
  const head = kind === 'unknown' ? '📎 Принял. Что это?' : `${INTAKE_KIND_LABELS[kind]} — принял: ${parts.join(', ') || 'пока ничего'}.`
  const hint =
    kind === 'unknown'
      ? ''
      : '\nПрисылай ещё фото, документы или текст (телефон, пожелания). Когда всё — жми «Готово».'
  return head + hint
}

export function intakeIntro(kind: IntakeKind): string {
  switch (kind) {
    case 'tenant':
      return '👤 <b>Арендатор</b>\nПришли фото паспорта (можно альбомом), телефон и что ищет — одним или несколькими сообщениями. Когда всё — жми «Готово».'
    case 'owner':
      return '🏠 <b>Собственник</b>\nПришли фото паспорта, при желании выписку ЕГРН, телефон и что сдаём/продаём. Когда всё — жми «Готово».'
    case 'property':
      return '🗂 <b>Объект</b>\nПришли выписку ЕГРН или свидетельство (PDF или фото). Если знаешь назначение — напиши: аренда, продажа, управление. Когда всё — жми «Готово».'
    case 'contract':
      return '📄 <b>Договор</b>\nПришли договор аренды/найма (PDF, DOCX или фото страниц). Заведу обе стороны, объект и сделку. Когда всё — жми «Готово».'
    default:
      return ''
  }
}

// ─── История диалога ────────────────────────────────────────────────────────

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'file'; file: { filename: string; file_data: string } }

export interface HistoryMessage {
  role: string
  content?: string | ContentPart[] | null
}

const MAX_TOOL_RESULT_CHARS = 6000

/**
 * Перед сохранением истории вынимает из неё бинарные вложения и режет длинные
 * ответы инструментов. До этого фото и PDF в base64 хранились как есть и
 * уходили модели на каждое следующее сообщение — 1,4 МБ на «какие задачи?».
 */
export function stripBinaryFromHistory<T extends HistoryMessage>(messages: T[]): T[] {
  return messages.map((m) => {
    if (m.role === 'tool' && typeof m.content === 'string' && m.content.length > MAX_TOOL_RESULT_CHARS) {
      return { ...m, content: m.content.slice(0, MAX_TOOL_RESULT_CHARS) + '…[обрезано]' }
    }
    if (!Array.isArray(m.content)) return m
    const content = m.content.map((part): ContentPart => {
      if (part.type === 'image_url') return { type: 'text', text: '[фото — уже обработано, повторно не читать]' }
      if (part.type === 'file') return { type: 'text', text: `[документ «${part.file.filename}» — уже обработан, повторно не читать]` }
      return part
    })
    return { ...m, content }
  })
}
