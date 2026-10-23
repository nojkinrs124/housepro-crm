import { createHmac, randomUUID } from 'crypto'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

/**
 * Фаза 3 аудита (3.2): раньше вебхук отправлялся fire-and-forget — без `await`,
 * без журнала доставок, без ретраев, без ключа идемпотентности. В serverless
 * runtime функция может завершиться раньше, чем `fetch()` долетит до адресата
 * — событие пропадает без следа, и это нигде не видно.
 *
 * Теперь: каждая попытка записывается в `webhook_deliveries` ДО отправки
 * (жив даже если runtime оборвётся на самом fetch), отправка идёт с `await`,
 * неудача оставляет строку `pending` с `next_attempt_at` в будущем — её
 * подхватит `retryFailedWebhookDeliveries()` по крону. `idempotency_key`
 * уходит в заголовке, чтобы повторная доставка после ретрая не создавала
 * вторую операцию на стороне получателя.
 */

const MAX_ATTEMPTS = 6
/** Экспоненциальная задержка: 1м, 5м, 15м, 1ч, 4ч, 12ч. */
const BACKOFF_MINUTES = [1, 5, 15, 60, 240, 720]

function backoffMinutes(attempt: number): number {
  return BACKOFF_MINUTES[Math.min(attempt, BACKOFF_MINUTES.length - 1)]
}

interface PendingDelivery {
  id: string
  organization_id: string
  endpoint_id: string
  event: string
  idempotency_key: string
  payload: Record<string, unknown>
  attempts: number
  webhook_endpoints: { url: string; secret: string; is_active: boolean } | null
}

async function sendOne(url: string, secret: string, body: string, idempotencyKey: string): Promise<void> {
  const sig = createHmac('sha256', secret).update(body).digest('hex')
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-HousePro-Signature': `sha256=${sig}`,
      'X-HousePro-Idempotency-Key': idempotencyKey,
    },
    body,
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
}

/**
 * Поставить событие в очередь доставки на все подписанные эндпоинты организации
 * и сразу попытаться отправить. Вызывающий код должен делать `await` — раньше
 * вызывался без него, и Vercel мог прибить функцию до завершения `fetch()`.
 */
export async function dispatchWebhook(
  orgId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
  const supabase = getSupabaseAdmin()

  const { data: endpoints } = await supabase
    .from('webhook_endpoints')
    .select('id, url, secret')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .contains('events', [event])

  if (!endpoints?.length) return

  const rows = endpoints.map(ep => ({
    organization_id: orgId,
    endpoint_id: ep.id,
    event,
    idempotency_key: randomUUID(),
    payload,
  }))

  const { data: inserted, error: insertError } = await supabase
    .from('webhook_deliveries')
    .insert(rows)
    .select('id, endpoint_id, idempotency_key')

  if (insertError || !inserted) {
    console.error('[webhook] journal insert error:', insertError?.message)
    return
  }

  const byEndpoint = new Map(endpoints.map(ep => [ep.id, ep]))

  await Promise.allSettled(
    inserted.map(async row => {
      const ep = byEndpoint.get(row.endpoint_id)
      if (!ep) return
      const body = JSON.stringify({ event, data: payload, timestamp: Date.now() })
      try {
        await sendOne(ep.url, ep.secret, body, row.idempotency_key)
        await supabase.from('webhook_deliveries').update({
          status: 'delivered', delivered_at: new Date().toISOString(), attempts: 1,
        }).eq('id', row.id)
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        const nextAttemptAt = new Date(Date.now() + backoffMinutes(0) * 60_000).toISOString()
        await supabase.from('webhook_deliveries').update({
          attempts: 1, last_error: message, next_attempt_at: nextAttemptAt,
        }).eq('id', row.id)
      }
    })
  )
  } catch (e) {
    // Вебхуки не должны ломать основную операцию, если интеграция недоступна.
    console.error('[webhook] dispatch error:', e)
  }
}

/**
 * Ретрай неудачных доставок — вызывается кроном `/api/cron/webhook-retry`.
 * Берёт строки `status='pending'` с `next_attempt_at <= now()`, пробует снова;
 * после `MAX_ATTEMPTS` помечает `failed` окончательно (видно в журнале).
 */
export async function retryFailedWebhookDeliveries(): Promise<{ retried: number; delivered: number; failed: number }> {
  const supabase = getSupabaseAdmin()

  const { data: pending } = await supabase
    .from('webhook_deliveries')
    .select('id, organization_id, endpoint_id, event, idempotency_key, payload, attempts, webhook_endpoints(url, secret, is_active)')
    .eq('status', 'pending')
    .lte('next_attempt_at', new Date().toISOString())
    .limit(200)

  const rows = (pending ?? []) as unknown as PendingDelivery[]
  let delivered = 0
  let failed = 0

  await Promise.allSettled(
    rows.map(async row => {
      const ep = row.webhook_endpoints
      if (!ep || !ep.is_active) {
        await supabase.from('webhook_deliveries').update({ status: 'failed', last_error: 'endpoint inactive or deleted' }).eq('id', row.id)
        failed++
        return
      }
      const body = JSON.stringify({ event: row.event, data: row.payload, timestamp: Date.now() })
      const attempt = row.attempts + 1
      try {
        await sendOne(ep.url, ep.secret, body, row.idempotency_key)
        await supabase.from('webhook_deliveries').update({
          status: 'delivered', delivered_at: new Date().toISOString(), attempts: attempt,
        }).eq('id', row.id)
        delivered++
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        if (attempt >= MAX_ATTEMPTS) {
          await supabase.from('webhook_deliveries').update({ status: 'failed', attempts: attempt, last_error: message }).eq('id', row.id)
          failed++
        } else {
          const nextAttemptAt = new Date(Date.now() + backoffMinutes(attempt) * 60_000).toISOString()
          await supabase.from('webhook_deliveries').update({ attempts: attempt, last_error: message, next_attempt_at: nextAttemptAt }).eq('id', row.id)
        }
      }
    })
  )

  return { retried: rows.length, delivered, failed }
}
