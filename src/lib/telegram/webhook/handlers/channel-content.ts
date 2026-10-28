// Контент-ассистент канала: обработка inline-кнопок у черновиков (chpub/chregen/chreject/
// chregenimg), списка черновиков (chlistpub/chlistreject), а также ввода тем «сделать пост» /
// «кейс» / ответа-правки на черновик. Вынесено из webhook/route.ts фазой 2 аудита без
// изменения поведения.

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { sendMessage, sendChatAction, editMessageReplyMarkup, type TelegramUpdate } from '@/lib/telegram/api'
import {
  getChannelSettings,
  setAwaitingIntent,
  publishPost,
  rejectPost,
  createDraftRow,
  sendDraftForReview,
  regenerateImage,
  getLiveStatsText,
  applyManualEdit,
  getPendingReviewByMessageId,
  getRubricByKey,
  type ChannelRubric,
} from '@/lib/telegram/channel'
import { generateRubricDraft } from '@/lib/telegram/channel-generate'
import { parseImageNote } from '@/features/telegram/services/parsing'
import { showMenuScreen } from '@/lib/telegram/menu'
import { canFulfilIntent, type BotActor } from '@/features/telegram/services/access'

export async function handleChatMenuCallback(arg: string, actor: BotActor) {
  const { chatId } = actor
  // Роль проверена в диспетчере кнопок (`action:chmenu` — уровень владельца).
  const settings = await getChannelSettings(actor.orgId)

  if (arg === 'post') {
    await setAwaitingIntent(actor.orgId, 'post', actor.telegramUserId)
    await sendMessage(chatId, '📝 Напиши тему одним сообщением — подготовлю черновик поста.')
  } else if (arg === 'case') {
    await setAwaitingIntent(actor.orgId, 'case', actor.telegramUserId)
    await sendMessage(chatId, '🎙 Надиктуй голосом или напиши текстом: с чем пришёл клиент, в чём была сложность, как решили, результат.')
  } else if (arg === 'stats') {
    await sendChatAction(chatId, 'typing')
    if (settings) await sendMessage(chatId, await getLiveStatsText(actor.orgId, settings))
  }
}

export async function handleChannelCallback(action: string, postId: string, actor: BotActor, messageId: number | undefined) {
  const { chatId } = actor
  // Эти кнопки публикуют в публичный канал и тратят платную генерацию.
  // Роль проверена в диспетчере кнопок (`action:chpub|chregen|...` — владелец).

  if (messageId) await editMessageReplyMarkup(chatId, messageId, null)

  if (action === 'chreject') {
    await rejectPost(postId)
    await sendMessage(chatId, '❌ Черновик отклонён.')
    return
  }

  if (action === 'chregen') {
    const supabaseAdmin = getSupabaseAdmin()
    const { data: post } = await supabaseAdmin.from('channel_posts').select('*').eq('id', postId).maybeSingle()
    if (!post) {
      await sendMessage(chatId, 'Черновик не найден (возможно, уже обработан).')
      return
    }
    const settings = await getChannelSettings(post.organization_id)
    try {
      const rubric = await getRubricByKey(post.organization_id, post.rubric)
      if (!rubric) throw new Error(`рубрика «${post.rubric}» не найдена в БД`)
      let newText: string
      if (post.rubric === 'case') {
        newText = await generateRubricDraft(settings, rubric, post.source_input ?? '')
      } else if (rubric.requires_input) {
        // Для рубрик без сохранённой вводной (например adhoc — тема нигде не хранится на
        // посте) перегенерация не может восстановить исходную тему. Разумный дефолт —
        // рубрика CTA, как и было в старой хардкод-версии этой кнопки.
        const ctaRubric = await getRubricByKey(post.organization_id, 'cta')
        newText = await generateRubricDraft(settings, ctaRubric ?? rubric)
      } else {
        newText = await generateRubricDraft(settings, rubric)
      }
      const newPostId = await createDraftRow(post.organization_id, post.rubric, post.scheduled_for, { rubricId: rubric.id })
      // CTA-ссылка есть в каждом посте, включая разовые: пост без неё не приносит
      // обращений, а для читателя это единственный способ выйти на агентство.
      await sendDraftForReview(post.organization_id, newPostId, post.rubric, newText, 'dm_admin')
    } catch (e) {
      await sendMessage(chatId, `⚠️ Не удалось перегенерировать: ${e instanceof Error ? e.message : 'ошибка'}`)
    }
    return
  }

  if (action === 'chregenimg') {
    const result = await regenerateImage(postId)
    if (result.error) await sendMessage(chatId, `⚠️ Не удалось перегенерировать картинку: ${result.error}`)
    return
  }

  if (action === 'chpub') {
    const result = await publishPost(postId)
    await sendMessage(chatId, result.error ? `⚠️ Не удалось опубликовать: ${result.error}` : '✅ Опубликовано в канале.')
  }
}

export async function handleChannelListAction(action: string, postId: string, actor: BotActor, messageId: number | undefined) {
  const { chatId, orgId } = actor
  // Роль проверена в диспетчере кнопок (`action:chlist*` — уровень владельца).

  if (action === 'chlistpub') {
    const result = await publishPost(postId)
    if (result.error) await sendMessage(chatId, `⚠️ Не удалось опубликовать: ${result.error}`)
  } else if (action === 'chlistreject') {
    await rejectPost(postId)
  }
  await showMenuScreen(chatId, orgId, 'channel_posts', actor.role, messageId)
}

async function handleCaseInput(chatId: number, orgId: string, rawInput: string) {
  await sendChatAction(chatId, 'typing')
  const settings = await getChannelSettings(orgId)
  try {
    const rubric = await getRubricByKey(orgId, 'case')
    if (!rubric) throw new Error('рубрика «case» не найдена в БД')
    const text = await generateRubricDraft(settings, rubric, rawInput)
    const postId = await createDraftRow(orgId, 'case', null, { rubricId: rubric.id })
    await getSupabaseAdmin().from('channel_posts').update({ source_input: rawInput }).eq('id', postId)
    await sendDraftForReview(orgId, postId, 'case', text, 'dm_admin')
  } catch (e) {
    await sendMessage(chatId, `⚠️ Не удалось оформить кейс: ${e instanceof Error ? e.message : 'ошибка'}`)
  } finally {
    await setAwaitingIntent(orgId, null)
  }
}

async function handleAdhocPostCommand(chatId: number, orgId: string, topic: string) {
  await sendChatAction(chatId, 'typing')
  const settings = await getChannelSettings(orgId)
  try {
    const rubric = await getRubricByKey(orgId, 'adhoc')
    if (!rubric) throw new Error('рубрика «adhoc» не найдена в БД')
    const text = await generateRubricDraft(settings, rubric, topic)
    const postId = await createDraftRow(orgId, 'adhoc', null, { rubricId: rubric.id })
    await sendDraftForReview(orgId, postId, 'adhoc', text, 'dm_admin')
  } catch (e) {
    await sendMessage(chatId, `⚠️ Не удалось сгенерировать пост: ${e instanceof Error ? e.message : 'ошибка'}`)
  } finally {
    await setAwaitingIntent(orgId, null)
  }
}

// Возвращает true, если сообщение было перехвачено под нужды канала (правка/меню/кейс/пост)
// и НЕ должно попадать в обычный CRM-диалог с моделью.
export async function tryHandleChannelInput(
  actor: BotActor,
  text: string,
  replyToMessageId?: number
): Promise<boolean> {
  const { chatId, orgId } = actor
  // Правка черновика канала ответом на сообщение — уровень владельца
  // (`intent:channel_draft` в таблице прав).
  if (!canFulfilIntent(actor.role, 'channel_draft')) return false
  const settings = await getChannelSettings(orgId)

  // Ответ (reply) на сообщение с черновиком — прямая правка текста без обращения к модели,
  // либо (если начинается с "фото:"/"картинка:") — перегенерация картинки с конкретными пожеланиями.
  if (replyToMessageId) {
    const pendingPost = await getPendingReviewByMessageId(replyToMessageId)
    if (pendingPost) {
      await editMessageReplyMarkup(chatId, replyToMessageId, null)
      const imageNote = parseImageNote(text)
      if (imageNote) {
        await sendChatAction(chatId, 'upload_photo')
        const result = await regenerateImage(pendingPost.id, imageNote)
        if (result.error) await sendMessage(chatId, `⚠️ Не удалось перегенерировать картинку: ${result.error}`)
      } else {
        const result = await applyManualEdit(pendingPost.id, text)
        if (result.error) await sendMessage(chatId, `⚠️ Не удалось применить правку: ${result.error}`)
      }
      return true
    }
  }

  // Команды канала убраны 17.09.2026: те же действия есть кнопками в /menu → 📢 Канал,
  // два входа в одно действие путали. Старую команду не глотаем молча.
  if (/^\/(pause|resume|case|post)\b/.test(text)) {
    await sendMessage(chatId, 'Команды канала переехали в меню: /menu → 📢 Канал (пост, кейс, статистика) и ⚙️ Настройки (пауза автопостинга).')
    return true
  }

  if (settings?.awaiting_intent === 'case') {
    await handleCaseInput(chatId, orgId, text)
    return true
  }
  if (settings?.awaiting_intent === 'post') {
    await handleAdhocPostCommand(chatId, orgId, text)
    return true
  }

  return false
}

export async function handleChannelReactionUpdate(update: TelegramUpdate): Promise<boolean> {
  if (!update.message_reaction_count) return false
  const { updatePostReactionCount } = await import('@/lib/telegram/channel')
  const totalCount = update.message_reaction_count.reactions.reduce((sum, r) => sum + r.total_count, 0)
  await updatePostReactionCount(update.message_reaction_count.message_id, totalCount)
  return true
}
