import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { generateDueRecurringTransactions } from '@/features/accounting/services/recurring.service'
import { createPreliminaryDeadlineTasks } from '@/features/directions/services/deadline-reminders'
import { generateRegulationTasks } from '@/features/management/data/regulation.data'

export const dynamic = 'force-dynamic'

// Запускается раз в день (см. vercel.json). Admin-клиент обходит RLS и обрабатывает
// периодические правила (аренда офиса, зарплаты, подписки) сразу всех организаций —
// каждая транзакция создаётся со своим organization_id из строки правила.
//
// Здесь же — напоминания о сроке выхода на основную сделку. Отдельный крон не
// заводится: на тарифе Hobby частота ограничена, и лишнее задание в vercel.json
// приводит к тому, что Vercel МОЛЧА отбрасывает весь деплой (см. scripts/checks/vercel-cron.mjs).
export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = getSupabaseAdmin()
  const result = await generateDueRecurringTransactions(supabaseAdmin)
  const deadlines = await createPreliminaryDeadlineTasks(supabaseAdmin)
  // Регламент обслуживания: показания, сбор оплаты, выплата собственнику,
  // проверки объекта, окончание договора найма — по правилам тарифа.
  const regulation = await generateRegulationTasks(supabaseAdmin)

  return NextResponse.json({ ...result, preliminaryDeadlines: deadlines, regulation })
}
