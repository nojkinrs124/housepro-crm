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
  awaiting_intent: 'case' | 'post' | 'add_bot_user' | null
  schedule_paused: boolean
  timezone: string
  draft_send_hour: number
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

  // Переиспользуем уже существующую ссылку этого поста (если она уже создавалась при
  // первой отправке на утверждение), а не плодим новую при каждой правке текста/картинки —
  // иначе клики по одному и тому же посту размазались бы по нескольким кодам в статистике.
  const supabaseAdmin = getSupabaseAdmin()
  const { data: existing } = await supabaseAdmin
    .from('channel_links')
    .select('code')
    .eq('post_id', postId)
    .maybeSingle()

  const trackedUrl = existing ? `${siteUrlFromEnv()}/r/${existing.code}` : await createChannelLink(orgId, postId, destination, label)
  return `\n\n<b>${label}:</b> ${trackedUrl}`
}

function siteUrlFromEnv(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null) ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  )
}

// Phase 1/2 гибкого расписания: рубрики и слоты — теперь данные в БД (channel_rubrics/
// channel_schedule), а не хардкод. Читаются heartbeat-кроном (api/cron/channel-heartbeat).
export interface ChannelRubricRow {
  id: string
  organization_id: string
  key: string
  label: string
  prompt_template: string
  use_web_search: boolean
  requires_input: boolean
  input_prompt: string | null
  image_style_override: string | null
  active: boolean
  sort_order: number
}

export interface ChannelScheduleRow {
  id: string
  organization_id: string
  rubric_id: string
  day_key: string
  send_time_local: string
  enabled: boolean
  rubric: ChannelRubricRow | null
}

export async function getActiveScheduleForDay(orgId: string, dayKey: string): Promise<ChannelScheduleRow[]> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data } = await supabaseAdmin
    .from('channel_schedule')
    .select('*, rubric:channel_rubrics(*)')
    .eq('organization_id', orgId)
    .eq('day_key', dayKey)
    .eq('enabled', true)
  return (data as unknown as ChannelScheduleRow[]) ?? []
}

// Дедупликация heartbeat-тиков: слот уже обработан сегодня (черновик отправлен или
// запрошена надиктовка), не нужно слать повторно на следующем тике раз в ~15 мин.
export async function hasPostForSchedule(scheduleId: string, scheduledFor: string): Promise<boolean> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data } = await supabaseAdmin
    .from('channel_posts')
    .select('id')
    .eq('schedule_id', scheduleId)
    .eq('scheduled_for', scheduledFor)
    .maybeSingle()
  return !!data
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
  scheduledFor: string | null,
  linkedTo?: { rubricId?: string; scheduleId?: string }
): Promise<string> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('channel_posts')
    .insert({
      organization_id: orgId,
      rubric,
      status: 'draft',
      scheduled_for: scheduledFor,
      rubric_id: linkedTo?.rubricId ?? null,
      schedule_id: linkedTo?.scheduleId ?? null,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`createDraftRow: ${error?.message}`)
  return data.id as string
}

// Единая подсказка под превью черновика: два независимых способа правки простым ответом на сообщение —
// без спецсимволов в начале текст идёт как новая версия поста, с префиксом "фото:"/"картинка:" — как
// пожелание к перегенерации картинки (см. разбор в webhook route.ts, tryHandleChannelInput).
const EDIT_HINT =
  '<i>💬 Чтобы поправить текст — ответь на это сообщение своим вариантом.\n' +
  '🖼 Чтобы поправить картинку конкретно — ответь так: «фото: сделай на закате, без людей».</i>'

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
  const preview = `<b>Черновик поста (${rubricLabel})</b>\n\n${fullText}\n\n${EDIT_HINT}`

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
async function generateAndStoreImage(postId: string, rubric: ChannelRubric, postText: string, extraInstruction?: string): Promise<string | null> {
  try {
    const imageBuffer = await generateChannelImage(rubric, postText, extraInstruction)
    if (!imageBuffer) return null
    return await uploadChannelImage(postId, imageBuffer)
  } catch (e) {
    console.error('[channel] генерация/загрузка картинки не удалась:', e)
    return null
  }
}

// Перегенерирует только картинку у уже существующего черновика, текст и CTA не трогает.
// extraInstruction — конкретные пожелания к картинке от админа (например, ответ на черновик
// вида "фото: без людей, добавь закат") — передаются в промпт модели картинки как есть.
export async function regenerateImage(postId: string, extraInstruction?: string): Promise<{ error?: string }> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data: post } = await supabaseAdmin.from('channel_posts').select('*').eq('id', postId).maybeSingle()
  if (!post) return { error: 'Черновик не найден' }

  const settings = await getChannelSettings(post.organization_id)
  if (!settings?.admin_telegram_user_id) return { error: 'admin_telegram_user_id не настроен' }

  const imageUrl = await generateAndStoreImage(postId, post.rubric, post.draft_text ?? '', extraInstruction)
  if (!imageUrl) return { error: 'Не удалось сгенерировать картинку' }

  await supabaseAdmin.from('channel_posts').update({ image_url: imageUrl }).eq('id', postId)

  const rubricLabel = { analytics: '📊 Аналитика', case: '🏠 Кейс', cta: '📣 CTA/оффер', adhoc: '✍️ Разовый пост' }[
    post.rubric as ChannelRubric
  ]
  const preview = `<b>Черновик поста (${rubricLabel})</b>\n\n${post.draft_text}\n\n${EDIT_HINT}`
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

// Ручная правка текста — админ отвечает на сообщение с черновиком своим текстом.
// Без обращения к модели: то, что написал Руслан, идёт как есть (плюс CTA-строка).
// Картинка не трогается.
export async function applyManualEdit(postId: string, newBodyText: string): Promise<{ error?: string }> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data: post } = await supabaseAdmin.from('channel_posts').select('*').eq('id', postId).maybeSingle()
  if (!post) return { error: 'Черновик не найден' }

  const settings = await getChannelSettings(post.organization_id)
  if (!settings?.admin_telegram_user_id) return { error: 'admin_telegram_user_id не настроен' }

  const ctaLine = await resolveCtaLine(post.organization_id, postId, settings, post.cta_type as ChannelCtaType)
  const fullText = `${newBodyText.trim()}${ctaLine}`

  await supabaseAdmin.from('channel_posts').update({ draft_text: fullText, updated_at: new Date().toISOString() }).eq('id', postId)

  const rubricLabel = { analytics: '📊 Аналитика', case: '🏠 Кейс', cta: '📣 CTA/оффер', adhoc: '✍️ Разовый пост' }[
    post.rubric as ChannelRubric
  ]
  const preview = `<b>Черновик поста (${rubricLabel}, правка)</b>\n\n${fullText}\n\n${EDIT_HINT}`
  const { message_id: messageId } = await sendPostVisual(
    settings.admin_telegram_user_id,
    preview,
    post.image_url,
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

export async function setSchedulePaused(orgId: string, paused: boolean): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin()
  await supabaseAdmin.from('channel_bot_settings').update({ schedule_paused: paused }).eq('organization_id', orgId)
}

// Обновляет счётчик реакций поста по данным апдейта message_reaction_count (агрегированные,
// анонимные — Telegram присылает их для каналов, где бот админ, без данных о конкретном пользователе).
export async function updatePostReactionCount(messageId: number, totalCount: number): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin()
  await supabaseAdmin
    .from('channel_posts')
    .update({ reaction_count: totalCount })
    .eq('channel_message_id', messageId)
    .eq('status', 'published')
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
    `Автопостинг: ${settings.schedule_paused ? '⏸ на паузе (/resume — включить)' : '▶️ активен (/pause — приостановить)'}`,
    `Часовой пояс: ${settings.timezone} · черновики на утверждение приходят в ${settings.draft_send_hour}:00 по нему`,
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

  const { data: reactionRows } = await supabaseAdmin
    .from('channel_posts')
    .select('reaction_count')
    .eq('organization_id', orgId)
    .eq('status', 'published')
    .gte('published_at', weekAgo.toISOString())
  const totalReactions = (reactionRows ?? []).reduce((sum, p) => sum + (p.reaction_count ?? 0), 0)

  return [
    '📊 <b>Статистика (сейчас)</b>',
    '',
    `Подписчики: ${subscriberCount ?? '—'}`,
    `Опубликовано за 7 дней: ${publishedCount ?? 0}`,
    `Кликов по CTA за 7 дней: ${totalClicks}`,
    `Реакций на посты за 7 дней: ${totalReactions}`,
    `Ждут утверждения: ${pendingCount ?? 0}`,
  ].join('\n')
}
