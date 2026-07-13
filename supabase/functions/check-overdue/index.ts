// Supabase Edge Function: проверка просроченных платежей и договоров
// Запускается по cron: каждый день в 9:00 МСК
// Настройка: supabase functions deploy check-overdue --no-verify-jwt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const runStartedAt = new Date().toISOString()

  // Обновляем просроченные платежи
  const { error: payError } = await supabase.rpc('check_overdue_payments')
  if (payError) console.error('check_overdue_payments error:', payError)

  // Уведомления об истекающих договорах
  const { error: conError } = await supabase.rpc('check_expiring_contracts')
  if (conError) console.error('check_expiring_contracts error:', conError)

  // Собираем сводку из notifications, реально созданных в этом запуске (ON CONFLICT DO NOTHING
  // в RPC-функциях означает, что повторно уже существующие уведомления не попадут сюда снова —
  // сводка в Telegram не будет дублироваться день за днём).
  const { data: freshNotifications } = await supabase
    .from('notifications')
    .select('type, body')
    .in('type', ['overdue_payment', 'contract_expiry'])
    .gte('created_at', runStartedAt)

  await sendTelegramSummary(freshNotifications ?? [])

  return new Response(JSON.stringify({
    ok: true,
    message: 'Overdue checks complete',
    notified: freshNotifications?.length ?? 0,
    timestamp: new Date().toISOString()
  }), { headers: { 'Content-Type': 'application/json' } })
})

async function sendTelegramSummary(notifications: { type: string; body: string }[]) {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN')
  const chatId = Deno.env.get('TELEGRAM_NOTIFY_CHAT_ID')
  if (!token || !chatId) {
    console.log('TELEGRAM_BOT_TOKEN/TELEGRAM_NOTIFY_CHAT_ID не заданы в secrets — пропускаю отправку')
    return
  }
  if (notifications.length === 0) return // нет новых просрочек/истечений — не шлём пустую сводку

  const overdue = notifications.filter((n) => n.type === 'overdue_payment')
  const expiring = notifications.filter((n) => n.type === 'contract_expiry')

  let text = '📊 <b>Ежедневная сводка HousePro</b>\n\n'
  if (overdue.length > 0) {
    text += `⚠️ Просроченные платежи (${overdue.length}):\n` + overdue.map((n) => `• ${n.body}`).join('\n') + '\n\n'
  }
  if (expiring.length > 0) {
    text += `⏳ Истекающие договоры (${expiring.length}):\n` + expiring.map((n) => `• ${n.body}`).join('\n')
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })
    if (!res.ok) console.error('Telegram sendMessage failed:', await res.text())
  } catch (e) {
    console.error('Telegram sendMessage error:', e)
  }
}
