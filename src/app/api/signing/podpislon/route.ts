import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { resolveOrgByWebhookSecret } from '@/lib/communications/log'
import { readPodpislonApiKey } from '@/lib/podpislon/credentials'
import { syncPodpislonSignature, type SignatureRow } from '@/lib/podpislon/sync'

export const dynamic = 'force-dynamic'

// Обработчик событий Подпислона: /api/signing/podpislon?secret=<webhook_secret>
//
// Тело приходит как application/x-www-form-urlencoded:
//   EVENT=DOCUMENT_SIGNED&FILE_ID=1234&COMPANY_ID=12&SIGNATURE=...
//
// Поле SIGNATURE проверить нечем: алгоритм её вычисления сервис не публикует.
// Поэтому доверия к телу запроса нет вообще — оно работает только как сигнал
// «сходи посмотри». Настоящий статус берётся обратным запросом к API по
// ключу организации (lib/podpislon/sync), а сам адрес закрыт секретом, как у
// вебхука ЮKassa. Подделанный запрос в худшем случае вызовет лишний вызов API.

const HANDLED_EVENTS = new Set(['DOCUMENT_SIGNED', 'DOCUMENT_OPENED'])

export async function POST(request: Request) {
  const secret = new URL(request.url).searchParams.get('secret') ?? ''
  const integration = await resolveOrgByWebhookSecret(secret, 'signing')
  if (!integration) {
    return NextResponse.json({ ok: false, reason: 'invalid secret' }, { status: 401 })
  }

  // Сервис шлёт форму, но на всякий случай принимаем и JSON: смена формата
  // на стороне провайдера не должна ломать приём событий молча.
  const contentType = request.headers.get('content-type') ?? ''
  let payload: Record<string, string> = {}
  if (contentType.includes('application/json')) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    payload = Object.fromEntries(Object.entries(body).map(([k, v]) => [k, String(v)]))
  } else {
    const form = await request.formData().catch(() => null)
    if (form) payload = Object.fromEntries(Array.from(form.entries()).map(([k, v]) => [k, String(v)]))
  }

  const event = payload.EVENT ?? ''
  const fileId = payload.FILE_ID ?? ''

  if (!HANDLED_EVENTS.has(event)) {
    // CLIENT_DATA_REQUEST_SUBMITTED и прочие события к договорам не относятся —
    // отвечаем 200, иначе сервис будет считать обработчик сломанным.
    return NextResponse.json({ ok: true, skipped: event || 'no event' })
  }

  if (!fileId) return NextResponse.json({ ok: true, skipped: 'no file id' })

  const apiKey = readPodpislonApiKey(integration.credentials)
  if (!apiKey) {
    console.error('[podpislon] вебхук пришёл, но у организации нет API-ключа')
    return NextResponse.json({ ok: true, skipped: 'no api key' })
  }

  const supabase = getSupabaseAdmin()
  const { data: signature } = await supabase
    .from('contract_signatures')
    .select('id, contract_id, organization_id, status, external_id, external_package_id, sign_url, signed_document_url')
    .eq('organization_id', integration.orgId)
    .eq('provider', 'podpislon')
    .eq('external_id', fileId)
    .maybeSingle()

  if (!signature) {
    console.warn(`[podpislon] документ ${fileId} не найден среди запросов на подпись`)
    return NextResponse.json({ ok: true, skipped: 'signature not found' })
  }

  try {
    const result = await syncPodpislonSignature(supabase, apiKey, signature as SignatureRow)
    return NextResponse.json({ ok: true, status: result.status })
  } catch (e) {
    console.error('[podpislon] ошибка обработки вебхука:', e)
    // 500 заставит сервис повторить доставку — это то, что нужно при сбое сети.
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
