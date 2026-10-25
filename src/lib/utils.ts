import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { APP_TZ, todayIso } from "@/lib/timezone"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Форматирование ───────────────────────────────────────────────────────────

const ruMoneyFmt = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
})

export function formatMoney(amount: number | string | null | undefined): string {
  return ruMoneyFmt.format(Number(amount ?? 0))
}

export function formatDate(
  date: string | Date | null | undefined,
  opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' }
): string {
  if (!date) return '—'
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return String(date)
  // Пояс агентства, а не браузера/сервера: иначе одно и то же время в двух
  // окружениях показывается по-разному (см. src/lib/timezone.ts).
  return d.toLocaleDateString('ru-RU', { timeZone: APP_TZ, ...opts })
}

/**
 * Сумма без символа валюты и без дробной части: `38 500 000`.
 * Знак ₽ ставится в разметке отдельным спаном — так он может быть
 * приглушённым цветом, как в макете «Кабинета».
 */
export function formatAmount(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '—'
  return Number(amount).toLocaleString('ru-RU', { maximumFractionDigits: 0 })
}

/**
 * Дата в реестрах и списках CRM — всегда `25.10.26` (решение владельца,
 * 25.10.2026): короткая и одинаковая на всех экранах. Документы (отчёт,
 * счёт, договор) форматируют дату сами — там нужен полный год.
 */
export function formatDateCompact(date: string | Date | null | undefined): string {
  if (!date) return '—'
  // «2026-10-25» без времени — календарная дата, сдвигать поясом нельзя
  const d = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T12:00:00Z`) : new Date(date)
  if (Number.isNaN(d.getTime())) return String(date)
  return d.toLocaleDateString('ru-RU', { timeZone: APP_TZ, day: '2-digit', month: '2-digit', year: '2-digit' })
}

/** Дата и время в CRM: `25.10.26 · 08:12` (пояс агентства). */
export function formatDateTimeCompact(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return String(date)
  const time = d.toLocaleTimeString('ru-RU', { timeZone: APP_TZ, hour: '2-digit', minute: '2-digit' })
  return `${formatDateCompact(d)} · ${time}`
}

const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

/** Подпись месяца на осях графиков: «ноя 25» (вместо «нояб. 25 г.»). Принимает «2025-11» / «2025-11-01». */
export function formatMonthShort(isoMonth: string): string {
  const [y, m] = isoMonth.split('-').map(Number)
  if (!y || !m) return isoMonth
  return `${MONTHS_SHORT[m - 1]} ${String(y).slice(2)}`
}

/**
 * Крупная сумма для полос показателей: `1,8 млн ₽`, `450 тыс. ₽`, `45 000 ₽`.
 * В таблицах и документах — всегда полная сумма (formatAmount).
 */
export function formatMoneyShort(amount: number | string | null | undefined): string {
  const n = Number(amount ?? 0)
  if (!Number.isFinite(n)) return '—'
  const sign = n < 0 ? '−' : ''
  const a = Math.abs(n)
  if (a >= 1_000_000) return `${sign}${(a / 1_000_000).toLocaleString('ru-RU', { maximumFractionDigits: a >= 10_000_000 ? 0 : 1 })} млн ₽`
  if (a >= 100_000) return `${sign}${Math.round(a / 1000).toLocaleString('ru-RU')} тыс. ₽`
  return `${sign}${a.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽`
}

/** «2 ч. назад», «3 дн. назад», «12.08.2026» — для мета-строк и лент. */
export function formatRelative(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = new Date(date)
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000)
  if (diffMin < 1) return 'только что'
  if (diffMin < 60) return `${diffMin} мин. назад`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH} ч. назад`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `${diffD} дн. назад`
  return formatDateCompact(d)
}

/**
 * Насколько дедлайн просрочен или сколько до него осталось.
 * `overdue` = true → в интерфейсе строка красится в --hp-danger.
 */
export function formatDeadline(date: string | null | undefined): { label: string; overdue: boolean } | null {
  if (!date) return null
  // Дни считаем по календарю агентства: «сегодня» — это дата в APP_TZ.
  const today = Date.parse(`${todayIso()}T00:00:00Z`)
  const dueStr = /^\d{4}-\d{2}-\d{2}$/.test(String(date)) ? String(date) : todayIso(new Date(date))
  const due = Date.parse(`${dueStr}T00:00:00Z`)
  const days = Math.round((due - today) / 86400000)
  if (days < 0)  return { label: `просрочено ${pluralDays(-days)}`, overdue: true }
  if (days === 0) return { label: 'сегодня', overdue: true }
  if (days === 1) return { label: 'завтра', overdue: false }
  return { label: `до ${formatDateCompact(date)}`, overdue: false }
}

function pluralDays(n: number): string {
  return plural(n, ['день', 'дн.', 'дн.'])
}

/**
 * Число с правильной формой существительного: `plural(3, ['тариф', 'тарифа', 'тарифов'])`
 * → «3 тарифа». Формы — для 1, 2–4 и 5+ (проход 17.09.2026: «1 тарифов»,
 * «1 сотрудников», «2 объектов» в подзаголовках).
 */
export function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n)
  const mod10 = abs % 10, mod100 = abs % 100
  const form = mod10 === 1 && mod100 !== 11 ? forms[0]
    : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? forms[1]
    : forms[2]
  return `${n} ${form}`
}

/** Инициалы для аватара: «Анна Петрова» → «АП». */
export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase()
}

/**
 * Короткий адрес для реестров: без страны, региона, района и города —
 * «ул. Ленина, 12, кв. 5». Полный адрес остаётся в title и в карточке.
 * Посёлки и сёла не срезаются: «пгт Берёзовка» — существенная часть адреса.
 */
export function shortAddress(address: string | null | undefined): string {
  if (!address) return ''
  const parts = address.split(',').map(p => p.trim()).filter(Boolean)
  // \b в JS не работает с кириллицей — границы слов задаём пробелом/краем строки
  const drop = /^(россия|рф|\d{6}|(.*\s)?(край|обл\.?|область|респ\.?|республика|р-н|район|округ)(\s.*)?|г\.?\s*красноярск|красноярск)$/i
  const rest = parts.filter(p => !drop.test(p))
  return (rest.length ? rest : parts).join(', ')
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—'
  const d = phone.replace(/\D/g, '')
  if (d.length === 11) {
    return `+${d[0]} (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9)}`
  }
  return phone
}

/**
 * Приводит номер телефона к единому формату хранения `+7XXXXXXXXXX`.
 *
 * Правила: 11 цифр, начинающихся с 8 → заменяем на 7 (российская привычка
 * набирать номер с 8). 10 цифр без кода страны → добавляем 7 спереди.
 * Нероссийские/нестандартные номера сохраняются как есть с ведущим `+`.
 * Пустая строка/undefined/null → null (нечего сохранять).
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  const trimmed = phone.trim()
  if (!trimmed) return null

  let digits = trimmed.replace(/\D/g, '')
  if (!digits) return null

  if (digits.length === 11 && digits.startsWith('8')) {
    digits = `7${digits.slice(1)}`
  } else if (digits.length === 10) {
    digits = `7${digits}`
  }

  return `+${digits}`
}

/**
 * Type guard для списков идентификаторов.
 *
 * `.filter(Boolean)` не сужает `(string | null)[]` до `string[]` — TypeScript не
 * знает, что Boolean отбрасывает null, и результат нельзя передать в `.in()`.
 * Появилось после перехода на сгенерированные типы схемы: раньше всё было any.
 */
export function isId(value: string | null | undefined): value is string {
  return typeof value === 'string' && value !== ''
}

/**
 * Значение для `ilike` внутри `.or(...)` PostgREST.
 *
 * Условия в `or=` разделяются запятыми, поэтому пользовательский запрос
 * подставленный в шаблон голым — это не только «Ленина, 10» разъезжается на два
 * битых условия, но и способ дописать в фильтр свои условия (`x,role.eq.admin`).
 * Значение в двойных кавычках запятую переживает; сами кавычки и обратные слэши
 * из ввода убираем — внутри закавыченной строки они и ломают разбор.
 *
 * Жил в src/features/telegram/services/parsing.ts, пока не выяснилось, что то же
 * самое нужно поиску по CRM и внешнему API.
 */
export function likeFilterValue(raw: string): string {
  return `"%${raw.replace(/["\\]/g, ' ').trim()}%"`
}

/**
 * IP клиента за прокси Vercel.
 *
 * Нужен там, где запрос не авторизован и считать частоту больше не по чему:
 * публичная форма заявки, подписные фиды по секретному токену.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  return request.headers.get('x-real-ip')?.trim() || 'unknown'
}
