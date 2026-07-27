import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { editMessageText, sendMessage, type InlineKeyboardButton } from '@/lib/telegram/api'
import { getChannelSettings, setSchedulePaused, type ChannelSettings } from '@/lib/telegram/channel'

// Разделы главного меню. 'crm' и 'multiagent' пока заглушки (фаза 2 и 4 роадмапа),
// 'channel' и 'settings' — рабочие разделы.
export type MenuScreen = 'root' | 'crm' | 'channel' | 'multiagent' | 'settings' | 'settings_users' | 'help'

interface ScreenContent {
  text: string
  keyboard: InlineKeyboardButton[][]
}

const BACK_TO_ROOT: InlineKeyboardButton = { text: '⬅ Главное меню', callback_data: 'nav:root' }

function rootScreen(): ScreenContent {
  return {
    text: '🏠 <b>Главное меню HousePro</b>\nВыбери раздел:',
    keyboard: [
      [
        { text: '📋 CRM', callback_data: 'nav:crm' },
        { text: '📢 Канал', callback_data: 'nav:channel' },
      ],
      [{ text: '🤖 Мультиагент', callback_data: 'nav:multiagent' }],
      [
        { text: '⚙️ Настройки', callback_data: 'nav:settings' },
        { text: '❓ Помощь', callback_data: 'nav:help' },
      ],
    ],
  }
}

function crmScreen(): ScreenContent {
  return {
    text:
      '📋 <b>CRM</b>\n\n' +
      'Раздел с кнопками для CRM (лиды, сделки, объекты, оплаты) в разработке.\n' +
      'Пока всё это работает через обычный текст — просто напиши, что нужно ' +
      '("добавь лида...", "какие сделки в работе?" и т.п.), я отвечу или спрошу подтверждение.',
    keyboard: [[BACK_TO_ROOT]],
  }
}

function multiagentScreen(): ScreenContent {
  return {
    text:
      '🤖 <b>Мультиагент</b>\n\n' +
      'Раздел в разработке: сможешь делегировать боту составные задачи ' +
      '(например, сбор аналитики по рынку с нескольких площадок), а он сам ' +
      'разобьёт их между несколькими агентами.',
    keyboard: [[BACK_TO_ROOT]],
  }
}

function channelScreen(): ScreenContent {
  return {
    text:
      '📢 <b>Канал</b>\nВыбери действие:',
    keyboard: [
      [
        { text: '📝 Разовый пост', callback_data: 'chmenu:post' },
        { text: '🎙 Кейс из практики', callback_data: 'chmenu:case' },
      ],
      [{ text: '📊 Статистика', callback_data: 'chmenu:stats' }],
      [BACK_TO_ROOT],
    ],
  }
}

function settingsScreen(settings: ChannelSettings | null): ScreenContent {
  const paused = settings?.schedule_paused ?? false
  const tz = settings?.timezone ?? 'Etc/GMT-7'
  const hour = settings?.draft_send_hour ?? 19

  return {
    text:
      '⚙️ <b>Настройки</b>\n\n' +
      `Автопостинг в канал: ${paused ? '⏸ на паузе' : '▶️ включён'}\n` +
      `Часовой пояс: ${tz}\n` +
      `Время отправки черновика: ${hour}:00`,
    keyboard: [
      [paused
        ? { text: '▶️ Возобновить автопостинг', callback_data: 'set:resume' }
        : { text: '⏸ Приостановить автопостинг', callback_data: 'set:pause' }],
      [{ text: '👥 Доступ к боту', callback_data: 'nav:settings_users' }],
      [BACK_TO_ROOT],
    ],
  }
}

async function settingsUsersScreen(orgId: string): Promise<ScreenContent> {
  const users = await listAllowedUsers(orgId)
  const lines = users.length
    ? users.map((u) => `• ${u.label || '(без подписи)'} — <code>${u.telegram_user_id}</code>`).join('\n')
    : 'Пока никого, кроме тебя как админа канала.'

  const keyboard: InlineKeyboardButton[][] = users.map((u) => [
    { text: `➖ Убрать ${u.label || u.telegram_user_id}`, callback_data: `deluser:${u.telegram_user_id}` },
  ])
  keyboard.push([{ text: '➕ Добавить пользователя', callback_data: 'set:adduser' }])
  keyboard.push([{ text: '⬅ Назад', callback_data: 'nav:settings' }])

  return {
    text: `👥 <b>Доступ к боту</b>\n\n${lines}`,
    keyboard,
  }
}

function helpScreen(helpText: string): ScreenContent {
  return { text: helpText, keyboard: [[BACK_TO_ROOT]] }
}

async function buildScreen(screen: MenuScreen, orgId: string, helpText: string): Promise<ScreenContent> {
  switch (screen) {
    case 'root':
      return rootScreen()
    case 'crm':
      return crmScreen()
    case 'multiagent':
      return multiagentScreen()
    case 'channel':
      return channelScreen()
    case 'settings':
      return settingsScreen(await getChannelSettings(orgId))
    case 'settings_users':
      return settingsUsersScreen(orgId)
    case 'help':
      return helpScreen(helpText)
  }
}

/**
 * Показывает экран меню: если у чата уже есть сообщение-меню — перерисовывает его,
 * иначе отправляет новое и запоминает его id. Один "экран" на чат, без мусора в истории.
 */
export async function showMenuScreen(
  chatId: number,
  orgId: string,
  screen: MenuScreen,
  helpText: string,
  knownMessageId?: number
): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin()
  const content = await buildScreen(screen, orgId, helpText)
  const chatIdStr = String(chatId)

  let messageId = knownMessageId
  if (!messageId) {
    const { data } = await supabaseAdmin
      .from('bot_menu_state')
      .select('menu_message_id')
      .eq('telegram_chat_id', chatIdStr)
      .maybeSingle()
    messageId = data?.menu_message_id ?? undefined
  }

  let finalMessageId = messageId
  const edited = messageId ? await editMessageText(chatId, messageId, content.text, { inlineKeyboard: content.keyboard }) : false

  if (!edited) {
    const sent = await sendMessage(chatId, content.text, { inlineKeyboard: content.keyboard })
    finalMessageId = sent?.result?.message_id ?? finalMessageId
  }

  await supabaseAdmin.from('bot_menu_state').upsert(
    {
      telegram_chat_id: chatIdStr,
      organization_id: orgId,
      current_screen: screen,
      menu_message_id: finalMessageId ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'telegram_chat_id' }
  )
}

// --- Доступ к боту (bot_allowed_users) ---

export interface AllowedUser {
  telegram_user_id: string
  label: string | null
}

export async function listAllowedUsers(orgId: string): Promise<AllowedUser[]> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data } = await supabaseAdmin
    .from('bot_allowed_users')
    .select('telegram_user_id, label')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: true })
  return data ?? []
}

export async function addAllowedUser(orgId: string, telegramUserId: string, label?: string): Promise<{ error?: string }> {
  const supabaseAdmin = getSupabaseAdmin()
  const { error } = await supabaseAdmin
    .from('bot_allowed_users')
    .upsert({ telegram_user_id: telegramUserId, organization_id: orgId, label: label ?? null }, { onConflict: 'telegram_user_id' })
  return { error: error?.message }
}

export async function removeAllowedUser(orgId: string, telegramUserId: string): Promise<{ error?: string }> {
  const supabaseAdmin = getSupabaseAdmin()
  const { error } = await supabaseAdmin
    .from('bot_allowed_users')
    .delete()
    .eq('telegram_user_id', telegramUserId)
    .eq('organization_id', orgId)
  return { error: error?.message }
}

export async function setAddUserAwaiting(orgId: string, awaiting: boolean): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin()
  await supabaseAdmin
    .from('channel_bot_settings')
    .update({ awaiting_intent: awaiting ? 'add_bot_user' : null })
    .eq('organization_id', orgId)
}
