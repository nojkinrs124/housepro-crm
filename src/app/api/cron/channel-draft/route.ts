import { NextResponse } from 'next/server'
import { resolveBotOrgId } from '@/lib/telegram/org'
import { getChannelSettings, createDraftRow, sendDraftForReview, setAwaitingIntent, type ChannelRubric } from '@/lib/telegram/channel'
import { generateAnalyticsDraft, generateCtaDraft } from '@/lib/telegram/channel-generate'
import { sendMessage } from '@/lib/telegram/api'

export const dynamic = 'force-dynamic'

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

// Запускается раз в день вечером (см. vercel.json). Смотрит на РАСПИСАНИЕ ЗАВТРАШНЕГО
// дня: если завтра рубрика "analytics"/"cta" — генерирует и шлёт черновик на утверждение
// СЕГОДНЯ (чтобы было время проверить). Если завтра "case" — присылает напоминание
// надиктовать кейс, черновик из этого не собирается автоматически.
export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  const url = new URL(request.url)
  const querySecret = url.searchParams.get('secret')
  const ok = process.env.CRON_SECRET && (auth === `Bearer ${process.env.CRON_SECRET}` || querySecret === process.env.CRON_SECRET)
  if (!ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await resolveBotOrgId()
  if (!orgId) return NextResponse.json({ error: 'org not resolved' }, { status: 500 })

  const settings = await getChannelSettings(orgId)
  if (!settings?.admin_telegram_user_id) {
    return NextResponse.json({ skipped: 'channel_bot_settings не настроен' })
  }
  if (settings.schedule_paused) {
    return NextResponse.json({ skipped: 'расписание на паузе (/resume в боте — включить)' })
  }

  const tomorrow = new Date()
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  const dayKey = DAY_KEYS[tomorrow.getUTCDay()]
  const rubric = (settings.schedule_json as Record<string, ChannelRubric>)[dayKey]

  if (!rubric) return NextResponse.json({ skipped: `нет рубрики на ${dayKey}` })

  const scheduledFor = tomorrow.toISOString().slice(0, 10)

  if (rubric === 'case') {
    await setAwaitingIntent(orgId, 'case')
    await sendMessage(
      settings.admin_telegram_user_id,
      '🎙 Завтра по расписанию пост-кейс. Надиктуй голосом или напиши текстом: с чем пришёл клиент, ' +
        'в чём была сложность, как решили, какой результат — оформлю в пост. Команда: /case <текст или голосовое>'
    )
    return NextResponse.json({ ok: true, action: 'reminder_sent', rubric })
  }

  try {
    const draftText =
      rubric === 'analytics' ? await generateAnalyticsDraft(settings) : await generateCtaDraft(settings)

    const postId = await createDraftRow(orgId, rubric, scheduledFor)
    // bot_qualifier временно не используем — квалифицирующий диалог с лидами отложен
    // до отдельного бота без доступа к CRM (см. решение от 23.07.2026). Пока все CTA — на Руслана напрямую.
    const ctaType = 'dm_admin'
    await sendDraftForReview(orgId, postId, rubric, draftText, ctaType)

    return NextResponse.json({ ok: true, action: 'draft_sent', rubric, postId })
  } catch (e) {
    console.error('[cron/channel-draft] generation error:', e)
    await sendMessage(
      settings.admin_telegram_user_id,
      `⚠️ Не удалось автоматически сгенерировать черновик (${rubric}) на завтра. Ошибка: ${
        e instanceof Error ? e.message : 'неизвестная'
      }`
    )
    return NextResponse.json({ error: 'generation failed' }, { status: 500 })
  }
}
