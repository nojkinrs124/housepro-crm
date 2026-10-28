// Точка входа для callback_query: разбор callback_data и диспетчеризация по
// обработчикам кнопок меню/канала/CRM. Вынесено из webhook/route.ts фазой 2
// аудита без изменения поведения.

import type { TelegramUpdate } from '@/lib/telegram/api'
import { answerCallbackQuery, sendMessage } from '@/lib/telegram/api'
import { parseCallbackData } from '@/features/telegram/services/parsing'
import { resolveActor } from '@/lib/telegram/webhook/context'
import { handleNavCallback, handleSettingsAction } from '@/lib/telegram/webhook/handlers/menu'
import { handleScheduleAction, handleRubricAction } from '@/lib/telegram/webhook/handlers/channel-admin'
import { handleChatMenuCallback, handleChannelCallback, handleChannelListAction } from '@/lib/telegram/webhook/handlers/channel-content'
import { handleCrmQuickAction, handleCrmSearchAction, handleIntakeCallback } from '@/lib/telegram/webhook/handlers/crm-actions'
import { handleConfirmOrCancel } from './batch'

export async function handleCallbackQuery(update: NonNullable<TelegramUpdate['callback_query']>) {
  await answerCallbackQuery(update.id)

  const chatId = update.message?.chat.id
  const messageId = update.message?.message_id
  if (!chatId) return

  const parsed = parseCallbackData(update.data)
  if (!parsed) return
  const { action, arg } = parsed

  // Нажавший — это from.id кнопки, а не chat.id. В приватном чате они совпадают,
  // в группе нет, и раньше проверка админа сравнивала admin_telegram_user_id с
  // идентификатором чата — то есть в группе не работала бы вовсе.
  const actor = await resolveActor(String(update.from.id), chatId, update.from.username)
  if (!actor) return
  if (actor.role === 'stranger') {
    await sendMessage(chatId, '⛔ Этот аккаунт не имеет доступа к боту.')
    return
  }

  if (action === 'chmenu') return handleChatMenuCallback(arg, actor)

  if (action === 'nav') return handleNavCallback(arg, actor, messageId)
  if (action === 'set' || action === 'deluser') return handleSettingsAction(action, arg, actor, messageId)
  if (
    action === 'leadnext' || action === 'dealnext' || action === 'paypaid'
    || action === 'ownerpay' || action === 'taskdone' || action === 'tasksnooze'
  ) {
    return handleCrmQuickAction(action, arg, actor, messageId)
  }
  if (action === 'prop' || action === 'cont' || action === 'money') {
    return handleCrmSearchAction(action, arg, actor)
  }
  if (action === 'chlistpub' || action === 'chlistreject') return handleChannelListAction(action, arg, actor, messageId)
  if (action === 'chpub' || action === 'chregen' || action === 'chreject' || action === 'chregenimg') {
    return handleChannelCallback(action, arg, actor, messageId)
  }
  if (action === 'chschedtoggle' || action === 'chscheddel' || action === 'chschedadd') {
    return handleScheduleAction(action, arg, actor, messageId)
  }
  if (action === 'chrubedit' || action === 'chrubtoggle' || action === 'chrubadd' || action === 'chrubimg') {
    return handleRubricAction(action, arg, actor, messageId)
  }
  if (action === 'intake') return handleIntakeCallback(arg, actor)

  if (action === 'confirm' || action === 'cancel') {
    return handleConfirmOrCancel(action, arg, actor, messageId)
  }

  // Неизвестное действие — не молчим. Сюда попадают кнопки из старых сообщений
  // после переименования/удаления действия: раньше такой клик не давал ни
  // ответа, ни ошибки, то есть выглядел как неработающий бот.
  console.warn('[telegram] unknown callback action:', action)
  await sendMessage(chatId, '🔁 Эта кнопка устарела — открой /menu и нажми заново.')
}
