import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { InlineKeyboardButton } from '@/lib/telegram/api'
import type { ScreenContent } from '@/lib/telegram/menu'
import { getRubrics, getScheduleWithRubrics } from '@/lib/telegram/channel'

const BACK_TO_CHANNEL: InlineKeyboardButton = { text: '⬅ Канал', callback_data: 'nav:channel' }

const RUBRIC_LABELS: Record<string, string> = {
  analytics: '📊 Аналитика',
  case: '🏠 Кейс',
  cta: '📣 CTA/оффер',
  adhoc: '✍️ Разовый пост',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'черновик',
  pending_review: 'ждёт утверждения',
  approved: 'утверждён',
  published: 'опубликован',
  rejected: 'отклонён',
  failed: 'ошибка',
  expired: 'просрочен',
}

function snippet(text: string | null, max = 70): string {
  if (!text) return '(пусто)'
  const oneLine = text.replace(/\s+/g, ' ').trim()
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine
}

export async function buildChannelPostsScreen(orgId: string): Promise<ScreenContent> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data: posts } = await supabaseAdmin
    .from('channel_posts')
    .select('id, rubric, status, draft_text, final_text, reaction_count, created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(5)

  if (!posts || posts.length === 0) {
    return { text: '🗂 <b>Последние посты</b>\n\nПостов пока нет.', keyboard: [[BACK_TO_CHANNEL]] }
  }

  const lines: string[] = []
  const keyboard: InlineKeyboardButton[][] = []
  for (const p of posts) {
    const rubric = RUBRIC_LABELS[p.rubric] ?? p.rubric
    const status = STATUS_LABELS[p.status] ?? p.status
    const reactions = p.status === 'published' && p.reaction_count ? ` · ${p.reaction_count} реакций` : ''
    lines.push(`${rubric} — <b>${status}</b>${reactions}\n<i>${snippet(p.final_text || p.draft_text)}</i>`)

    if (p.status === 'pending_review') {
      keyboard.push([
        { text: '✅ Опубликовать', callback_data: `chlistpub:${p.id}` },
        { text: '❌ Отклонить', callback_data: `chlistreject:${p.id}` },
      ])
    }
  }
  keyboard.push([BACK_TO_CHANNEL])

  return { text: `🗂 <b>Последние посты</b>\n\n${lines.join('\n\n')}`, keyboard }
}

const DAY_RU: Record<string, string> = { mon: 'Пн', tue: 'Вт', wed: 'Ср', thu: 'Чт', fri: 'Пт', sat: 'Сб', sun: 'Вс' }

// Слоты расписания — читаются из channel_schedule (Phase 1/2/3, заменили старый
// hardcoded schedule_json). Время слота = когда heartbeat-крон присылает черновик на
// утверждение (не время публикации — публикация всегда по ручному ✅, см. channel.ts).
export async function buildChannelScheduleScreen(orgId: string): Promise<ScreenContent> {
  const slots = await getScheduleWithRubrics(orgId)

  const lines: string[] = []
  const keyboard: InlineKeyboardButton[][] = []
  for (const s of slots) {
    const rubricLabel = s.rubric?.label ?? '?'
    const status = s.enabled ? '' : ' ⏸'
    lines.push(`${DAY_RU[s.day_key] ?? s.day_key} ${s.send_time_local} — ${rubricLabel}${status}`)
    keyboard.push([
      { text: s.enabled ? '⏸' : '▶️', callback_data: `chschedtoggle:${s.id}` },
      { text: '🗑', callback_data: `chscheddel:${s.id}` },
    ])
  }

  const text =
    '⏰ <b>Расписание черновиков</b>\n\n' +
    (lines.length ? lines.join('\n') : 'Слотов пока нет.') +
    '\n\n<i>Время — когда бот присылает черновик на утверждение, не время публикации ' +
    '(публикация всегда вручную по кнопке ✅).\n\n' +
    'Добавить слот: нажми "➕" и пришли одной строкой день, время и рубрику, например:\n' +
    '<code>пн 08:00 cta</code></i>'

  keyboard.push([{ text: '➕ Добавить слот', callback_data: 'chschedadd:new' }])
  keyboard.push([BACK_TO_CHANNEL])

  return { text, keyboard }
}

// Рубрики — редактируются простым ответом на сообщение с текущим промптом (тот же паттерн,
// что уже используется для правки текста черновика).
export async function buildChannelRubricsScreen(orgId: string): Promise<ScreenContent> {
  const rubrics = await getRubrics(orgId)

  const keyboard: InlineKeyboardButton[][] = rubrics.map((r) => [
    { text: `${r.active ? '' : '💤 '}${r.label}`, callback_data: `chrubedit:${r.id}` },
    { text: r.active ? '⏸' : '▶️', callback_data: `chrubtoggle:${r.id}` },
  ])
  keyboard.push([BACK_TO_CHANNEL])

  return {
    text: '✍️ <b>Рубрики</b>\n\nТапни по рубрике, чтобы посмотреть и изменить её промпт.',
    keyboard,
  }
}
