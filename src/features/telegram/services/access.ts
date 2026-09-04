/**
 * Кто и что может в Telegram-боте.
 *
 * До 04.09.2026 в боте было ДВЕ несвязанные системы допуска, и каждая
 * применялась не везде:
 *
 * - `bot_allowed_users` пускала к текстовому ассистенту (23 инструмента, из них
 *   мутирующие) — проверялась только в обработчике текста;
 * - `channel_bot_settings.admin_telegram_user_id` пускала к кнопкам меню —
 *   проверялась в каждом обработчике отдельно, и в трёх из них её забыли.
 *
 * Отсюда следовало неприятное: добавленный в `bot_allowed_users` сотрудник мог
 * менять данные CRM текстом, но все кнопки меню у него молча не работали — без
 * единого слова о том, почему.
 *
 * Здесь одна дверь: роль вычисляется один раз на входящее обновление и дальше
 * передаётся обработчикам. Проверка роли — не право отдельного обработчика
 * вспомнить о ней, а условие входа.
 *
 * Файл без 'use client' — он серверный.
 */

/**
 * `admin`   — хозяин бота: настройки, расписание, рубрики, публикация в канал.
 * `member`  — допущенный сотрудник: ассистент и быстрые действия по CRM.
 * `stranger`— никто: бот отвечает отказом и ничего не делает.
 */
export type BotRole = 'admin' | 'member' | 'stranger'

export interface BotActor {
  /** Telegram user id — ВСЕГДА from.id, а не chat.id: в группе это разные вещи. */
  telegramUserId: string
  chatId: number
  username?: string
  orgId: string
  role: BotRole
}

/**
 * Чистое правило роли — вынесено отдельно, чтобы его можно было проверить
 * тестом без базы и без Telegram.
 */
export function roleOf(
  actorUserId: string,
  adminUserId: string | null | undefined,
  allowedUserIds: readonly string[],
): BotRole {
  if (adminUserId && actorUserId === adminUserId) return 'admin'
  if (allowedUserIds.includes(actorUserId)) return 'member'
  return 'stranger'
}

/** Админ может всё, что может сотрудник. */
export function isAtLeastMember(role: BotRole): boolean {
  return role === 'admin' || role === 'member'
}

/**
 * Можно ли первому написавшему стать допущенным автоматически.
 *
 * Первый запуск бота должен быть возможен без ручного похода в базу, поэтому
 * бутстрап оставлен. Но раньше он срабатывал для КОГО УГОДНО, стоило списку
 * опустеть — а список можно опустошить кнопкой «удалить пользователя».
 * Теперь: если админ уже назначен, автоматически пускаем только его.
 */
export function canBootstrap(
  actorUserId: string,
  adminUserId: string | null | undefined,
  allowedCount: number,
): boolean {
  if (allowedCount > 0) return false
  if (!adminUserId) return true
  return actorUserId === adminUserId
}

/**
 * Принадлежит ли незавершённый ввод этому человеку.
 *
 * `awaiting_intent` хранится один на организацию. Без владельца чужой текст
 * подставлялся в чужую форму — в том числе в форму добавления пользователя.
 */
export function ownsIntent(
  actorUserId: string,
  intentUserId: string | null | undefined,
): boolean {
  return !!intentUserId && intentUserId === actorUserId
}

/**
 * Экраны меню, доступные допущенному сотруднику.
 *
 * Всё остальное — канал, расписание, рубрики, анализ рынка, деньги, настройки —
 * дело владельца: там правятся промпты, по которым бот пишет в публичный канал,
 * видна выручка агентства и список тех, кто вообще имеет доступ.
 *
 * `crm_payments` (экран «Деньги») ушёл из списка 05.09.2026 вместе с появлением
 * там месячного итога: сотруднику незачем видеть оборот агентства целиком.
 *
 * Список ролевой, а не «все экраны для админа и ничего для остальных»: раньше
 * меню целиком было админским, и добавленный кнопкой «Добавить пользователя»
 * сотрудник получал бота, у которого текст работает, а все кнопки молчат.
 */
export const MEMBER_SCREENS: readonly string[] = [
  'root', 'today', 'crm', 'crm_leads', 'crm_deals', 'crm_properties', 'crm_contacts', 'crm_tasks',
]

export function canOpenScreen(role: BotRole, screen: string): boolean {
  if (role === 'admin') return true
  if (role === 'member') return MEMBER_SCREENS.includes(screen)
  return false
}
