// Тонкий клиент к почтовым провайдерам. Никаких npm-зависимостей: у всех
// поддерживаемых сервисов есть REST API, а nodemailer/SMTP тянул бы за собой
// node-only модули, которые ломают edge-рантайм Next.js.
//
// Провайдер выбирается переменной EMAIL_PROVIDER, либо автоматически по тому,
// какой ключ задан в окружении. Если ключей нет — режим 'log': письмо не уходит,
// а пишется в консоль и в email_log со статусом 'skipped'. Так локальная разработка
// и CI не падают из-за ненастроенной почты (тот же принцип, что у Telegram-токена).

export type EmailProviderName = 'resend' | 'unisender' | 'log'

export interface EmailMessage {
  to: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
  attachments?: EmailAttachment[]
}

export interface EmailAttachment {
  filename: string
  /** Содержимое в base64 — единый формат для всех провайдеров. */
  content: string
  contentType?: string
}

export interface EmailSendResult {
  ok: boolean
  provider: EmailProviderName
  messageId?: string
  error?: string
  skipped?: boolean
}

export class EmailError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message)
    this.name = 'EmailError'
  }
}

export function resolveProvider(): EmailProviderName {
  const explicit = process.env.EMAIL_PROVIDER?.trim().toLowerCase()
  if (explicit === 'resend' || explicit === 'unisender' || explicit === 'log') return explicit
  if (process.env.RESEND_API_KEY) return 'resend'
  if (process.env.UNISENDER_API_KEY) return 'unisender'
  return 'log'
}

/** Отправитель в формате "Имя <адрес>". Имя можно переопределить на организацию. */
export function fromAddress(displayName?: string): string {
  const email = process.env.EMAIL_FROM?.trim() || 'noreply@housepro24.ru'
  const name = (displayName ?? process.env.EMAIL_FROM_NAME ?? 'HousePro CRM').replace(/["<>]/g, '')
  return `${name} <${email}>`
}

function toList(to: string | string[]): string[] {
  return (Array.isArray(to) ? to : [to]).map((a) => a.trim()).filter(Boolean)
}

/** Грубый, но достаточный фильтр: письма на битый адрес не должны уходить в провайдера. */
export function isValidEmail(value: string | null | undefined): value is string {
  if (!value) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
}

async function sendViaResend(msg: EmailMessage, from: string): Promise<EmailSendResult> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: toList(msg.to),
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      reply_to: msg.replyTo,
      attachments: msg.attachments?.map((a) => ({ filename: a.filename, content: a.content })),
    }),
  })

  const payload = (await res.json().catch(() => ({}))) as { id?: string; message?: string }
  if (!res.ok) throw new EmailError(payload.message ?? `Resend вернул ${res.status}`, res.status)
  return { ok: true, provider: 'resend', messageId: payload.id }
}

async function sendViaUnisender(msg: EmailMessage, from: string): Promise<EmailSendResult> {
  // Unisender Go: адрес отправителя нужен отдельными полями, не строкой "Имя <адрес>".
  const match = from.match(/^(.*)<(.+)>$/)
  const fromName = match ? match[1].trim() : 'HousePro CRM'
  const fromEmail = match ? match[2].trim() : from

  const res = await fetch('https://go1.unisender.ru/ru/transactional/api/v1/email/send.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-KEY': process.env.UNISENDER_API_KEY ?? '' },
    body: JSON.stringify({
      message: {
        recipients: toList(msg.to).map((email) => ({ email })),
        body: { html: msg.html, plaintext: msg.text },
        subject: msg.subject,
        from_email: fromEmail,
        from_name: fromName,
        reply_to: msg.replyTo,
        attachments: msg.attachments?.map((a) => ({
          type: a.contentType ?? 'application/octet-stream',
          name: a.filename,
          content: a.content,
        })),
      },
    }),
  })

  const payload = (await res.json().catch(() => ({}))) as {
    status?: string
    job_id?: string
    failed_emails?: Record<string, string>
    message?: string
  }
  if (!res.ok || payload.status === 'error') {
    throw new EmailError(payload.message ?? `Unisender вернул ${res.status}`, res.status)
  }
  return { ok: true, provider: 'unisender', messageId: payload.job_id }
}

/**
 * Низкоуровневая отправка без журналирования. В прикладном коде использовать
 * sendEmail() из ./send.ts — он пишет в email_log и знает про организацию.
 */
export async function dispatchEmail(msg: EmailMessage, opts?: { fromName?: string }): Promise<EmailSendResult> {
  const provider = resolveProvider()
  const recipients = toList(msg.to).filter(isValidEmail)

  if (recipients.length === 0) {
    return { ok: false, provider, skipped: true, error: 'Нет валидных адресов получателя' }
  }

  if (provider === 'log') {
    console.info(`[email:log] → ${recipients.join(', ')} — ${msg.subject}`)
    return { ok: true, provider: 'log', skipped: true }
  }

  const from = fromAddress(opts?.fromName)
  const payload: EmailMessage = { ...msg, to: recipients }

  try {
    return provider === 'resend' ? await sendViaResend(payload, from) : await sendViaUnisender(payload, from)
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    console.error('[email] ошибка отправки:', error)
    return { ok: false, provider, error }
  }
}
