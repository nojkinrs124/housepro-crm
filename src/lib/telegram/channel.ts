import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { sendMessage } from '@/lib/telegram/api'
import { createChannelLink } from '@/lib/telegram/channel-links'

export type ChannelRubric = 'analytics' | 'case' | 'cta' | 'adhoc'
export type ChannelCtaType = 'dm_admin' | 'bot_qualifier' | 'none'

export interface ChannelSettings {
  organization_id: string
  channel_chat_id: string | null
  admin_telegram_user_id: string | null
  admin_telegram_username: string | null
  style_prompt: string
  schedule_json: Record<string, ChannelRubric>
  awaiting_case: boolean
}

// dm_admin — жёсткий оффер, ведёт прямо в личку к Руслану.
// bot_qualifier — мягкий контент (аналитика/кейс), ведёт в личку к боту, который сам
// заводит разговор и квалифицирует лида, не нагружая Руслана каждым касанием.
async function resolveCtaLine(orgId: string, postId: string, settings: ChannelSettings, ctaType: ChannelCtaType): Promise<string> {
  if (ctaType === 'none') return ''

  const destination =
    ctaType === 'dm_admin'
      ? settings.admin_telegram_username
        ? `https://t.me/${settings.admin_telegram_username}`
        : null
      : process.env.TELEGRAM_BOT_USERNAME
        ? `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}`
        : null

  if (!destination) {
    console.warn(
      `[channel] нет destination для cta_type=${ctaType} — пропускаю CTA-ссылку ` +
        `(нужен admin_telegram_username в channel_bot_settings или TELEGRAM_BOT_USERNAME в env)`
    )
    return ''
  }

  const label = ctaType === 'dm_admin' ? '👉 Написать напрямую' : '👉 Узнать подробнее'
  const trackedUrl = await createChannelLink(orgId, postId, destination, label)
  return `\n\n<b>${label}:</b> ${trackedUrl}`
}

export async function getChannelSettings(orgId: string): Promise<ChannelSettings | null> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data } = await supabaseAdmin
    .from('channel_bot_settings')
    .select('*')
    .eq('organization_id', orgId)
    .maybeSingle()
  return (data as ChannelSettings | null) ?? null
}

// Черновик пока не готов к показу — используется, когда генерация ещё пишется
// в фоне (напр. запрошена вручную) и сразу нужен id записи.
export async function createDraftRow(
  orgId: string,
  rubric: ChannelRubric,
  scheduledFor: string | null
): Promise<string> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('channel_posts')
    .insert({ organization_id: orgId, rubric, status: 'draft', scheduled_for: scheduledFor })
    .select('id')
    .single()
  if (error || !data) throw new Error(`createDraftRow: ${error?.message}`)
  return data.id as string
}

function reviewKeyboard(postId: string) {
  return {
    inlineKeyboard: [
      [
        { text: '✅ Опубликовать', callback_data: `chpub:${postId}` },
        { text: '🔄 Другой вариант', callback_data: `chregen:${postId}` },
      ],
      [{ text: '❌ Отклонить', callback_data: `chreject:${postId}` }],
    ],
  }
}

// Отправляет готовый текст админу на утверждение и переводит пост в pending_review.
// Правка текста — просто ответом в чат с новой формулировкой (обрабатывается в webhook),
// поэтому отдельной кнопки "Править" не делаем — это было бы вторым способом ввода текста.
export async function sendDraftForReview(
  orgId: string,
  postId: string,
  rubric: ChannelRubric,
  text: string,
  ctaType: ChannelCtaType
): Promise<void> {
  const settings = await getChannelSettings(orgId)
  if (!settings?.admin_telegram_user_id) {
    console.error('[channel] admin_telegram_user_id не настроен, черновик не отправлен', postId)
    return
  }

  const ctaLine = await resolveCtaLine(orgId, postId, settings, ctaType)
  const fullText = `${text}${ctaLine}`

  const supabaseAdmin = getSupabaseAdmin()
  await supabaseAdmin
    .from('channel_posts')
    .update({
      draft_text: fullText,
      cta_type: ctaType,
      status: 'pending_review',
      updated_at: new Date().toISOString(),
    })
    .eq('id', postId)

  const rubricLabel = { analytics: '📊 Аналитика', case: '🏠 Кейс', cta: '📣 CTA/оффер', adhoc: '✍️ Разовый пост' }[rubric]
  const preview = `<b>Черновик поста (${rubricLabel})</b>\n\n${fullText}`

  const res = await sendMessage(settings.admin_telegram_user_id, preview, {
    inlineKeyboard: reviewKeyboard(postId).inlineKeyboard,
  })

  const messageId = res?.result?.message_id
  if (messageId) {
    await supabaseAdmin.from('channel_posts').update({ review_message_id: messageId }).eq('id', postId)
  }
}

export async function publishPost(postId: string): Promise<{ error?: string }> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data: post } = await supabaseAdmin.from('channel_posts').select('*').eq('id', postId).maybeSingle()
  if (!post) return { error: 'Черновик не найден' }

  const settings = await getChannelSettings(post.organization_id)
  if (!settings?.channel_chat_id) return { error: 'channel_chat_id не настроен в channel_bot_settings' }

  const textToPublish = post.final_text || post.draft_text
  if (!textToPublish) return { error: 'Пустой текст поста' }

  try {
    const res = await sendMessage(settings.channel_chat_id, textToPublish)
    const channelMessageId = res?.result?.message_id
    await supabaseAdmin
      .from('channel_posts')
      .update({
        status: 'published',
        final_text: textToPublish,
        channel_message_id: channelMessageId ?? null,
        published_at: new Date().toISOString(),
      })
      .eq('id', postId)
    return {}
  } catch (e) {
    await supabaseAdmin.from('channel_posts').update({ status: 'failed' }).eq('id', postId)
    return { error: e instanceof Error ? e.message : 'Ошибка публикации' }
  }
}

export async function rejectPost(postId: string): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin()
  await supabaseAdmin.from('channel_posts').update({ status: 'rejected' }).eq('id', postId)
}

export async function getPendingReviewByMessageId(messageId: number) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data } = await supabaseAdmin
    .from('channel_posts')
    .select('*')
    .eq('status', 'pending_review')
    .eq('review_message_id', messageId)
    .maybeSingle()
  return data
}

export async function setAwaitingCase(orgId: string, awaiting: boolean): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin()
  await supabaseAdmin.from('channel_bot_settings').update({ awaiting_case: awaiting }).eq('organization_id', orgId)
}

export function isFromAdmin(settings: ChannelSettings | null, telegramUserId: string): boolean {
  return !!settings?.admin_telegram_user_id && settings.admin_telegram_user_id === telegramUserId
}
