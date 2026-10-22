// Навигация верхнеуровневого меню и админские настройки/расписание/рубрики, вызываемые
// кнопками. Вынесено из webhook/route.ts фазой 2 аудита без изменения поведения.

import {
  showMenuScreen,
  removeAllowedUser,
  setAddUserAwaiting,
  type MenuScreen,
} from '@/lib/telegram/menu'
import { sendMessage } from '@/lib/telegram/api'
import {
  getChannelSettings,
  setAwaitingIntent,
  setSchedulePaused,
} from '@/lib/telegram/channel'
import { canOpenScreen, type BotActor } from '@/features/telegram/services/access'
import { denyAdmin } from '@/lib/telegram/webhook/context'

export async function sendMainMenu(actor: BotActor) {
  await showMenuScreen(actor.chatId, actor.orgId, 'root', actor.role)
}

export const NAV_SCREENS: MenuScreen[] = ['root', 'today', 'crm', 'crm_leads', 'crm_deals', 'crm_properties', 'crm_contacts', 'crm_payments', 'crm_management', 'crm_tasks', 'crm_intake', 'channel', 'channel_posts', 'channel_schedule', 'channel_rubrics', 'settings', 'settings_users']

// Навигация верхнеуровневого меню: nav:<screen>[:<страница>] — перерисовывает "экран"
// в том же сообщении. Номер страницы нужен кнопке «⬇ Ещё» в длинных списках.
export async function handleNavCallback(arg: string, actor: BotActor, messageId: number | undefined) {
  const { chatId, orgId } = actor
  const [screen, pageRaw] = arg.split(':')
  const page = Math.max(0, Number(pageRaw) || 0)
  if (!NAV_SCREENS.includes(screen as MenuScreen)) return
  if (!canOpenScreen(actor.role, screen)) return denyAdmin(chatId)
  const settings = await getChannelSettings(orgId)
  // Навигация по меню = отказ от любого незавершённого текстового ввода (добавление слота,
  // правка промпта/картинки и т.п.) — иначе застрявший awaiting_intent потом глотает команды.
  if (settings?.awaiting_intent) await setAwaitingIntent(orgId, null)
  await showMenuScreen(chatId, orgId, screen as MenuScreen, actor.role, messageId, page)
}

// Действия внутри раздела "Настройки": set:pause / set:resume / set:adduser, а также deluser:<id>.
export async function handleSettingsAction(action: string, arg: string | undefined, actor: BotActor, messageId: number | undefined) {
  const { chatId, orgId } = actor
  if (actor.role !== 'admin') return denyAdmin(chatId)

  if (action === 'set' && arg === 'pause') {
    await setSchedulePaused(orgId, true)
    await showMenuScreen(chatId, orgId, 'settings', actor.role, messageId)
    return
  }
  if (action === 'set' && arg === 'resume') {
    await setSchedulePaused(orgId, false)
    await showMenuScreen(chatId, orgId, 'settings', actor.role, messageId)
    return
  }
  if (action === 'set' && arg === 'adduser') {
    await setAddUserAwaiting(orgId, true, actor.telegramUserId)
    await sendMessage(
      chatId,
      '➕ Перешли мне любое сообщение от нужного человека (чтобы я узнал его Telegram ID), ' +
        'или пришли его ID числом — при желании через пробел подпись, например:\n<code>395803926 Ольга, риелтор</code>'
    )
    return
  }
  if (action === 'set' && arg === 'timezone') {
    await setAwaitingIntent(orgId, 'set_timezone', actor.telegramUserId)
    await sendMessage(
      chatId,
      '🌍 Пришли часовой пояс одним сообщением: смещение (<code>UTC+7</code>) или имя зоны ' +
        '(<code>Europe/Moscow</code>, <code>Asia/Krasnoyarsk</code>).\n\n' +
        'От него зависит, в котором часу приходят черновики по расписанию.'
    )
    return
  }
  if (action === 'deluser' && arg) {
    await removeAllowedUser(orgId, arg)
    await showMenuScreen(chatId, orgId, 'settings_users', actor.role, messageId)
    return
  }
}
