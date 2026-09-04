import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { editMessageText, sendMessage, type InlineKeyboardButton } from '@/lib/telegram/api'
import { getChannelSettings, setSchedulePaused, type ChannelSettings } from '@/lib/telegram/channel'
import {
  buildLeadsScreen,
  buildDealsScreen,
  buildFinanceScreen,
  buildManagementScreen,
  buildTasksScreen,
  buildPropertiesScreen,
  buildContactsScreen,
} from '@/lib/telegram/crm-menu'
import { collectDigest, isQuiet, renderDigest } from '@/features/telegram/services/digest'
import { buildChannelPostsScreen, buildChannelScheduleScreen, buildChannelRubricsScreen } from '@/lib/telegram/channel-menu'
import type { BotRole } from '@/features/telegram/services/access'

// Разделы меню. 'crm_payments' — экран «Деньги» (ключ оставлен прежним, чтобы
// кнопки в уже отправленных сообщениях не превратились в мёртвые).
export type MenuScreen =
  | 'root'
  | 'today'
  | 'crm'
  | 'crm_leads'
  | 'crm_deals'
  | 'crm_properties'
  | 'crm_contacts'
  | 'crm_payments'
  | 'crm_management'
  | 'crm_tasks'
  | 'channel'
  | 'channel_posts'
  | 'channel_schedule'
  | 'channel_rubrics'
  | 'multiagent'
  | 'settings'
  | 'settings_users'

export interface ScreenContent {
  text: string
  keyboard: InlineKeyboardButton[][]
}

const BACK_TO_ROOT: InlineKeyboardButton = { text: '⬅ Главное меню', callback_data: 'nav:root' }

/**
 * Корневой экран показывает только то, что этой роли действительно откроется.
 * Кнопка, которая отвечает отказом, хуже отсутствующей.
 */
function rootScreen(role: BotRole): ScreenContent {
  const keyboard: InlineKeyboardButton[][] = [[{ text: '⚡ Сегодня', callback_data: 'nav:today' }]]

  if (role === 'admin') {
    keyboard.push([
      { text: '📋 CRM', callback_data: 'nav:crm' },
      { text: '📢 Канал', callback_data: 'nav:channel' },
    ])
    keyboard.push([{ text: '⚙️ Настройки', callback_data: 'nav:settings' }])
  } else {
    keyboard.push([{ text: '📋 CRM', callback_data: 'nav:crm' }])
  }

  // Помощь была третьей дверью к одному и тому же тексту (/start, /help, кнопка).
  // Осталась подсказкой: кнопку в корне занимала зря.
  return {
    text:
      '🏠 <b>Главное меню HousePro</b>\nВыбери раздел.\n\n' +
      '<i>Можно и без меню: напиши или надиктуй, что нужно, пришли фото чека или ' +
      'документ — разберу сам. Что умею — /help.</i>',
    keyboard,
  }
}

/**
 * «⚡ Сегодня» — то же, что бот присылает утром сам, но по запросу.
 * Данные собирает общий с кроном сервис: две копии запросов разъехались бы.
 */
async function todayScreen(orgId: string, role: BotRole): Promise<ScreenContent> {
  const digest = await collectDigest(orgId)

  if (isQuiet(digest)) {
    return {
      text: '⚡ <b>Сегодня</b>\n\nНичего не горит: просроченных начислений нет, задачи со сроком закрыты, лиды без ответа не залежались.',
      keyboard: [[BACK_TO_ROOT]],
    }
  }

  const keyboard: InlineKeyboardButton[][] = []
  const row: InlineKeyboardButton[] = []
  if (digest.tasksDue.length) row.push({ text: '✅ К задачам', callback_data: 'nav:crm_tasks' })
  if (digest.staleLeads.length) row.push({ text: '🧲 К лидам', callback_data: 'nav:crm_leads' })
  if (row.length) keyboard.push(row)
  // Деньги — раздел владельца, сотруднику эту кнопку не показываем (экран ему
  // всё равно не откроется, а кнопка-отказ хуже отсутствующей).
  if (digest.overduePayments.length && role === 'admin') {
    keyboard.push([{ text: '💰 К деньгам', callback_data: 'nav:crm_payments' }])
  }
  keyboard.push([BACK_TO_ROOT])

  return { text: ['⚡ <b>Сегодня</b>', ...renderDigest(digest)].join('\n\n'), keyboard }
}

function crmScreen(role: BotRole): ScreenContent {
  const keyboard: InlineKeyboardButton[][] = [
    [
      { text: '🧲 Лиды', callback_data: 'nav:crm_leads' },
      { text: '🤝 Сделки', callback_data: 'nav:crm_deals' },
    ],
    [
      { text: '🏠 Объекты', callback_data: 'nav:crm_properties' },
      { text: '👤 Контакты', callback_data: 'nav:crm_contacts' },
    ],
    [{ text: '✅ Задачи', callback_data: 'nav:crm_tasks' }],
  ]
  // Деньги и анализ рынка — владельцу: первое показывает выручку агентства,
  // второе тратит платный веб-поиск.
  if (role === 'admin') {
    keyboard.push([
      { text: '💰 Деньги', callback_data: 'nav:crm_payments' },
      { text: '🏢 Управление', callback_data: 'nav:crm_management' },
    ])
    keyboard.push([{ text: '🔎 Анализ рынка', callback_data: 'nav:multiagent' }])
  }
  keyboard.push([BACK_TO_ROOT])

  return { text: '📋 <b>CRM</b>\nВыбери раздел:', keyboard }
}

function marketResearchScreen(): ScreenContent {
  return {
    text:
      '🔎 <b>Анализ рынка</b>\n\n' +
      'Делегируй составную задачу на анализ рынка — бот включит веб-поиск, соберёт данные ' +
      'и вернёт сводку с источниками. Например: «сравни наши цены на аренду 2к на Ленина с рынком ' +
      'в этом районе» или «какие новые правила ипотеки вступают в силу».\n\n' +
      'То же самое можно спросить и прямо в обычном диалоге с ботом, без меню.',
    keyboard: [[{ text: '🔎 Задать вопрос по рынку', callback_data: 'magent:research' }], [{ text: '⬅ CRM', callback_data: 'nav:crm' }]],
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
      [{ text: '🗂 Последние посты', callback_data: 'nav:channel_posts' }],
      [
        { text: '⏰ Расписание', callback_data: 'nav:channel_schedule' },
        { text: '✍️ Рубрики', callback_data: 'nav:channel_rubrics' },
      ],
      [BACK_TO_ROOT],
    ],
  }
}

function settingsScreen(settings: ChannelSettings | null): ScreenContent {
  const paused = settings?.schedule_paused ?? false
  const tz = settings?.timezone ?? 'Etc/GMT-7'

  return {
    // Управление ботом собрано в одном месте: раньше пауза жила здесь, а
    // расписание и рубрики — в разделе «Канал», и текст настроек сам отсылал
    // читателя в другой раздел.
    text:
      '⚙️ <b>Настройки</b>\n\n' +
      `Автопостинг в канал: ${paused ? '⏸ на паузе' : '▶️ включён'}\n` +
      `Часовой пояс: <code>${tz}</code>`,
    keyboard: [
      [paused
        ? { text: '▶️ Возобновить автопостинг', callback_data: 'set:resume' }
        : { text: '⏸ Приостановить автопостинг', callback_data: 'set:pause' }],
      [
        { text: '⏰ Расписание', callback_data: 'nav:channel_schedule' },
        { text: '✍️ Рубрики', callback_data: 'nav:channel_rubrics' },
      ],
      [
        { text: '👥 Доступ к боту', callback_data: 'nav:settings_users' },
        { text: '🌍 Часовой пояс', callback_data: 'set:timezone' },
      ],
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

async function buildScreen(screen: MenuScreen, orgId: string, role: BotRole, page: number): Promise<ScreenContent> {
  switch (screen) {
    case 'root':
      return rootScreen(role)
    case 'today':
      return todayScreen(orgId, role)
    case 'crm':
      return crmScreen(role)
    case 'crm_leads':
      return buildLeadsScreen(orgId, page)
    case 'crm_deals':
      return buildDealsScreen(orgId, page)
    case 'crm_properties':
      return buildPropertiesScreen(orgId, page)
    case 'crm_contacts':
      return buildContactsScreen(orgId, page)
    case 'crm_payments':
      return buildFinanceScreen(orgId, page)
    case 'crm_management':
      return buildManagementScreen(orgId, page)
    case 'crm_tasks':
      return buildTasksScreen(orgId, page)
    case 'multiagent':
      return marketResearchScreen()
    case 'channel':
      return channelScreen()
    case 'channel_posts':
      return buildChannelPostsScreen(orgId)
    case 'channel_schedule':
      return buildChannelScheduleScreen(orgId)
    case 'channel_rubrics':
      return buildChannelRubricsScreen(orgId)
    case 'settings':
      return settingsScreen(await getChannelSettings(orgId))
    case 'settings_users':
      return settingsUsersScreen(orgId)
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
  role: BotRole,
  knownMessageId?: number,
  page = 0
): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin()
  const content = await buildScreen(screen, orgId, role, page)
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

/**
 * Часовой пояс организации — от него зависит, в котором часу приходят
 * черновики по расписанию. Раньше он показывался в настройках, но менялся
 * только правкой строки в базе: строка без действия.
 */
export async function setTimezone(orgId: string, timezone: string): Promise<{ error?: string }> {
  const supabaseAdmin = getSupabaseAdmin()
  const { error } = await supabaseAdmin
    .from('channel_bot_settings')
    .update({ timezone, updated_at: new Date().toISOString() })
    .eq('organization_id', orgId)
  return { error: error?.message }
}

export async function setAddUserAwaiting(orgId: string, awaiting: boolean, ownerUserId?: string): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin()
  await supabaseAdmin
    .from('channel_bot_settings')
    .update({
      awaiting_intent: awaiting ? 'add_bot_user' : null,
      awaiting_intent_user_id: awaiting ? (ownerUserId ?? null) : null,
    })
    .eq('organization_id', orgId)
}
