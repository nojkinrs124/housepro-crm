import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { InlineKeyboardButton } from '@/lib/telegram/api'
import type { ScreenContent } from '@/lib/telegram/menu'

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
