import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { resolveOrgByWebhookSecret } from '@/lib/communications/log'
import {
  fetchYookassaPayment,
  hasYookassaCredentials,
  parseYookassaWebhook,
} from '@/lib/payments/yookassa'
import { advanceDealStage } from '@/lib/deal-automation'

export const dynamic = 'force-dynamic'

// Уведомления ЮKassa: /api/payments/yookassa?secret=<webhook_secret>
//
// У ЮKassa нет подписи уведомлений — рекомендуется либо сверять IP, либо
// перезапрашивать платёж по API. Делаем и то и другое по-своему: адрес закрыт
// секретом организации, а статус перед изменением подтверждается прямым
// запросом к API. Без этой проверки любой, кто узнал адрес, мог бы пометить
// чужие начисления оплаченными.

export async function POST(request: Request) {
  const secret = new URL(request.url).searchParams.get('secret') ?? ''
  const integration = await resolveOrgByWebhookSecret(secret, 'payments')
  if (!integration) {
    return NextResponse.json({ ok: false, reason: 'invalid secret' }, { status: 401 })
  }

  const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const event = parseYookassaWebhook(payload)
  if (!event) return NextResponse.json({ ok: true, skipped: 'not a payment event' })

  // Интересует только успешная оплата: waiting_for_capture и pending
  // ничего не меняют в учёте, а отменённый платёж просто оставляет начисление
  // неоплаченным — им займётся напоминание.
  if (event.event !== 'payment.succeeded') {
    return NextResponse.json({ ok: true, skipped: event.event })
  }

  if (!hasYookassaCredentials(integration.credentials)) {
    console.error('[payments:yookassa] у организации нет учётных данных для проверки платежа')
    return NextResponse.json({ ok: true, skipped: 'no credentials' })
  }

  const confirmed = await fetchYookassaPayment(
    { shopId: integration.credentials.shopId, secretKey: integration.credentials.secretKey },
    event.paymentId
  )

  if (!confirmed?.paid) {
    console.warn(`[payments:yookassa] платёж ${event.paymentId} не подтверждён API — пропускаем`)
    return NextResponse.json({ ok: true, skipped: 'not confirmed' })
  }

  const supabase = getSupabaseAdmin()

  // Находим начисление по внешнему id платежа; metadata — запасной путь
  // на случай, если ссылка была создана вне CRM.
  const { data: tx } = await supabase
    .from('accounting_transactions')
    .select('id, status, contract_id, deal_id, organization_id')
    .eq('organization_id', integration.orgId)
    .or(`payment_external_id.eq.${event.paymentId},id.eq.${event.metadata.transaction_id ?? event.paymentId}`)
    .maybeSingle()

  if (!tx) {
    console.warn(`[payments:yookassa] начисление для платежа ${event.paymentId} не найдено`)
    return NextResponse.json({ ok: true, skipped: 'transaction not found' })
  }

  if (tx.status === 'completed') return NextResponse.json({ ok: true, skipped: 'already paid' })

  const paidAt = event.paidAt ?? new Date().toISOString()
  const { error } = await supabase
    .from('accounting_transactions')
    .update({
      status: 'completed',
      paid_at: paidAt,
      date: paidAt.slice(0, 10),
      payment_method: 'card',
      payment_external_id: event.paymentId,
      payment_provider: 'yookassa',
    })
    .eq('id', tx.id)

  if (error) {
    // Здесь 500 уместен: ЮKassa повторит уведомление, и оплата не потеряется.
    console.error('[payments:yookassa] не удалось обновить начисление:', error.message)
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  // Та же автоматизация, что и при ручной отметке оплаты: сделка едет
  // на «Завершено» вслед за деньгами.
  if (tx.deal_id) {
    await advanceDealStage(supabase, tx.deal_id, 'completed')
  }

  return NextResponse.json({ ok: true })
}
