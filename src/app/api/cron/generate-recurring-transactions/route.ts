import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { generateDueRecurringTransactions } from '@/features/accounting/services/recurring.service'

export const dynamic = 'force-dynamic'

// Запускается раз в день (см. vercel.json). Admin-клиент обходит RLS и обрабатывает
// периодические правила (аренда офиса, зарплаты, подписки) сразу всех организаций —
// каждая транзакция создаётся со своим organization_id из строки правила.
export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = getSupabaseAdmin()
  const result = await generateDueRecurringTransactions(supabaseAdmin)

  return NextResponse.json(result)
}
