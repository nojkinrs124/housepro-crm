import { NextResponse } from 'next/server'
import { resolveBotOrgId } from '@/lib/telegram/org'
import { getChannelSettings } from '@/lib/telegram/channel'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { sendMessage, getChatMemberCount } from '@/lib/telegram/api'

export const dynamic = 'force-dynamic'

// Запускается раз в неделю (см. vercel.json, воскресенье вечером). Считает подписчиков,
// опубликованные посты и клики по CTA-ссылкам за прошедшую неделю, шлёт сводку админу.
export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await resolveBotOrgId()
  if (!orgId) return NextResponse.json({ error: 'org not resolved' }, { status: 500 })

  const settings = await getChannelSettings(orgId)
  if (!settings?.admin_telegram_user_id || !settings.channel_chat_id) {
    return NextResponse.json({ skipped: 'channel_bot_settings не настроен' })
  }

  const supabaseAdmin = getSupabaseAdmin()
  const weekAgo = new Date()
  weekAgo.setUTCDate(weekAgo.getUTCDate() - 7)
  const weekStartIso = weekAgo.toISOString().slice(0, 10)

  const { data: prevWeek } = await supabaseAdmin
    .from('channel_weekly_stats')
    .select('subscriber_count_end')
    .order('week_start', { ascending: false })
    .eq('organization_id', orgId)
    .limit(1)
    .maybeSingle()

  const { data: publishedPosts } = await supabaseAdmin
    .from('channel_posts')
    .select('id, rubric, final_text')
    .eq('organization_id', orgId)
    .eq('status', 'published')
    .gte('published_at', weekAgo.toISOString())

  const postIds = (publishedPosts ?? []).map((p) => p.id)
  let totalClicks = 0
  let topPostId: string | null = null

  if (postIds.length > 0) {
    const { data: links } = await supabaseAdmin.from('channel_links').select('code, post_id').in('post_id', postIds)
    const codeToPost = new Map((links ?? []).map((l) => [l.code, l.post_id]))
    if (links && links.length > 0) {
      const { data: clicks } = await supabaseAdmin
        .from('channel_link_clicks')
        .select('code')
        .in('code', links.map((l) => l.code))
        .gte('clicked_at', weekAgo.toISOString())

      totalClicks = clicks?.length ?? 0
      const perPost = new Map<string, number>()
      for (const c of clicks ?? []) {
        const postId = codeToPost.get(c.code)
        if (postId) perPost.set(postId, (perPost.get(postId) ?? 0) + 1)
      }
      let max = 0
      for (const [postId, count] of perPost) {
        if (count > max) {
          max = count
          topPostId = postId
        }
      }
    }
  }

  const subscriberCountEnd = await getChatMemberCount(settings.channel_chat_id)
  const subscriberCountStart = prevWeek?.subscriber_count_end ?? null
  const delta =
    subscriberCountEnd !== null && subscriberCountStart !== null ? subscriberCountEnd - subscriberCountStart : null

  await supabaseAdmin.from('channel_weekly_stats').upsert(
    {
      organization_id: orgId,
      week_start: weekStartIso,
      subscriber_count_start: subscriberCountStart,
      subscriber_count_end: subscriberCountEnd,
      posts_published: publishedPosts?.length ?? 0,
      total_clicks: totalClicks,
      top_post_id: topPostId,
    },
    { onConflict: 'organization_id,week_start' }
  )

  const topPost = publishedPosts?.find((p) => p.id === topPostId)
  const lines = [
    '📊 <b>Сводка по каналу за неделю</b>',
    '',
    `Подписчики: ${subscriberCountEnd ?? '—'}${delta !== null ? ` (${delta >= 0 ? '+' : ''}${delta})` : ''}`,
    `Опубликовано постов: ${publishedPosts?.length ?? 0}`,
    `Кликов по CTA-ссылкам: ${totalClicks}`,
  ]
  if (topPost) {
    lines.push('', `Лучший пост (${topPost.rubric}): ${(topPost.final_text ?? '').slice(0, 80)}...`)
  }

  await sendMessage(settings.admin_telegram_user_id, lines.join('\n'))

  return NextResponse.json({ ok: true })
}
