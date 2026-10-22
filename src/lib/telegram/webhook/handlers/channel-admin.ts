// Действия в разделах «⏰ Расписание» и «✍️ Рубрики» контент-ассистента канала.
// Вынесено из webhook/route.ts фазой 2 аудита без изменения поведения.

import { showMenuScreen } from '@/lib/telegram/menu'
import { sendMessage } from '@/lib/telegram/api'
import {
  getChannelSettings,
  setAwaitingIntent,
  getRubrics,
  getRubricById,
  toggleRubricActive,
  deleteScheduleSlot,
  toggleScheduleSlot,
  getScheduleWithRubrics,
} from '@/lib/telegram/channel'
import type { BotActor } from '@/features/telegram/services/access'
import { denyAdmin } from '@/lib/telegram/webhook/context'

// Действия в разделе "⏰ Расписание": toggle/delete слота, + запрос на добавление нового.
export async function handleScheduleAction(action: string, arg: string, actor: BotActor, messageId: number | undefined) {
  const { chatId, orgId } = actor
  if (actor.role !== 'admin') return denyAdmin(chatId)

  if (action === 'chschedtoggle') {
    // текущее состояние неизвестно без чтения — просто читаем список заново после переключения,
    // проще прочитать текущий enabled прямо тут не нужно: toggle делает инверсию на уровне запроса.
    const slots = await getScheduleWithRubrics(orgId)
    const slot = slots.find((s) => s.id === arg)
    if (slot) await toggleScheduleSlot(arg, !slot.enabled)
    await showMenuScreen(chatId, orgId, 'channel_schedule', actor.role, messageId)
    return
  }
  if (action === 'chscheddel') {
    await deleteScheduleSlot(arg)
    await showMenuScreen(chatId, orgId, 'channel_schedule', actor.role, messageId)
    return
  }
  if (action === 'chschedadd') {
    await setAwaitingIntent(orgId, 'add_slot', actor.telegramUserId)
    const rubrics = await getRubrics(orgId)
    const rubricList = rubrics.map((r) => `• ${r.label} — <code>${r.key}</code>`).join('\n')
    await sendMessage(
      chatId,
      '➕ Пришли одной строкой: день, время (ЧЧ:ММ) и рубрику.\n' +
        'День — как удобно: <code>вс</code>, <code>вск</code> или <code>воскресенье</code>.\n' +
        'Рубрику — ключом или названием.\n\n' +
        `${rubricList}\n\n` +
        'Например: <code>вс 19:00 cta</code>\n' +
        'Нужной рубрики нет — заведи её кнопкой «➕ Новая рубрика».'
    )
    return
  }
}

// Действия в разделе "✍️ Рубрики": показать/начать правку промпта, вкл/выкл рубрику.
export async function handleRubricAction(action: string, rubricId: string, actor: BotActor, messageId: number | undefined) {
  const { chatId, orgId } = actor
  if (actor.role !== 'admin') return denyAdmin(chatId)

  if (action === 'chrubtoggle') {
    const rubric = await getRubricById(rubricId)
    if (rubric) await toggleRubricActive(rubricId, !rubric.active)
    await showMenuScreen(chatId, orgId, 'channel_rubrics', actor.role, messageId)
    return
  }
  if (action === 'chrubedit') {
    const rubric = await getRubricById(rubricId)
    if (!rubric) return
    await setAwaitingIntent(orgId, `edit_rubric:${rubricId}`, actor.telegramUserId)
    await sendMessage(
      chatId,
      `<b>${rubric.label}</b>\n\nТекущий промпт:\n<i>${rubric.prompt_template}</i>\n\n` +
        '✏️ Ответь на это сообщение новым текстом промпта, чтобы заменить его.'
    )
    return
  }
  if (action === 'chrubimg') {
    const rubric = await getRubricById(rubricId)
    if (!rubric) return
    await setAwaitingIntent(orgId, `edit_rubric_image:${rubricId}`, actor.telegramUserId)
    await sendMessage(
      chatId,
      `<b>${rubric.label}</b> — стиль картинки\n\n` +
        `Сейчас: <i>${rubric.image_style_override ?? 'не задан (общий фотореалистичный стиль)'}</i>\n\n` +
        '🖼 Ответь на это сообщение текстом стиля (например «в тёплых тонах, минимализм») или пришли «-», чтобы сбросить.'
    )
    return
  }
  if (action === 'chrubadd') {
    await setAwaitingIntent(orgId, 'add_rubric', actor.telegramUserId)
    await sendMessage(
      chatId,
      '➕ Пришли одной строкой: key | Название | текст промпта.\n' +
        'Например: <code>listing | 🏠 Объект дня | Расскажи об одном актуальном объекте из базы.</code>'
    )
    return
  }
}
