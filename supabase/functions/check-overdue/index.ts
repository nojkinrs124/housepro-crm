// Supabase Edge Function: проверка просроченных платежей и договоров
// Запускается по cron: каждый день в 9:00 МСК
// Настройка: supabase functions deploy check-overdue --no-verify-jwt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Обновляем просроченные платежи
  const { error: payError } = await supabase.rpc('check_overdue_payments')
  if (payError) console.error('check_overdue_payments error:', payError)

  // Уведомления об истекающих договорах
  const { error: conError } = await supabase.rpc('check_expiring_contracts')
  if (conError) console.error('check_expiring_contracts error:', conError)

  return new Response(JSON.stringify({
    ok: true,
    message: 'Overdue checks complete',
    timestamp: new Date().toISOString()
  }), { headers: { 'Content-Type': 'application/json' } })
})
