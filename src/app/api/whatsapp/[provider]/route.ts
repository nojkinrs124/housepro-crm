import { NextResponse } from 'next/server'
import { logCommunication, resolveOrgByWebhookSecret } from '@/lib/communications/log'
import { parseWhatsappPayload, WHATSAPP_PROVIDERS } from '@/lib/communications/whatsapp'

export const dynamic = 'force-dynamic'

// Входящие сообщения WhatsApp: /api/whatsapp/<provider>?secret=<webhook_secret>
//
// Как и у телефонии, организация определяется секретом интеграции. Шлюзы
// ретраят доставку до 2xx, поэтому на неизвестные типы событий отвечаем 200
// с пометкой skipped, а не ошибкой.

export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params

  if (!WHATSAPP_PROVIDERS.includes(provider as never)) {
    return NextResponse.json({ ok: false, reason: 'unknown provider' }, { status: 404 })
  }

  const secret =
    new URL(request.url).searchParams.get('secret') ??
    request.headers.get('x-housepro-secret') ??
    ''

  const integration = await resolveOrgByWebhookSecret(secret, 'whatsapp')
  if (!integration) {
    return NextResponse.json({ ok: false, reason: 'invalid secret' }, { status: 401 })
  }

  const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const messages = parseWhatsappPayload(provider, payload)

  if (messages.length === 0) {
    return NextResponse.json({ ok: true, skipped: 'no messages in payload' })
  }

  for (const message of messages) {
    await logCommunication({
      orgId: integration.orgId,
      channel: 'whatsapp',
      direction: message.direction,
      counterpartyPhone: message.counterpartyPhone,
      occurredAt: message.occurredAt,
      status: message.status,
      subject: message.senderName,
      body: message.text ?? (message.attachmentUrl ? 'Вложение' : null),
      recordingUrl: message.attachmentUrl,
      provider,
      externalId: message.externalId,
    })
  }

  return NextResponse.json({ ok: true, received: messages.length })
}

export async function GET() {
  return NextResponse.json({ ok: true, service: 'housepro-whatsapp-webhook' })
}
