import { NextResponse } from 'next/server'
import { resolveBotOrgId } from '@/lib/telegram/org'
import { getChannelSettings } from '@/lib/telegram/channel'
import { sendMessage } from '@/lib/telegram/api'
import { getSiteUrl } from '@/lib/telegram/site-url'
import { collectDigest, isQuiet, renderDigest } from '@/features/telegram/services/digest'

export const dynamic = 'force-dynamic'

// Утренний дайджест по CRM: просрочки по оплатам, задачи на сегодня/просроченные, лиды,
// которые "молчат" без движения по статусу. Вызывается Vercel Cron (см. vercel.json) раз
// в день утром — тот же паттерн секрета, что и у /api/cron/channel-heartbeat.
// Проактивный аналог реактивного AI-диалога: раньше бот отвечал только когда его спросят,
// теперь сам напоминает о том, что горит, не дожидаясь вопроса.
//
// Сам сбор данных — в features/telegram/services/digest.ts: тот же самый показывает экран
// «⚡ Сегодня» в меню бота. Две копии запросов разъехались бы при первой же правке.

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

  const digest = await collectDigest(orgId)

  if (isQuiet(digest)) {
    // Тихое утро — не шлём сообщение "всё чисто" каждый день, это быстро станет шумом,
    // который перестают читать. Молчание = "ничего не горит".
    return NextResponse.json({ ok: true, sent: false })
  }

  const parts = ['☀️ <b>Доброе утро, вот что на сегодня</b>', ...renderDigest(digest)]
  // Обычный "<a>" тег тут не годится — sanitizeTelegramHtml в api.ts экранирует всё, кроме
  // <b>/<i>/<code> (см. комментарий там), поэтому просто голая ссылка — Telegram сам её линкует.
  parts.push(`Подробности — ${getSiteUrl()}/dashboard или через /menu в этом чате.`)

  await sendMessage(adminChatId, parts.join('\n\n'))
  return NextResponse.json({
    ok: true,
    sent: true,
    overdue: digest.overduePayments.length,
    tasks: digest.tasksDue.length,
    staleLeads: digest.staleLeads.length,
  })
}
