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
 * 28.10.2026: сами ПРАВА уехали в `permissions.ts` — одна таблица на экраны,
 * инструменты, кнопки, формы и команды. Этот файл отвечает только за то, КЕМ
 * является автор апдейта (роль), а не за то, что ему можно.
 *
 * Файл без 'use client' — он серверный.
 */

import type { BotRole as PermissionsRole } from './permissions'

export type { BotRole, RoleRequirement } from './permissions'
// Права живут в таблице permissions.ts; здесь — только их ре-экспорт, чтобы
// обработчики не тянули два импорта на одну проверку.
export {
  can,
  canOpenScreen,
  canUseTool,
  canRunAction,
  canRunCallback,
  canFulfilIntent,
  canFulfilIntentKey,
  canRunCommand,
  canSeePrompt,
  KNOWN_CALLBACK_ACTIONS,
  MEMBER_SCREENS,
  ADMIN_ONLY_TOOLS,
  CAPABILITIES,
} from './permissions'

export interface BotActor {
  /** Telegram user id — ВСЕГДА from.id, а не chat.id: в группе это разные вещи. */
  telegramUserId: string
  chatId: number
  username?: string
  orgId: string
  role: PermissionsRole
}

/**
 * Чистое правило роли — вынесено отдельно, чтобы его можно было проверить
 * тестом без базы и без Telegram.
 */
export function roleOf(
  actorUserId: string,
  adminUserId: string | null | undefined,
  allowedUserIds: readonly string[],
): PermissionsRole {
  if (adminUserId && actorUserId === adminUserId) return 'admin'
  if (allowedUserIds.includes(actorUserId)) return 'member'
  return 'stranger'
}

/** Админ может всё, что может сотрудник. */
export function isAtLeastMember(role: PermissionsRole): boolean {
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
