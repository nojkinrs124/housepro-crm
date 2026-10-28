/**
 * Одна таблица прав Telegram-бота.
 *
 * До 28.10.2026 доступ решался в ТРЁХ местах, и каждое жило своей жизнью:
 *  1. `MEMBER_SCREENS` — какие экраны меню открывает сотрудник;
 *  2. `ADMIN_ONLY_TOOLS` — какие инструменты ассистента закрыты сотруднику
 *     (появился позже и именно потому, что первого списка не хватило);
 *  3. россыпь `if (actor.role !== 'admin')` в обработчиках кнопок и форм —
 *     и её легко было забыть: так нашёлся P0 «сотрудник видит оборот агентства».
 *
 * Теперь право — это ключ в ОДНОЙ таблице, а роли читаются одинаково для экранов,
 * инструментов, кнопок, форм ожидания ввода и команд. Добавляя возможность,
 * которой нужна роль, ты добавляешь строку СЮДА; в обработчике вызывается
 * `can(role, ...)` и ничего больше. Ключа нет в таблице — доступа нет (default deny):
 * забыть строку можно, но «забыть проверку» уже нельзя.
 *
 * Правило по смыслу, а не по механике: закрыто то, что показывает владельцу
 * деньги агентства, настройки бота, публичный канал и живые выплаты. Работа
 * сотрудника (лиды, сделки, объекты, контакты, задачи, занесение в CRM,
 * показания счётчиков, поиск) открыта.
 *
 * Файл без 'use client' и без импортов: его можно проверять тестом без базы.
 */

export type BotRole = 'admin' | 'member' | 'stranger'

/** Минимальная роль, с которой право доступно. `stranger` прав не имеет никогда. */
export type RoleRequirement = 'member' | 'admin'

/**
 * Ключи прав:
 *  • `screen:<экрана>`   — экран меню (`MenuScreen` из lib/telegram/menu.ts);
 *  • `tool:<имени>`      — инструмент ассистента И мутирующее действие
 *                          (у обоих одно имя из `TOOL_DEFINITIONS`);
 *  • `action:<кнопка>`   — кнопка, у которой роль не следует из экрана;
 *  • `intent:<ожидание>` — форма, ждущая следующий текст (`awaiting_intent`);
 *  • `command:<команда>` — slash-команда;
 *  • `prompt:<блок>`     — блок системного промпта.
 */
export const CAPABILITIES: Record<string, RoleRequirement> = {
  // ── Экраны меню ────────────────────────────────────────────────────────────
  'screen:root': 'member',
  'screen:today': 'member',
  'screen:crm': 'member',
  'screen:crm_leads': 'member',
  'screen:crm_deals': 'member',
  'screen:crm_properties': 'member',
  'screen:crm_contacts': 'member',
  'screen:crm_tasks': 'member',
  // Завести арендатора или собственника по документам — работа сотрудника.
  'screen:crm_intake': 'member',

  // Деньги и управление — оборот агентства целиком, раздел владельца.
  'screen:crm_payments': 'admin',
  'screen:crm_management': 'admin',
  // Канал: здесь правятся промпты, по которым бот пишет публично.
  'screen:channel': 'admin',
  'screen:channel_posts': 'admin',
  'screen:channel_schedule': 'admin',
  'screen:channel_rubrics': 'admin',
  // Настройки бота, список допущенных, часовой пояс, пауза расписания.
  'screen:settings': 'admin',
  'screen:settings_users': 'admin',

  // ── Инструменты ассистента ─────────────────────────────────────────────────
  'tool:get_deals': 'member',
  'tool:list_properties': 'member',
  'tool:get_client': 'member',
  'tool:list_tasks': 'member',
  'tool:list_overdue_payments': 'member', // сотрудник собирает аренду — это его работа
  'tool:get_meters': 'member',
  'tool:market_research': 'member',
  'tool:create_lead': 'member',
  'tool:create_property': 'member',
  'tool:update_property_status': 'member',
  'tool:update_deal_status': 'member',
  'tool:create_task': 'member',
  'tool:complete_task': 'member',
  'tool:add_meter_readings': 'member',
  'tool:add_transaction': 'member',
  // Деньги агентства и публичный канал — владелец.
  'tool:get_finance_summary': 'admin',
  'tool:get_finance_chart': 'admin',
  'tool:create_channel_post': 'admin',
  'tool:get_channel_stats': 'admin',

  // ── Кнопки, чья роль не следует из экрана ──────────────────────────────────
  'action:leadnext': 'member',
  'action:dealnext': 'member',
  'action:paypaid': 'member',
  'action:taskdone': 'member',
  'action:tasksnooze': 'member',
  'action:intake': 'member',
  // Выплата собственнику — движение живых денег.
  'action:ownerpay': 'admin',
  // Поиск по базе — работа сотрудника; запись операции — раздел владельца.
  'action:prop:find': 'member',
  'action:cont:find': 'member',
  'action:money:add': 'admin',
  'action:money:chart': 'admin',
  // Публикация и правка постов канала.
  'action:chmenu': 'admin',
  'action:chlistpub': 'admin',
  'action:chlistreject': 'admin',
  'action:chpub': 'admin',
  'action:chregen': 'admin',
  'action:chreject': 'admin',
  'action:chregenimg': 'admin',
  // Расписание и рубрики канала.
  'action:chschedtoggle': 'admin',
  'action:chscheddel': 'admin',
  'action:chschedadd': 'admin',
  'action:chrubedit': 'admin',
  'action:chrubtoggle': 'admin',
  'action:chrubadd': 'admin',
  'action:chrubimg': 'admin',
  // Все действия раздела «Настройки» (пауза расписания, допуск, часовой пояс).
  'action:set': 'admin',
  'action:deluser': 'admin',

  // ── Формы, ждущие следующий текст (awaiting_intent) ───────────────────────
  'intent:add_bot_user': 'admin',
  'intent:add_slot': 'admin',
  'intent:add_rubric': 'admin',
  'intent:edit_rubric': 'admin',
  'intent:edit_rubric_image': 'admin',
  'intent:input_rubric': 'admin',
  'intent:set_timezone': 'admin',
  'intent:add_money': 'admin',
  'intent:find_property': 'member',
  'intent:find_contact': 'member',
  // Правка черновика канала ответом на сообщение.
  'intent:channel_draft': 'admin',

  // ── Команды и промпт ──────────────────────────────────────────────────────
  'command:repair_cta': 'admin',
  'prompt:channel': 'admin',
}

/**
 * Есть ли у роли право.
 *
 * Владелец может всё: он — единственный, для кого не нужна строка в таблице.
 * Сотрудник — только то, что помечено `member`. Посторонний — ничего.
 * Неизвестный ключ — отказ у всех, кроме владельца.
 */
export function can(role: BotRole, capability: string): boolean {
  if (role === 'admin') return true
  if (role !== 'member') return false
  return CAPABILITIES[capability] === 'member'
}

export const canOpenScreen = (role: BotRole, screen: string): boolean => can(role, `screen:${screen}`)
export const canUseTool = (role: BotRole, toolName: string): boolean => can(role, `tool:${toolName}`)
/** Кнопка: сначала конкретная пара «действие:аргумент», иначе — действие целиком. */
export function canRunAction(role: BotRole, action: string, arg?: string): boolean {
  if (arg !== undefined && can(role, `action:${action}:${arg}`)) return true
  return can(role, `action:${action}`)
}
export const canFulfilIntent = (role: BotRole, intent: string): boolean => can(role, `intent:${intent}`)

/** Кнопки, которые диспетчер знает кроме тех, что в таблице как `action:*`. */
const NAV_ACTIONS = ['nav'] as const
const CONFIRM_ACTIONS = ['confirm', 'cancel'] as const

/** Все известные действия кнопок — чтобы неизвестная кнопка отвечала «устарела». */
export const KNOWN_CALLBACK_ACTIONS: readonly string[] = [
  ...NAV_ACTIONS,
  ...CONFIRM_ACTIONS,
  ...Object.keys(CAPABILITIES)
    .filter((key) => key.startsWith('action:'))
    .map((key) => key.slice('action:'.length).split(':')[0]),
]

/**
 * Проверка роли на нажатие кнопки — одна для всего `callback_query`.
 *
 * Особые случаи:
 *  • `nav:<экран>[:<страница>]` — право берётся у ЭКРАНА, а не у кнопки;
 *  • `confirm`/`cancel` — уровень сотрудника; что именно подтверждается,
 *    проверяется отдельно (батч помнит, кто его запросил, а каждая мутация
 *    проверяется через `canUseTool`);
 *  • неизвестное действие — не отказ по роли, а «кнопка устарела»: это разные
 *    сообщения, и путать их нельзя.
 */
export function canRunCallback(role: BotRole, action: string, arg: string): boolean {
  if (!KNOWN_CALLBACK_ACTIONS.includes(action)) return true
  if ((NAV_ACTIONS as readonly string[]).includes(action)) return canOpenScreen(role, arg.split(':')[0])
  if ((CONFIRM_ACTIONS as readonly string[]).includes(action)) return isAtLeastMember(role)
  return canRunAction(role, action, arg)
}

/**
 * Право для формы, ждущей ввода: `awaiting_intent` может быть с параметром
 * (`edit_rubric:<id>`, `input_rubric:<id>`), а в таблице ключ без параметра.
 */
export function canFulfilIntentKey(role: BotRole, intent: string): boolean {
  const key = intent.split(':')[0]
  return canFulfilIntent(role, intent) || canFulfilIntent(role, key)
}
export const canRunCommand = (role: BotRole, command: string): boolean => can(role, `command:${command}`)
export const canSeePrompt = (role: BotRole, block: string): boolean => can(role, `prompt:${block}`)

/** Экраны сотрудника — из таблицы, а не отдельным списком (совместимость и тесты). */
export const MEMBER_SCREENS: readonly string[] = Object.entries(CAPABILITIES)
  .filter(([key, level]) => key.startsWith('screen:') && level === 'member')
  .map(([key]) => key.slice('screen:'.length))

/** Инструменты, закрытые сотруднику — из таблицы. */
export const ADMIN_ONLY_TOOLS: readonly string[] = Object.entries(CAPABILITIES)
  .filter(([key, level]) => key.startsWith('tool:') && level === 'admin')
  .map(([key]) => key.slice('tool:'.length))

/** Админ может всё, что может сотрудник. */
export function isAtLeastMember(role: BotRole): boolean {
  return role === 'admin' || role === 'member'
}
