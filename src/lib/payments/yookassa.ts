// Клиент ЮKassa (api.yookassa.ru) — приём оплат от арендаторов и клиентов.
//
// Это платежи клиентов агентства. Подписки на саму CRM в проекте больше нет —
// за подписку на CRM, а ЮKassa — деньги с клиентов агентства за аренду и
// услуги. Это разные потоки, разные получатели и разные учётные данные.

const API_BASE = 'https://api.yookassa.ru/v3'

export interface YookassaCredentials {
  shopId: string
  secretKey: string
}

export interface CreatedPayment {
  id: string
  status: string
  confirmationUrl: string | null
}

export class YookassaError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message)
    this.name = 'YookassaError'
  }
}

function authHeader(credentials: YookassaCredentials): string {
  return `Basic ${Buffer.from(`${credentials.shopId}:${credentials.secretKey}`).toString('base64')}`
}

export function hasYookassaCredentials(raw: Record<string, unknown> | null | undefined): raw is Record<string, string> {
  return Boolean(raw && typeof raw.shopId === 'string' && typeof raw.secretKey === 'string' && raw.shopId && raw.secretKey)
}

/**
 * Создаёт платёж и возвращает ссылку для оплаты.
 *
 * idempotenceKey обязателен по требованиям API: без него повторная отправка
 * запроса (ретрай, двойной клик) создала бы второй платёж на ту же сумму.
 * Используем id начисления — на одно начисление один платёж.
 */
export async function createYookassaPayment(params: {
  credentials: YookassaCredentials
  amount: number
  description: string
  returnUrl: string
  idempotenceKey: string
  metadata?: Record<string, string>
  /** Email или телефон плательщика — нужен для чека по 54-ФЗ. */
  customerEmail?: string | null
  customerPhone?: string | null
}): Promise<CreatedPayment> {
  const body: Record<string, unknown> = {
    amount: { value: params.amount.toFixed(2), currency: 'RUB' },
    capture: true,
    confirmation: { type: 'redirect', return_url: params.returnUrl },
    description: params.description.slice(0, 128),
    metadata: params.metadata ?? {},
  }

  // Чек формируется на стороне ЮKassa, только если у магазина подключена
  // онлайн-касса. Без контактов плательщика чек выпустить нельзя, поэтому
  // блок receipt добавляем лишь когда есть куда его отправить.
  if (params.customerEmail || params.customerPhone) {
    body.receipt = {
      customer: {
        ...(params.customerEmail ? { email: params.customerEmail } : {}),
        ...(params.customerPhone ? { phone: params.customerPhone.replace(/\D/g, '') } : {}),
      },
      items: [
        {
          description: params.description.slice(0, 128),
          quantity: '1.00',
          amount: { value: params.amount.toFixed(2), currency: 'RUB' },
          vat_code: 1,
          payment_mode: 'full_payment',
          payment_subject: 'service',
        },
      ],
    }
  }

  const res = await fetch(`${API_BASE}/payments`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(params.credentials),
      'Idempotence-Key': params.idempotenceKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const payload = (await res.json().catch(() => ({}))) as {
    id?: string
    status?: string
    confirmation?: { confirmation_url?: string }
    description?: string
  }

  if (!res.ok || !payload.id) {
    throw new YookassaError(payload.description ?? `ЮKassa вернула ${res.status}`, res.status)
  }

  return {
    id: payload.id,
    status: payload.status ?? 'pending',
    confirmationUrl: payload.confirmation?.confirmation_url ?? null,
  }
}

export interface WebhookEvent {
  event: string
  paymentId: string
  status: string
  amount: number | null
  metadata: Record<string, string>
  paidAt: string | null
}

/** Разбирает уведомление ЮKassa. Возвращает null, если это не платёжное событие. */
export function parseYookassaWebhook(payload: Record<string, unknown>): WebhookEvent | null {
  const event = typeof payload.event === 'string' ? payload.event : null
  const object = (payload.object ?? {}) as Record<string, unknown>
  const paymentId = typeof object.id === 'string' ? object.id : null

  if (!event || !paymentId) return null

  const amountRaw = (object.amount ?? {}) as Record<string, unknown>
  const amount = Number.parseFloat(String(amountRaw.value ?? ''))

  return {
    event,
    paymentId,
    status: typeof object.status === 'string' ? object.status : 'unknown',
    amount: Number.isFinite(amount) ? amount : null,
    metadata: (object.metadata ?? {}) as Record<string, string>,
    paidAt: typeof object.captured_at === 'string' ? object.captured_at : null,
  }
}

/**
 * Проверяет платёж напрямую у ЮKassa.
 *
 * Уведомление приходит незаверенным (подписи у ЮKassa нет — рекомендуется
 * проверять IP или перезапрашивать платёж), поэтому перед списанием статуса
 * в CRM подтверждаем его отдельным запросом к API.
 */
export async function fetchYookassaPayment(
  credentials: YookassaCredentials,
  paymentId: string
): Promise<{ status: string; paid: boolean; amount: number | null } | null> {
  const res = await fetch(`${API_BASE}/payments/${paymentId}`, {
    headers: { Authorization: authHeader(credentials) },
  })

  if (!res.ok) return null

  const payload = (await res.json().catch(() => ({}))) as {
    status?: string
    paid?: boolean
    amount?: { value?: string }
  }

  const amount = Number.parseFloat(String(payload.amount?.value ?? ''))
  return {
    status: payload.status ?? 'unknown',
    paid: payload.paid === true,
    amount: Number.isFinite(amount) ? amount : null,
  }
}
