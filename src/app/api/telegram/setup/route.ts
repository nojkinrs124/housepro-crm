import { NextResponse } from 'next/server'
import { setMyCommands, setWebhook } from '@/lib/telegram/api'

export const dynamic = 'force-dynamic'

const COMMANDS = [
  { command: 'menu', description: '📋 Меню — CRM, канал, настройки' },
  { command: 'help', description: '❓ Справка' },
]

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null) ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  )
}

// Идемпотентно — можно дёргать повторно, просто перезапишет список команд/вебхук.
export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  const url = new URL(request.url)
  const querySecret = url.searchParams.get('secret')
  const ok = process.env.CRON_SECRET && (auth === `Bearer ${process.env.CRON_SECRET}` || querySecret === process.env.CRON_SECRET)
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const commandsSuccess = await setMyCommands(COMMANDS)
  // message_reaction_count не входит в дефолтный набор апдейтов Telegram — без явного
  // allowed_updates бот не получит реакции на посты канала вообще.
  const webhookSuccess = await setWebhook(`${siteUrl()}/api/telegram/webhook`, [
    'message',
    'callback_query',
    'message_reaction_count',
  ])

  return NextResponse.json({ commandsSuccess, webhookSuccess })
}
