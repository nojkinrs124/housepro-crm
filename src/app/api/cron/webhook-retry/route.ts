import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'
import { retryFailedWebhookDeliveries } from '@/lib/webhooks'

export const dynamic = 'force-dynamic'

// Ретрай неудачных доставок вебхуков (фаза 3 аудита, 3.2). Вызывается pg_cron
// каждые 5 минут через public.call_vercel_cron — так же, как channel-heartbeat
// и avito-messenger (миграция 20260915080224_pg_cron_frequent_jobs.sql), не через
// vercel.json: там крон не чаще раза в сутки на Hobby-плане.
export async function GET(request: Request) {
  if (!(await isCronAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await retryFailedWebhookDeliveries()
  return NextResponse.json(result)
}
