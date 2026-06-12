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
