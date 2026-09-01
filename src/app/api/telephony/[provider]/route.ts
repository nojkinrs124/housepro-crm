import { NextResponse } from 'next/server'
import { logCommunication, resolveOrgByWebhookSecret } from '@/lib/communications/log'
import { describeCall, parseTelephonyPayload, TELEPHONY_PROVIDERS } from '@/lib/communications/telephony'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Приём событий АТС: /api/telephony/<provider>?secret=<webhook_secret>
//
// Организация определяется по секрету из настроек интеграции, а не по домену
// и не по «первой организации»: в SaaS у каждого агентства своя АТС, и звонок
// одного арендатора не должен попасть в ленту другого.
//
// Отвечаем 200 почти всегда: провайдеры считают любой не-2xx поводом для
// ретраев по нарастающей, а из-за неизвестного формата события терять
// соединение с АТС не стоит. Проблемы видны в логах и в поле reason ответа.

/** Провайдеры шлют то JSON, то form-urlencoded (Манго — ещё и полем json=). */
async function readPayload(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    return (await request.json().catch(() => ({}))) as Record<string, unknown>
  }

  const text = await request.text()
  if (text.trim().startsWith('{')) {
    try {
      return JSON.parse(text) as Record<string, unknown>
    } catch {
      return {}
    }
  }

  const params = new URLSearchParams(text)
  const raw = Object.fromEntries(params.entries()) as Record<string, unknown>

  // Манго Телеком кладёт полезную нагрузку в поле json.
  if (typeof raw.json === 'string') {
    try {
      return { ...raw, ...(JSON.parse(raw.json) as Record<string, unknown>) }
    } catch {
      return raw
    }
  }

  return raw
}

export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params

  if (!TELEPHONY_PROVIDERS.includes(provider as never)) {
    return NextResponse.json({ ok: false, reason: 'unknown provider' }, { status: 404 })
  }

  const secret =
    new URL(request.url).searchParams.get('secret') ??
    request.headers.get('x-housepro-secret') ??
    ''

  const integration = await resolveOrgByWebhookSecret(secret, 'telephony')
  if (!integration) {
    // Здесь 401 уместен: без валидного секрета это не «наш» вебхук вообще.
    return NextResponse.json({ ok: false, reason: 'invalid secret' }, { status: 401 })
  }

  const payload = await readPayload(request)
  const call = parseTelephonyPayload(provider, payload)

  if (!call) {
    console.warn(`[telephony:${provider}] событие без идентификатора звонка пропущено`)
    return NextResponse.json({ ok: true, skipped: 'no call id' })
  }

  // Сопоставляем внутренний номер с сотрудником, если он у нас записан.
  let userId: string | null = null
  if (call.agentExtension) {
    const supabase = getSupabaseAdmin()
    const { data: employee } = await supabase
      .from('users')
      .select('id')
      .eq('organization_id', integration.orgId)
      .eq('phone_extension', call.agentExtension)
      .maybeSingle()
    userId = employee?.id ?? null
  }

  await logCommunication({
    orgId: integration.orgId,
    channel: 'call',
    direction: call.direction,
    counterpartyPhone: call.counterpartyPhone,
    fromNumber: call.fromNumber,
    toNumber: call.toNumber,
    occurredAt: call.occurredAt,
    durationSec: call.durationSec,
    status: call.status,
    subject: describeCall(call),
    recordingUrl: call.recordingUrl,
    provider,
    externalId: call.externalId,
    userId,
  })

  return NextResponse.json({ ok: true })
}

// Некоторые провайдеры проверяют доступность адреса GET-запросом перед
// сохранением настроек — отвечаем, что адрес живой.
export async function GET() {
  return NextResponse.json({ ok: true, service: 'housepro-telephony-webhook' })
}
