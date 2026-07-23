import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { sendMessage, sendPhoto } from '@/lib/telegram/api'
import { createChannelLink } from '@/lib/telegram/channel-links'
import { generateChannelImage } from '@/lib/telegram/channel-generate'
import { uploadChannelImage } from '@/lib/telegram/channel-image'

export type ChannelRubric = 'analytics' | 'case' | 'cta' | 'adhoc'
export type ChannelCtaType = 'dm_admin' | 'bot_qualifier' | 'none'

export interface ChannelSettings {
  organization_id: string
  channel_chat_id: string | null
  admin_telegram_user_id: string | null
  admin_telegram_username: string | null
  style_prompt: string
  schedule_json: Record<string, ChannelRubric>
  awaiting_intent: 'case' | 'post' | null
}

// dm_admin — ведёт прямо в личку к Руслану. Используется для ВСЕХ CTA на данный момент.
// bot_qualifier — задел на будущее: мягкий контент должен вести в личку к отдельному
// боту-квалификатору (без доступа к CRM-инструментам). Пока такого бота нет — использовать
// bot_qualifier нельзя, это привело бы к тому, что случайный человек с канала мог бы писать
// ГЛАВНОМУ CRM-боту, у которого есть доступ к клиентской базе (решение от 23.07.2026).
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
        { text: '🔄 Другой текст', callback_data: `chregen:${postId}` },
      ],
      [
        { text: '🖼 Другая картинка', callback_data: `chregenimg:${postId}` },
        { text: '❌ Отклонить', callback_data: `chreject:${postId}` },
      ],
    ],
  }
}

// Отправляет готовый текст админу на утверждение и переводит пост в pending_review.
// Правка текста — просто ответом в чат с новой формулировкой (обрабатывается в webhook),
// поэтому отдельной кнопки "Править" не делаем — это было бы вторым способом ввода текста.
// Telegram ограничивает подпись к фото 1024 символами. Наши посты обычно короче (см.
// FORMAT_RULES в channel-generate.ts, 400-900 символов), но CTA-ссылка может добавить лишнего —
// на этот случай шлём фото без подписи и текст отдельным сообщением следом.
async function sendPostVisual(
  chatId: string | number,
  text: string,
  imageUrl: string | null,
  inlineKeyboard?: { text: string; callback_data: string }[][]
): Promise<{ message_id?: number }> {
  if (!imageUrl) {
    const res = await sendMessage(chatId, text, inlineKeyboard ? { inlineKeyboard } : undefined)
    return { message_id: res?.result?.message_id }
  }
  if (text.length <= 1024) {
    const res = await sendPhoto(chatId, imageUrl, text, inlineKeyboard ? { inlineKeyboard } : undefined)
    return { message_id: res?.result?.message_id }
  }
  await sendPhoto(chatId, imageUrl)
  const res = await sendMessage(chatId, text, inlineKeyboard ? { inlineKeyboard } : undefined)
  return { message_id: res?.result?.message_id }
}

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

  const imageUrl = await generateAndStoreImage(postId, rubric, text)

  const supabaseAdmin = getSupabaseAdmin()
  await supabaseAdmin
    .from('channel_posts')
    .update({
      draft_text: fullText,
      cta_type: ctaType,
      status: 'pending_review',
      image_url: imageUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', postId)

  const rubricLabel = { analytics: '📊 Аналитика', case: '🏠 Кейс', cta: '📣 CTA/оффер', adhoc: '✍️ Разовый пост' }[rubric]
  const preview = `<b>Черновик поста (${rubricLabel})</b>\n\n${fullText}`

  const { message_id: messageId } = await sendPostVisual(
    settings.admin_telegram_user_id,
    preview,
    imageUrl,
    reviewKeyboard(postId).inlineKeyboard
  )
  if (messageId) {
    await supabaseAdmin.from('channel_posts').update({ review_message_id: messageId }).eq('id', postId)
  }
}

// Генерирует картинку и грузит в Storage; при любой ошибке (модель недоступна, превышен лимит
// и т.п.) молча возвращает null — пост уходит на утверждение текстом, без картинки, а не падает целиком.
async function generateAndStoreImage(postId: string, rubric: ChannelRubric, postText: string): Promise<string | null> {
  try {
    const imageBuffer = await generateChannelImage(rubric, postText)
    if (!imageBuffer) return null
    return await uploadChannelImage(postId, imageBuffer)
  } catch (e) {
    console.error('[channel] генерация/загрузка картинки не удалась:', e)
    return null
  }
}

// Перегенерирует только картинку у уже существующего черновика, текст и CTA не трогает.
export async function regenerateImage(postId: string): Promise<{ error?: string }> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data: post } = await supabaseAdmin.from('channel_posts').select('*').eq('id', postId).maybeSingle()
  if (!post) return { error: 'Черновик не найден' }

  const settings = await getChannelSettings(post.organization_id)
  if (!settings?.admin_telegram_user_id) return { error: 'admin_telegram_user_id не настроен' }

  const imageUrl = await generateAndStoreImage(postId, post.rubric, post.draft_text ?? '')
  if (!imageUrl) return { error: 'Не удалось сгенерировать картинку' }

  await supabaseAdmin.from('channel_posts').update({ image_url: imageUrl }).eq('id', postId)

  const rubricLabel = { analytics: '📊 Аналитика', case: '🏠 Кейс', cta: '📣 CTA/оффер', adhoc: '✍️ Разовый пост' }[
    post.rubric as ChannelRubric
  ]
  const preview = `<b>Черновик поста (${rubricLabel})</b>\n\n${post.draft_text}`
  const { message_id: messageId } = await sendPostVisual(
    settings.admin_telegram_user_id,
    preview,
    imageUrl,
    reviewKeyboard(postId).inlineKeyboard
  )
  if (messageId) {
    await supabaseAdmin.from('channel_posts').update({ review_message_id: messageId }).eq('id', postId)
  }
  return {}
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
    const { message_id: channelMessageId } = await sendPostVisual(settings.channel_chat_id, textToPublish, post.image_url)
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

export async function setAwaitingIntent(orgId: string, intent: 'case' | 'post' | null): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin()
  await supabaseAdmin.from('channel_bot_settings').update({ awaiting_intent: intent }).eq('organization_id', orgId)
}

export function isFromAdmin(settings: ChannelSettings | null, telegramUserId: string): boolean {
  return !!settings?.admin_telegram_user_id && settings.admin_telegram_user_id === telegramUserId
}

export function getSettingsText(settings: ChannelSettings | null): string {
  if (!settings) return '⚠️ Настройки канала не заведены.'
  const scheduleLabels: Record<ChannelRubric, string> = { analytics: 'аналитика', case: 'кейс', cta: 'CTA/оффер', adhoc: 'разовое' }
  const scheduleLines = Object.entries(settings.schedule_json)
    .map(([day, rubric]) => `  ${day} — ${scheduleLabels[rubric] ?? rubric}`)
    .join('\n')
  return [
    '⚙️ <b>Настройки канала</b>',
    '',
    `Канал: ${settings.channel_chat_id ?? '—'}`,
    `Админ: @${settings.admin_telegram_username ?? '—'}`,
    'Расписание:',
    scheduleLines,
    '',
    'Изменить расписание/канал можно только через разработчика (напиши мне здесь в чате).',
  ].join('\n')
}

// Быстрая сводка по запросу из меню (в отличие от еженедельного cron — ничего не пишет
// в channel_weekly_stats, просто показывает текущее состояние).
export async function getLiveStatsText(orgId: string, settings: ChannelSettings): Promise<string> {
  const { getChatMemberCount } = await import('@/lib/telegram/api')
  const supabaseAdmin = getSupabaseAdmin()
  const weekAgo = new Date()
  weekAgo.setUTCDate(weekAgo.getUTCDate() - 7)

  const subscriberCount = settings.channel_chat_id ? await getChatMemberCount(settings.channel_chat_id) : null

  const { count: publishedCount } = await supabaseAdmin
    .from('channel_posts')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('status', 'published')
    .gte('published_at', weekAgo.toISOString())

  const { data: links } = await supabaseAdmin.from('channel_links').select('code').eq('organization_id', orgId)
  let totalClicks = 0
  if (links && links.length > 0) {
    const { count } = await supabaseAdmin
      .from('channel_link_clicks')
      .select('id', { count: 'exact', head: true })
      .in('code', links.map((l) => l.code))
      .gte('clicked_at', weekAgo.toISOString())
    totalClicks = count ?? 0
  }

  const { count: pendingCount } = await supabaseAdmin
    .from('channel_posts')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('status', 'pending_review')

  return [
    '📊 <b>Статистика (сейчас)</b>',
    '',
    `Подписчики: ${subscriberCount ?? '—'}`,
    `Опубликовано за 7 дней: ${publishedCount ?? 0}`,
    `Кликов по CTA за 7 дней: ${totalClicks}`,
    `Ждут утверждения: ${pendingCount ?? 0}`,
  ].join('\n')
}
