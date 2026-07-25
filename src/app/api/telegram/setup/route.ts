import { NextResponse } from 'next/server'
import { setMyCommands } from '@/lib/telegram/api'

export const dynamic = 'force-dynamic'

const COMMANDS = [
  { command: 'menu', description: '📋 Меню — выбрать действие' },
  { command: 'post', description: '📝 Разовый пост по теме' },
  { command: 'case', description: '🎙 Оформить кейс из практики' },
  { command: 'pause', description: '⏸ Приостановить автопостинг' },
  { command: 'resume', description: '▶️ Включить автопостинг обратно' },
  { command: 'help', description: '❓ Справка' },
]

// Идемпотентно — можно дёргать повторно, просто перезапишет список команд.
export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  const url = new URL(request.url)
  const querySecret = url.searchParams.get('secret')
  const ok = process.env.CRON_SECRET && (auth === `Bearer ${process.env.CRON_SECRET}` || querySecret === process.env.CRON_SECRET)
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const success = await setMyCommands(COMMANDS)
  return NextResponse.json({ success })
}
