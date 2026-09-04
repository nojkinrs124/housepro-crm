import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

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
  return d.toLocaleDateString('ru-RU', opts)
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

/** Компактная дата без года, если год текущий: `18.09` / `18.09.2025`. */
export function formatDateCompact(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = new Date(date)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString('ru-RU',
    sameYear ? { day: '2-digit', month: '2-digit' } : { day: '2-digit', month: '2-digit', year: 'numeric' })
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
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * Насколько дедлайн просрочен или сколько до него осталось.
 * `overdue` = true → в интерфейсе строка красится в --hp-danger.
 */
export function formatDeadline(date: string | null | undefined): { label: string; overdue: boolean } | null {
  if (!date) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = new Date(date); due.setHours(0, 0, 0, 0)
  const days = Math.round((due.getTime() - today.getTime()) / 86400000)
  if (days < 0)  return { label: `просрочено ${pluralDays(-days)}`, overdue: true }
  if (days === 0) return { label: 'сегодня', overdue: true }
  if (days === 1) return { label: 'завтра', overdue: false }
  return { label: `до ${formatDateCompact(date)}`, overdue: false }
}

function pluralDays(n: number): string {
  const mod10 = n % 10, mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return `${n} день`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} дн.`
  return `${n} дн.`
}

/** Инициалы для аватара: «Анна Петрова» → «АП». */
export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase()
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
