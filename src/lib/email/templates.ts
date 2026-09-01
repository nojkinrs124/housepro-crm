// HTML-шаблоны писем.
//
// ВАЖНО про дизайн-систему: здесь единственное место в проекте, где цвета «Кабинета»
// захардкожены хексами, а не взяты из var(--hp-*). Это не отклонение от стандарта —
// почтовые клиенты (Outlook, Mail.ru, Яндекс.Почта) не поддерживают CSS-переменные
// и внешние стили, вёрстка обязана быть таблицами с inline-стилями. Значения ниже
// синхронизированы с :root в globals.css; при смене палитры править и здесь.

const INK = '#232A24'
const SUB = '#5C6659'
const BG = '#EEF0E9'
const SURFACE = '#FBFBF8'
const BORDER = '#DFE4D6'
const ACCENT = '#4B6B46'
const DANGER = '#A24B30'

export interface EmailLayoutOptions {
  /** Название агентства в шапке письма. */
  companyName?: string
  /** Подпись внизу: телефон/сайт агентства. */
  footerNote?: string
  /** Ссылка-кнопка под текстом. */
  cta?: { label: string; url: string }
  /** Акцент шапки: обычный или тревожный (просрочка). */
  tone?: 'normal' | 'alert'
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Строка «лейбл — значение» внутри письма, визуальный аналог .hp-block-row. */
export function row(label: string, value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return ''
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid ${BORDER};color:${SUB};font-size:13px;">${escapeHtml(label)}</td>
    <td style="padding:10px 0;border-bottom:1px solid ${BORDER};color:${INK};font-size:14px;font-weight:600;text-align:right;">${escapeHtml(String(value))}</td>
  </tr>`
}

export function rows(pairs: Array<[string, string | number | null | undefined]>): string {
  const body = pairs.map(([label, value]) => row(label, value)).join('')
  if (!body) return ''
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:16px 0;">${body}</table>`
}

/**
 * Общий каркас письма. Ширина 560px, таблицы, никаких flex/grid —
 * то, что одинаково рендерится в Outlook и в мобильной Яндекс.Почте.
 */
export function layout(title: string, bodyHtml: string, opts: EmailLayoutOptions = {}): string {
  const headline = opts.tone === 'alert' ? DANGER : INK
  const cta = opts.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
        <tr><td style="background:${ACCENT};">
          <a href="${escapeHtml(opts.cta.url)}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">${escapeHtml(opts.cta.label)}</a>
        </td></tr>
      </table>`
    : ''

  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:${BG};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:100%;background:${SURFACE};border:1px solid ${BORDER};">
        <tr><td style="padding:24px 28px 0;">
          <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${SUB};font-weight:700;">${escapeHtml(opts.companyName ?? 'HousePro CRM')}</div>
          <h1 style="margin:12px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.25;color:${headline};font-weight:700;">${escapeHtml(title)}</h1>
        </td></tr>
        <tr><td style="padding:16px 28px 28px;font-family:-apple-system,'Segoe UI',Arial,sans-serif;font-size:14px;line-height:1.6;color:${INK};">
          ${bodyHtml}
          ${cta}
        </td></tr>
        <tr><td style="padding:16px 28px;border-top:1px solid ${BORDER};color:${SUB};font-family:-apple-system,'Segoe UI',Arial,sans-serif;font-size:12px;line-height:1.5;">
          ${opts.footerNote ? `${escapeHtml(opts.footerNote)}<br>` : ''}
          Письмо отправлено автоматически из CRM — отвечать на него не нужно.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

/** Абзац текста письма. */
export function p(text: string): string {
  return `<p style="margin:0 0 12px;">${escapeHtml(text)}</p>`
}

/** Маркированный список. */
export function ul(items: string[]): string {
  if (items.length === 0) return ''
  const li = items.map((i) => `<li style="margin:0 0 6px;">${escapeHtml(i)}</li>`).join('')
  return `<ul style="margin:0 0 12px;padding-left:20px;">${li}</ul>`
}

/** Plain-text версия: обязательна, без неё письмо чаще уезжает в спам. */
export function toPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h1|h2)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function formatMoney(amount: number | string | null | undefined): string {
  const n = Number(amount ?? 0)
  return `${n.toLocaleString('ru-RU')} ₽`
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
