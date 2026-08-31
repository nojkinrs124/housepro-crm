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
  return new Date(date).toLocaleDateString('ru-RU', opts)
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
