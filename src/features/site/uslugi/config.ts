/**
 * Бизнес-данные раздела «Услуги» публичного сайта.
 *
 * ЕДИНСТВЕННЫЙ источник чисел для страниц /uslugi/*: проценты тарифов, сроки,
 * лимиты гарантии, контакты, ориентировочные ставки аренды. В компонентах
 * раздела ни одного захардкоженного процента, срока или суммы быть не должно —
 * всё читается отсюда. Значения согласованы с заказчиком (см.
 * docs/uslugi/sdat-kvartiru-texts.md); менять их без него нельзя.
 *
 * Незакрытые значения перечислены в docs/uslugi/OPEN-QUESTIONS.md с указанием
 * поля в этом файле.
 *
 * Файл намеренно без 'use client': его читают и серверные страницы, и
 * клиентский калькулятор, и Route Handler приёма заявок.
 */

import { FALLBACK_CONTACTS, WORKING_HOURS } from '@/features/site/config'

// ─── Тарифы ────────────────────────────────────────────────────────────────

export type TariffId = 'podbor' | 'upravlenie' | 'premium'

export const TARIFF_IDS: readonly TariffId[] = ['podbor', 'upravlenie', 'premium']

export interface TariffConfig {
  id: TariffId
  /** Полное название в карточке тарифа */
  name: string
  /** Короткое — для шапки таблицы сравнения и бейджей */
  shortName: string
  /** Название в шапке результата калькулятора */
  calcName: string
  /** Процент комиссии */
  percent: number
  /** `once` — разово при заселении; `monthly` — с каждого ежемесячного платежа */
  commissionKind: 'once' | 'monthly'
  /** Метка «выбирают чаще всего» */
  popular: boolean
  /** Источник лида в CRM для кнопки этого тарифа */
  ctaLabel: string
}

export const TARIFFS: Record<TariffId, TariffConfig> = {
  podbor: {
    id: 'podbor',
    name: 'Разовый подбор нанимателя',
    shortName: 'Подбор',
    calcName: 'Разовый подбор',
    percent: 25,
    commissionKind: 'once',
    popular: false,
    ctaLabel: 'Оставить заявку на подбор',
  },
  upravlenie: {
    id: 'upravlenie',
    name: 'Управление',
    shortName: 'Управление',
    calcName: 'Управление',
    percent: 10,
    commissionKind: 'monthly',
    popular: true,
    ctaLabel: 'Передать квартиру в управление',
  },
  premium: {
    id: 'premium',
    name: 'Премиум',
    shortName: 'Премиум',
    calcName: 'Премиум',
    percent: 15,
    commissionKind: 'monthly',
    popular: false,
    ctaLabel: 'Хочу Премиум',
  },
}

/** «25% разово» / «10% в месяц» — единая формулировка комиссии в таблицах и карточках */
export function tariffCommissionLabel(t: TariffConfig): string {
  return t.commissionKind === 'once' ? `${t.percent}% разово` : `${t.percent}% в месяц`
}

// ─── Условия ───────────────────────────────────────────────────────────────

export const USLUGI = {
  /**
   * Комиссия нанимателя — страница «Снять квартиру». Нижняя граница: реальная
   * зависит от объекта, поэтому на сайте всегда «от 25%» (tenantCommissionLabel).
   */
  tenantCommissionPercent: 25,

  /** Первая сделка бесплатно: один объект на собственника, только при первом обращении */
  freeFirstDeal: {
    objectsPerOwner: 1,
    firstContactOnly: true,
  },

  /** Бесплатная замена нанимателя, дней с заселения */
  freeReplacementDays: 60,

  /** Гарантия платежа на тарифе «Премиум» */
  paymentGuarantee: {
    /** просрочка, после которой платим сами, дней */
    overdueDays: 15,
    /** компенсация, в месячных ставках */
    maxMonthlyRates: 1,
    /** минимальный срок договора найма, месяцев */
    minContractMonths: 6,
    /** минимальный депозит нанимателя, в месячных ставках */
    minDepositMonthlyRates: 1,
    /** сколько раз выплачивается за срок договора */
    payoutsPerContract: 1,
  },

  /** Мелкий ремонт за счёт агентства на «Управлении» и «Премиуме» */
  minorRepairs: {
    perIncidentRub: 5_000,
    perYearRub: 60_000,
  },

  /** Перевод арендной платы собственнику: с 1-го по 10-е число */
  payoutWindow: { fromDay: 1, toDay: 10 },

  /** Плановая проверка квартиры, раз в N месяцев */
  inspectionEveryMonths: 3,

  /** Страхование на «Премиуме» */
  insurance: {
    maxRub: 1_000_000,
    /**
     * ⚠️ Название страховой компании заказчик ещё не передал. Пустая строка —
     * пункт выводится без названия; как только значение появится, вёрстка
     * подхватит его сама.
     */
    company: '',
  },

  /** Сроки */
  timing: {
    /** поиск нанимателя, дней */
    tenantSearchDays: 21,
    /** подписание и заселение в день показа, минут */
    moveInMinutes: 30,
  },

  /** Расторжение договора с агентством */
  agencyTermination: {
    /** письменное уведомление, дней */
    noticeDays: 60,
    /** штрафов и удержаний нет */
    penalties: false,
  },

  /** Обратный звонок и часы работы */
  callback: {
    withinMinutes: 15,
    workingHours: WORKING_HOURS,
  },
} as const

/** «от 25%» — комиссия нанимателя одной формулировкой везде на сайте */
export function tenantCommissionLabel(): string {
  return `от ${USLUGI.tenantCommissionPercent}%`
}

// ─── Цены соседних страниц ─────────────────────────────────────────────────
//
// Типы допускают null: если значение не задано, блок цены на странице
// скрывается целиком, а не показывает прочерк.

export interface SalePricing {
  /** процент от стоимости объекта */
  percent: number
  /** фиксированная надбавка, ₽ */
  fixedRub: number
}

export interface LegalSupportPricing {
  /** фиксированная цена «от», ₽ */
  fromRub: number
}

/** Сопровождение продажи или покупки: 3% от стоимости объекта плюс 30 000 ₽ */
export const SALE_PRICING: SalePricing | null = { percent: 3, fixedRub: 30_000 }

/** Юридическое сопровождение чужой сделки: фиксированная цена от 10 000 ₽ */
export const LEGAL_SUPPORT_PRICING: LegalSupportPricing | null = { fromRub: 10_000 }

// ─── Контакты и реквизиты ──────────────────────────────────────────────────

/** Номер в том виде, в котором он должен звучать в текстах (экран успеха и т.п.) */
const PHONE_DIGITS = FALLBACK_CONTACTS.phone.replace(/[^\d+]/g, '') // +79607626799

export const USLUGI_CONTACTS = {
  /** +7 (960) 762-67-99 */
  phone: '+7 (960) 762-67-99',
  phoneHref: `tel:${PHONE_DIGITS}`,
  email: FALLBACK_CONTACTS.email,
  /**
   * Ссылка на Telegram. Именного канала/аккаунта агентства в проекте нет —
   * пока ведём на чат по номеру телефона (t.me/+7…). Заменить на
   * https://t.me/<username>, когда заказчик его назовёт —
   * см. docs/uslugi/OPEN-QUESTIONS.md.
   */
  telegramUrl: `https://t.me/${PHONE_DIGITS}`,
} as const

export const TRUST = {
  /** «В недвижимости с 2019 года» */
  sinceYear: 2019,
  /** «Больше 250 закрытых сделок» */
  closedDeals: 250,
  /**
   * Квартир в управлении сейчас — базовое значение со слов заказчика.
   * Страница «О компании» показывает большее из этого числа и живого счётчика
   * CRM (public_site_stats): когда CRM догонит, цифра начнёт расти сама.
   */
  objectsInManagement: 30,
  legalName: 'Ножкин Руслан Сергеевич',
  inn: '2465337113',
  address: FALLBACK_CONTACTS.address,
  workingHours: WORKING_HOURS,
} as const

// ─── Документы-образцы ─────────────────────────────────────────────────────

export interface DocumentSample {
  id: 'management-contract' | 'handover-act' | 'owner-report'
  title: string
  description: string
  /**
   * Ссылка на обезличенный образец (PDF в public/ или внешняя). Пока null —
   * кнопка карточки превращается в «Запросить образец» и ведёт в форму заявки
   * с контекстом документа. См. OPEN-QUESTIONS.md.
   */
  sampleUrl: string | null
}

export const DOCUMENT_SAMPLES: readonly DocumentSample[] = [
  {
    id: 'management-contract',
    title: 'Договор доверительного управления',
    description: 'что мы обязаны делать, что вы, как расторгается',
    sampleUrl: null,
  },
  {
    id: 'handover-act',
    title: 'Акт приёма-передачи с описью',
    description: 'мебель, техника, состояние, счётчики, фото',
    sampleUrl: null,
  },
  {
    id: 'owner-report',
    title: 'Ежемесячный отчёт собственнику',
    description: 'поступления, удержания, расходы по квартире',
    sampleUrl: null,
  },
]

// ─── Калькулятор: районы, комнатность, ориентировочные ставки ──────────────

export const DISTRICTS = [
  'Советский',
  'Центральный',
  'Октябрьский',
  'Железнодорожный',
  'Свердловский',
  'Кировский',
  'Ленинский',
  'Берёзовка',
] as const

export type District = (typeof DISTRICTS)[number]

export const ROOMS_OPTIONS = [
  { key: 'studio1', label: 'Студия или 1', rooms: 1 },
  { key: 'r2', label: '2', rooms: 2 },
  { key: 'r3', label: '3', rooms: 3 },
  { key: 'r4plus', label: '4 и больше', rooms: 4 },
] as const

export type RoomsKey = (typeof ROOMS_OPTIONS)[number]['key']

export const ROOMS_LABELS: Record<RoomsKey, string> = Object.fromEntries(
  ROOMS_OPTIONS.map(o => [o.key, o.label])
) as Record<RoomsKey, string>

/** Числовое значение комнат для колонки leads.rooms */
export const ROOMS_NUMBER: Record<RoomsKey, number> = Object.fromEntries(
  ROOMS_OPTIONS.map(o => [o.key, o.rooms])
) as Record<RoomsKey, number>

/** Ползунок ставки в калькуляторе */
export const RATE_SLIDER = {
  min: 10_000,
  max: 200_000,
  step: 1_000,
} as const

/**
 * Ориентировочные ставки аренды, ₽/мес: район × комнатность.
 *
 * // ЧЕРНОВЫЕ ЗНАЧЕНИЯ — подтвердить у Руслана перед публикацией
 *
 * Это не рыночная аналитика: числа расставлены от среднего ориентира по городу
 * (~32 000 ₽) с грубой поправкой на район, чтобы калькулятор работал и
 * структура таблицы была видна. Реальные значения проставляет заказчик.
 */
export const RENT_RATES: Record<District, Record<RoomsKey, number>> = {
  Центральный:     { studio1: 32_000, r2: 40_000, r3: 52_000, r4plus: 69_000 },
  Советский:       { studio1: 28_000, r2: 35_000, r3: 45_000, r4plus: 60_000 },
  Октябрьский:     { studio1: 29_500, r2: 37_000, r3: 47_000, r4plus: 63_000 },
  Железнодорожный: { studio1: 29_500, r2: 37_000, r3: 47_000, r4plus: 63_000 },
  Свердловский:    { studio1: 26_500, r2: 33_500, r3: 43_000, r4plus: 57_000 },
  Кировский:       { studio1: 25_000, r2: 31_500, r3: 40_500, r4plus: 54_000 },
  Ленинский:       { studio1: 24_500, r2: 31_000, r3: 39_500, r4plus: 53_000 },
  Берёзовка:       { studio1: 22_500, r2: 28_000, r3: 36_000, r4plus: 48_000 },
}

export const DEFAULT_DISTRICT: District = 'Советский'
export const DEFAULT_ROOMS: RoomsKey = 'r2'

// ─── Источники лидов по страницам ──────────────────────────────────────────

/**
 * Источник лида в CRM — свой у каждой страницы раздела, чтобы считать
 * конверсию по страницам. Подписи для CRM и Telegram — в
 * src/features/leads/config/lead-sources.ts.
 */
export const USLUGI_LEAD_SOURCES = {
  hub: 'site_uslugi',
  about: 'site_o_kompanii',
  sdatKvartiru: 'site_sdat_kvartiru',
  snyat: 'site_snyat',
  prodat: 'site_prodat',
} as const

export type UslugiLeadSource = (typeof USLUGI_LEAD_SOURCES)[keyof typeof USLUGI_LEAD_SOURCES]

// ─── Маршруты раздела ──────────────────────────────────────────────────────

export const USLUGI_ROUTES = {
  hub: '/uslugi',
  sdatKvartiru: '/uslugi/sdat-kvartiru',
  snyatKvartiru: '/uslugi/snyat-kvartiru',
  prodatKupit: '/uslugi/prodat-kupit',
  about: '/o-kompanii',
} as const

/** Якоря на странице «Сдать квартиру» — общие для кнопок, липкой панели и форм */
export const USLUGI_ANCHORS = {
  calculator: 'kalkulyator',
  tariffs: 'tarify',
  lead: 'zayavka',
} as const
