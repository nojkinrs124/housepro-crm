import { NextResponse } from 'next/server'
import { resolveBotOrgId } from '@/lib/telegram/org'
import {
  getChannelSettings,
  getActiveScheduleForDay,
  hasPostForSchedule,
  createDraftRow,
  sendDraftForReview,
  setAwaitingIntent,
  type ChannelRubric,
} from '@/lib/telegram/channel'
import { generateRubricDraft } from '@/lib/telegram/channel-generate'
import { sendMessage } from '@/lib/telegram/api'

export const dynamic = 'force-dynamic'

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

// Heartbeat-крон: вызывается ВНЕШНИМ планировщиком (GitHub Actions, .github/workflows/
// channel-heartbeat.yml) каждые ~15 минут, а не встроенным кроном Vercel — на Hobby-плане
// Vercel крон ограничен 1 разом в сутки, что не даёт делать несколько слотов расписания
// в день (решение от 15.08.2026, см. discussion). Заменяет старый /api/cron/channel-draft.
//
// Логика: для каждого включённого слота на СЕГОДНЯ (channel_schedule) — если текущее
// локальное время попало в окно [send_time_local, send_time_local + 30 мин) и по этому
// слоту сегодня ещё ничего не отправлялось — сгенерировать черновик (или запросить
// надиктовку, если рубрика requires_input).
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

  const now = new Date()
  const localNow = new Date(now.toLocaleString('en-US', { timeZone: settings.timezone }))
  const dayKey = DAY_KEYS[localNow.getDay()]
  const nowMinutes = localNow.getHours() * 60 + localNow.getMinutes()
  const scheduledFor = `${localNow.getFullYear()}-${String(localNow.getMonth() + 1).padStart(2, '0')}-${String(localNow.getDate()).padStart(2, '0')}`

  const slots = await getActiveScheduleForDay(orgId, dayKey)
  const results: Record<string, unknown>[] = []

  for (const slot of slots) {
    const rubric = slot.rubric
    if (!rubric || !rubric.active) continue

    const [h, m] = slot.send_time_local.split(':').map(Number)
    const slotMinutes = h * 60 + m
    // Окно 30 минут вперёд от времени слота — запас под задержку GitHub Actions
    // (их cron не гарантирует точность до минуты, может опоздать).
    if (nowMinutes < slotMinutes || nowMinutes >= slotMinutes + 30) continue

    if (await hasPostForSchedule(slot.id, scheduledFor)) continue

    if (rubric.requires_input) {
      // 'case' и 'adhoc' — старые флоу с собственной логикой в webhook.ts (setAwaitingIntent
      // 'case'/'post'). Любая другая requires_input-рубрика (заведённая через "➕ Новая
      // рубрика" в боте) идёт по единому generic-флоу 'input_rubric:<id>' — см. обработчик
      // в tryHandleScheduleOrRubricInput в webhook.ts.
      const intent = rubric.key === 'case' ? 'case' : rubric.key === 'adhoc' ? 'post' : `input_rubric:${rubric.id}`
      await setAwaitingIntent(orgId, intent)
      await sendMessage(
        settings.admin_telegram_user_id,
        rubric.input_prompt ?? `🎙 По расписанию сегодня рубрика «${rubric.label}» — пришли текст или голосовое.`
      )
      const stubId = await createDraftRow(orgId, rubric.key as ChannelRubric, scheduledFor, {
        rubricId: rubric.id,
        scheduleId: slot.id,
      })
      results.push({ rubric: rubric.key, action: 'reminder_sent', postId: stubId })
      continue
    }

    try {
      const draftText = await generateRubricDraft(settings, rubric)
      const postId = await createDraftRow(orgId, rubric.key as ChannelRubric, scheduledFor, {
        rubricId: rubric.id,
        scheduleId: slot.id,
      })
      await sendDraftForReview(orgId, postId, rubric.key as ChannelRubric, draftText, 'dm_admin')
      results.push({ rubric: rubric.key, action: 'draft_sent', postId })
    } catch (e) {
      console.error('[cron/channel-heartbeat] generation error:', e)
      await sendMessage(
        settings.admin_telegram_user_id,
        `⚠️ Не удалось сгенерировать черновик (${rubric.label}). Ошибка: ${e instanceof Error ? e.message : 'неизвестная'}`
      )
      results.push({ rubric: rubric.key, action: 'error' })
    }
  }

  return NextResponse.json({ ok: true, dayKey, nowLocal: `${localNow.getHours()}:${localNow.getMinutes()}`, slotsChecked: slots.length, results })
}
