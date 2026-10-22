// Перехват текстового ввода, которого бот ждёт после определённых кнопок:
// добавление допущенного пользователя, добавление слота расписания, правка
// промпта/стиля картинки рубрики, добавление новой рубрики.
// Вынесено из webhook/route.ts фазой 2 аудита без изменения поведения.

import { sendMessage } from '@/lib/telegram/api'
import { addAllowedUser, setAddUserAwaiting, showMenuScreen } from '@/lib/telegram/menu'
import {
  getChannelSettings,
  setAwaitingIntent,
  getRubrics,
  addScheduleSlot,
  addRubric,
  updateRubricPrompt,
  updateRubricImageStyle,
  getRubricById,
  createDraftRow,
  sendDraftForReview,
  type ChannelRubric,
} from '@/lib/telegram/channel'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { generateRubricDraft } from '@/lib/telegram/channel-generate'
import {
  parseAddUserInput,
  parseScheduleSlot,
  parseRubricInput,
  parseImageStyle,
} from '@/features/telegram/services/parsing'
import { ownsIntent, type BotActor } from '@/features/telegram/services/access'
import { sendChatAction } from '@/lib/telegram/api'

// Обрабатывает текст, который бот ждёт после "➕ Добавить пользователя": пересланное
// сообщение (forward_from) или "<telegram_id> [подпись]" текстом. Возвращает true, если
// ввод был перехвачен под эту нужду (и не должен уходить в обычный CRM-диалог).
export async function tryHandleAddUserInput(actor: BotActor, text: string, forwardFromId?: number, forwardFromName?: string): Promise<boolean> {
  const { chatId, orgId } = actor
  const settings = await getChannelSettings(orgId)
  if (settings?.awaiting_intent !== 'add_bot_user') return false

  // Форма выдаёт полный доступ к боту, а её состояние — одно на организацию.
  // Без этих двух проверок текст постороннего разбирался как ответ на неё, и
  // он мог вписать в допущенные кого угодно, включая себя.
  if (actor.role !== 'admin') return false
  if (!ownsIntent(actor.telegramUserId, settings.awaiting_intent_user_id)) return false

  const parsed = parseAddUserInput(text, forwardFromId, forwardFromName)
  if (!parsed.ok) {
    await sendMessage(chatId, parsed.error)
    return true
  }

  const { telegramUserId, label } = parsed.value
  const result = await addAllowedUser(orgId, telegramUserId, label)
  await setAddUserAwaiting(orgId, false)
  if (result.error) {
    await sendMessage(chatId, `⚠️ Не удалось добавить: ${result.error}`)
  } else {
    await sendMessage(chatId, `✅ Добавлено: ${label || telegramUserId} (${telegramUserId})`)
  }
  await showMenuScreen(chatId, orgId, 'settings_users', actor.role)
  return true
}

// Перехватывает текст, если бот ждёт добавление слота ('add_slot') или новый промпт
// рубрики ('edit_rubric:<id>') — awaiting_intent выставляется кнопками раздела
// «⏰ Расписание»/«✍️ Рубрики» (handlers/channel-admin.ts). Возвращает true, если
// ввод был перехвачен.
export async function tryHandleScheduleOrRubricInput(actor: BotActor, text: string): Promise<boolean> {
  const { chatId, orgId } = actor

  // Команды (/menu, /pause, /case и т.п.) не должны глотаться "застрявшим" awaiting_intent —
  // иначе после незавершённого добавления слота/правки промпта бот перестаёт реагировать
  // на команды, пока их случайно не распознает как невалидный ввод формы.
  if (text.startsWith('/')) return false

  const settings = await getChannelSettings(orgId)
  const intent = settings?.awaiting_intent
  if (!intent) return false

  // Эти формы правят расписание и промпты, по которым бот пишет в публичный
  // канал, и запускают платный веб-поиск. Состояние одно на организацию,
  // поэтому чужой текст в него подставляться не должен.
  if (actor.role !== 'admin') return false
  if (!ownsIntent(actor.telegramUserId, settings.awaiting_intent_user_id)) return false

  if (intent === 'add_slot') {
    const rubrics = await getRubrics(orgId)
    const parsed = parseScheduleSlot(text, rubrics)
    if (!parsed.ok) {
      await sendMessage(chatId, parsed.error)
      return true
    }
    const { dayKey, dayLabel, time, rubricKey } = parsed.value
    const rubric = rubrics.find(r => r.key === rubricKey)!
    const result = await addScheduleSlot(orgId, rubric.id, dayKey, time)
    await setAwaitingIntent(orgId, null)
    if (result.error) {
      await sendMessage(chatId, `⚠️ Не удалось добавить слот: ${result.error}`)
    } else {
      await sendMessage(chatId, `✅ Слот добавлен: ${dayLabel} ${time} — ${rubric.label}`)
    }
    await showMenuScreen(chatId, orgId, 'channel_schedule', actor.role)
    return true
  }

  if (intent === 'add_rubric') {
    const parsed = parseRubricInput(text)
    if (!parsed.ok) {
      await sendMessage(chatId, parsed.error)
      return true
    }
    const { key, label, prompt } = parsed.value
    const result = await addRubric(orgId, key, label, prompt)
    await setAwaitingIntent(orgId, null)
    if (result.error) {
      await sendMessage(chatId, `⚠️ Не удалось добавить рубрику: ${result.error}`)
    } else {
      await sendMessage(chatId, `✅ Рубрика «${label}» добавлена.`)
    }
    await showMenuScreen(chatId, orgId, 'channel_rubrics', actor.role)
    return true
  }

  if (intent.startsWith('edit_rubric:')) {
    const rubricId = intent.slice('edit_rubric:'.length)
    const result = await updateRubricPrompt(rubricId, text.trim())
    await setAwaitingIntent(orgId, null)
    if (result.error) {
      await sendMessage(chatId, `⚠️ Не удалось сохранить промпт: ${result.error}`)
    } else {
      await sendMessage(chatId, '✅ Промпт рубрики обновлён.')
    }
    await showMenuScreen(chatId, orgId, 'channel_rubrics', actor.role)
    return true
  }

  if (intent.startsWith('edit_rubric_image:')) {
    const rubricId = intent.slice('edit_rubric_image:'.length)
    const value = parseImageStyle(text)
    const result = await updateRubricImageStyle(rubricId, value)
    await setAwaitingIntent(orgId, null)
    if (result.error) {
      await sendMessage(chatId, `⚠️ Не удалось сохранить стиль картинки: ${result.error}`)
    } else {
      await sendMessage(chatId, value ? '✅ Стиль картинки для рубрики обновлён.' : '✅ Стиль картинки сброшен на общий.')
    }
    await showMenuScreen(chatId, orgId, 'channel_rubrics', actor.role)
    return true
  }

  // Кастомные requires_input-рубрики (не 'case'/'post', у которых свой отдельный флоу выше
  // по файлу) — единая точка входа для генерации по тексту от админа, независимо от того,
  // сколько таких рубрик заведено через "➕ Новая рубрика".
  if (intent.startsWith('input_rubric:')) {
    const rubricId = intent.slice('input_rubric:'.length)
    await setAwaitingIntent(orgId, null)
    const rubric = await getRubricById(rubricId)
    if (!rubric) {
      await sendMessage(chatId, '⚠️ Рубрика не найдена (возможно, удалена).')
      return true
    }
    await sendChatAction(chatId, 'typing')
    const settings2 = await getChannelSettings(orgId)
    try {
      const draftText = await generateRubricDraft(settings2, rubric, text)
      const postId = await createDraftRow(orgId, rubric.key as ChannelRubric, null, { rubricId: rubric.id })
      await getSupabaseAdmin().from('channel_posts').update({ source_input: text }).eq('id', postId)
      await sendDraftForReview(orgId, postId, rubric.key as ChannelRubric, draftText, 'dm_admin')
    } catch (e) {
      await sendMessage(chatId, `⚠️ Не удалось сгенерировать черновик: ${e instanceof Error ? e.message : 'ошибка'}`)
    }
    return true
  }

  return false
}
