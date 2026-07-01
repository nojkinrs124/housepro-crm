import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'

export async function dispatchWebhook(
  orgId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { global: { fetch: (url, options = {}) => fetch(url, { ...options, cache: 'no-store' }) } }
    )

    const { data: endpoints } = await supabase
      .from('webhook_endpoints')
      .select('url, secret')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .contains('events', [event])

    if (!endpoints?.length) return

    const body = JSON.stringify({ event, data: payload, timestamp: Date.now() })

    await Promise.allSettled(
      endpoints.map(async (ep) => {
        const sig = createHmac('sha256', ep.secret).update(body).digest('hex')
        await fetch(ep.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-HousePro-Signature': `sha256=${sig}` },
          body,
          signal: AbortSignal.timeout(5000),
        })
      })
    )
  } catch (e) {
    // Webhook ошибки не должны ломать основной флоу
    console.error('[webhook] dispatch error:', e)
  }
}
