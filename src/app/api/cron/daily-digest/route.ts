import { NextResponse } from 'next/server'
import { resolveBotOrgId } from '@/lib/telegram/org'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getChannelSettings } from '@/lib/telegram/channel'
import { sendMessage } from '@/lib/telegram/api'
import { getSiteUrl } from '@/lib/telegram/site-url'

export const dynamic = 'force-dynamic'

// Утренний дайджест по CRM: просрочки по оплатам, задачи на сегодня/просроченные, лиды,
// которые "молчат" без движения по статусу. Вызывается Vercel Cron (см. vercel.json) раз
// в день утром — тот же паттерн секрета, что и у /api/cron/channel-heartbeat.
// Проактивный аналог реактивного AI-диалога: раньше бот отвечал только когда его спросят,
// теперь сам напоминает о том, что горит, не дожидаясь вопроса.

const STALE_LEAD_DAYS = 3

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  const url = new URL(request.url)
  const querySecret = url.searchParams.get('secret')
  const ok = process.env.CRON_SECRET && (auth === `Bearer ${process.env.CRON_SECRET}` || querySecret === process.env.CRON_SECRET)
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = await resolveBotOrgId()
  if (!orgId) return NextResponse.json({ error: 'org not resolved' }, { status: 500 })

  const settings = await getChannelSettings(orgId)
  const adminChatId = settings?.admin_telegram_user_id
  if (!adminChatId) return NextResponse.json({ ok: true, skipped: 'no admin configured' })

  const supabaseAdmin = getSupabaseAdmin()
  const today = new Date().toISOString().slice(0, 10)
  const siteUrl = getSiteUrl()

  const [{ data: overduePayments }, { data: tasksDue }, { data: staleLeads }] = await Promise.all([
    supabaseAdmin
      .from('payments')
      .select('id, amount, due_date, contracts(contract_number)')
      .eq('organization_id', orgId)
      .in('payment_status', ['pending', 'overdue', 'partial'])
      .lte('due_date', today)
      .order('due_date', { ascending: true }),
    supabaseAdmin
      .from('tasks')
      .select('id, title, deadline, priority')
      .eq('organization_id', orgId)
      .in('status', ['todo', 'in_progress'])
      .lte('deadline', today)
      .order('deadline', { ascending: true }),
    supabaseAdmin
      .from('leads')
      .select('id, full_name, status, created_at')
      .eq('organization_id', orgId)
      .in('status', ['new', 'contacted'])
      .lt('created_at', daysAgo(STALE_LEAD_DAYS)),
  ])

  const hasOverdue = (overduePayments?.length ?? 0) > 0
  const hasTasks = (tasksDue?.length ?? 0) > 0
  const hasStaleLeads = (staleLeads?.length ?? 0) > 0

  if (!hasOverdue && !hasTasks && !hasStaleLeads) {
    // Тихое утро — не шлём сообщение "всё чисто" каждый день, это быстро станет шумом,
    // который перестают читать. Молчание = "ничего не горит".
    return NextResponse.json({ ok: true, sent: false })
  }

  const parts: string[] = ['☀️ <b>Доброе утро, вот что на сегодня</b>']

  if (hasOverdue) {
    const lines = (overduePayments ?? []).slice(0, 7).map((p) => {
      const contract = Array.isArray(p.contracts) ? p.contracts[0] : p.contracts
      const label = contract?.contract_number ? `Договор ${contract.contract_number}` : `Платёж №${String(p.id).slice(0, 8)}`
      return `• ${label} — ${Number(p.amount).toLocaleString('ru-RU')} ₽ (срок ${p.due_date})`
    })
    parts.push(`💰 <b>Оплаты (${overduePayments!.length})</b>\n${lines.join('\n')}`)
  }

  if (hasTasks) {
    const lines = (tasksDue ?? []).slice(0, 7).map((t) => `• ${t.title}${t.deadline ? ` (срок ${String(t.deadline).slice(0, 10)})` : ''}`)
    parts.push(`✅ <b>Задачи (${tasksDue!.length})</b>\n${lines.join('\n')}`)
  }

  if (hasStaleLeads) {
    const lines = (staleLeads ?? []).slice(0, 7).map((l) => `• ${l.full_name || 'Без имени'} — без движения ${STALE_LEAD_DAYS}+ дн.`)
    parts.push(`🧲 <b>Лиды без ответа (${staleLeads!.length})</b>\n${lines.join('\n')}`)
  }

  // Обычный "<a>" тег тут не годится — sanitizeTelegramHtml в api.ts экранирует всё, кроме
  // <b>/<i>/<code> (см. комментарий там), поэтому просто голая ссылка — Telegram сам её линкует.
  parts.push(`Подробности — ${siteUrl}/dashboard или через /menu в этом чате.`)

  await sendMessage(adminChatId, parts.join('\n\n'))
  return NextResponse.json({ ok: true, sent: true, overdue: overduePayments?.length ?? 0, tasks: tasksDue?.length ?? 0, staleLeads: staleLeads?.length ?? 0 })
}
