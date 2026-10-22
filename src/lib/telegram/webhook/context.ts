// Кто пишет боту и что ему можно — вычисляется один раз на входящее обновление и
// передаётся обработчикам объектом. Вынесено из webhook/route.ts фазой 2 аудита
// без изменения поведения.

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { resolveBotOrgId } from '@/lib/telegram/org'
import { sendMessage } from '@/lib/telegram/api'
import { roleOf, canBootstrap, type BotActor } from '@/features/telegram/services/access'

/**
 * Кто пишет боту и что ему можно — один раз на входящее обновление.
 *
 * Раньше допуск проверялся россыпью: `bot_allowed_users` — только в обработчике
 * текста, `admin_telegram_user_id` — в каждом обработчике кнопок отдельно, и в
 * трёх из них проверку забыли. Теперь роль вычисляется здесь и передаётся
 * дальше объектом: обработчику нечего «вспоминать».
 *
 * Идентификатор берётся из `from.id`, а не из `chat.id`: в приватном чате они
 * совпадают, в группе — нет, и на chat.id проверка админа была бы бессмысленной.
 */
export async function resolveActor(
  telegramUserId: string,
  chatId: number,
  username?: string,
): Promise<BotActor | null> {
  const orgId = await resolveBotOrgId()
  if (!orgId) return null

  const supabaseAdmin = getSupabaseAdmin()
  const [{ data: settings }, { data: allowed }] = await Promise.all([
    supabaseAdmin.from('channel_bot_settings').select('admin_telegram_user_id').eq('organization_id', orgId).maybeSingle(),
    supabaseAdmin.from('bot_allowed_users').select('telegram_user_id').eq('organization_id', orgId),
  ])

  const adminId = settings?.admin_telegram_user_id ?? null
  const allowedIds = (allowed ?? []).map(r => r.telegram_user_id)

  // Первый запуск: пустой список — бота ещё некому настроить. Пускаем, но если
  // админ уже назначен, то только его: иначе достаточно было опустошить список
  // кнопкой «удалить пользователя», чтобы бота захватил случайный собеседник.
  if (canBootstrap(telegramUserId, adminId, allowedIds.length)) {
    await supabaseAdmin.from('bot_allowed_users').insert({
      telegram_user_id: telegramUserId,
      organization_id: orgId,
      label: username ? `@${username} (первый пользователь, авто)` : 'первый пользователь (авто)',
    })
    allowedIds.push(telegramUserId)
  }

  return {
    telegramUserId,
    chatId,
    username,
    orgId,
    role: roleOf(telegramUserId, adminId, allowedIds),
  }
}

/** Отказ вслух. Молчащая кнопка неотличима от сломанной — так и было до 04.09.2026. */
export async function denyAdmin(chatId: number): Promise<void> {
  await sendMessage(chatId, '⛔ Это действие доступно только владельцу бота.')
}
