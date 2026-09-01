import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { sendPaymentOverdueEmail, sendPaymentReminderEmail } from '@/lib/email/send'
import { isValidEmail } from '@/lib/email/provider'

export const dynamic = 'force-dynamic'

// Ежедневные письма по начислениям: напоминание за N дней до срока и уведомление
// о просрочке. В отличие от /api/cron/daily-digest (он пишет одному админу в Telegram
// по одной организации) этот крон идёт по ВСЕМ активным организациям — это SaaS,
// у каждого арендатора свои договоры и свои клиенты.
//
// Источник данных — accounting_transactions (type='income', status='planned'), а не
// legacy-таблица payments: именно туда пишет весь модуль бухгалтерии.
//
// Дедупликация — через reminder_sent_at / overdue_notified_at: без них клиент
// получал бы одно и то же письмо каждое утро до самой оплаты.

const REMIND_DAYS_BEFORE = 3
/** Повторное письмо о просрочке — не чаще раза в неделю. */
const OVERDUE_REPEAT_DAYS = 7
/** Предохранитель: не рассылать по договорам, закрытым много месяцев назад. */
const MAX_OVERDUE_DAYS = 180

interface TxRow {
  id: string
  amount: number
  due_date: string | null
  date: string
  organization_id: string
  reminder_sent_at: string | null
  overdue_notified_at: string | null
  contracts: {
    contract_number: string | null
    status: string | null
    properties: { address: string | null } | null
    contacts: { email: string | null; full_name: string | null } | null
  } | null
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

function olderThan(iso: string | null, days: number): boolean {
  if (!iso) return true
  return daysBetween(new Date(iso), new Date()) >= days
}

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  const querySecret = new URL(request.url).searchParams.get('secret')
  const ok =
    process.env.CRON_SECRET &&
    (auth === `Bearer ${process.env.CRON_SECRET}` || querySecret === process.env.CRON_SECRET)
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabaseAdmin()
  const today = new Date()
  const horizon = new Date(today)
  horizon.setDate(horizon.getDate() + REMIND_DAYS_BEFORE)
  const floor = new Date(today)
  floor.setDate(floor.getDate() - MAX_OVERDUE_DAYS)

  const { data, error } = await supabase
    .from('accounting_transactions')
    .select(
      `id, amount, due_date, date, organization_id, reminder_sent_at, overdue_notified_at,
       contracts:contract_id (
         contract_number, status,
         properties:property_id ( address ),
         contacts:client_contact_id ( email, full_name )
       )`
    )
    .eq('type', 'income')
    .eq('status', 'planned')
    .not('contract_id', 'is', null)
    .not('due_date', 'is', null)
    .lte('due_date', horizon.toISOString().slice(0, 10))
    .gte('due_date', floor.toISOString().slice(0, 10))
    .order('due_date', { ascending: true })
    .limit(500)

  if (error) {
    console.error('[cron:payment-reminders] запрос начислений упал:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (data ?? []) as unknown as TxRow[]
  let reminded = 0
  let overdueSent = 0
  let skipped = 0

  for (const row of rows) {
    const contract = row.contracts
    const email = contract?.contacts?.email ?? null

    // Расторгнутый или отменённый договор напоминаний не порождает.
    const contractDead = contract?.status === 'cancelled'
    if (!row.organization_id || contractDead || !isValidEmail(email) || !row.due_date) {
      skipped += 1
      continue
    }

    const due = new Date(row.due_date)
    const overdueDays = daysBetween(due, today)
    const common = {
      orgId: row.organization_id,
      to: email,
      amount: row.amount,
      dueDate: row.due_date,
      contractNumber: contract?.contract_number ?? null,
      address: contract?.properties?.address ?? null,
      paymentId: row.id,
    }

    if (overdueDays > 0) {
      if (!olderThan(row.overdue_notified_at, OVERDUE_REPEAT_DAYS)) {
        skipped += 1
        continue
      }
      const res = await sendPaymentOverdueEmail({ ...common, daysOverdue: overdueDays })
      if (res.ok && !res.skipped) {
        overdueSent += 1
        await supabase
          .from('accounting_transactions')
          .update({ overdue_notified_at: new Date().toISOString() })
          .eq('id', row.id)
      } else {
        skipped += 1
      }
      continue
    }

    // Ещё не просрочен — напоминаем ровно один раз перед сроком.
    if (row.reminder_sent_at) {
      skipped += 1
      continue
    }
    const res = await sendPaymentReminderEmail(common)
    if (res.ok && !res.skipped) {
      reminded += 1
      await supabase
        .from('accounting_transactions')
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq('id', row.id)
    } else {
      skipped += 1
    }
  }

  return NextResponse.json({ ok: true, scanned: rows.length, reminded, overdueSent, skipped })
}
