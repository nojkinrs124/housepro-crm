// Кнопки сценария «Занести в CRM» (intake:<verb>:<sessionId|new>) и быстрые
// CRM-действия внутри списков (лиды/сделки/оплаты/задачи/поиск/запись операции).
// Вынесено из webhook/route.ts фазой 2 аудита без изменения поведения.

import { sendMessage, sendChatAction } from '@/lib/telegram/api'
import {
  advanceLeadStatus,
  advanceDealStatus,
  markTransactionPaid,
  payOwnerFromBot,
  markTaskDone,
  snoozeTaskToTomorrow,
  buildPropertySearchResult,
  buildContactSearchResult,
} from '@/lib/telegram/crm-menu'
import {
  getActiveIntake,
  startIntake,
  cancelIntake,
  runIntakeExtraction,
  commitIntake,
  intakeContentParts,
} from '@/lib/telegram/intake'
import { INTAKE_DATA_KINDS, type IntakeKind } from '@/features/telegram/services/intake-format'
import { setAwaitingIntent } from '@/lib/telegram/channel'
import { showMenuScreen, setTimezone, type MenuScreen } from '@/lib/telegram/menu'
import { isAtLeastMember, ownsIntent, type BotActor } from '@/features/telegram/services/access'
import { parseTimezone } from '@/features/telegram/services/parsing'
import { denyAdmin } from '@/lib/telegram/webhook/context'
import { handleUserTurn } from '@/lib/telegram/webhook/dialog/turn'

/**
 * Кнопки сценария «Занести в CRM»: intake:<verb>:<sessionId|new>.
 * Тип задаёт пользователь; модель вызывается один раз по «Готово».
 */
export async function handleIntakeCallback(arg: string, actor: BotActor) {
  if (!isAtLeastMember(actor.role)) return
  const idx = arg.indexOf(':')
  const verb = idx > 0 ? arg.slice(0, idx) : arg
  const sessionId = idx > 0 ? arg.slice(idx + 1) : ''

  if ((INTAKE_DATA_KINDS as readonly string[]).includes(verb)) {
    await startIntake(actor, verb as IntakeKind)
    return
  }
  if (verb === 'receipt') {
    // Чек — не документ для карточки, а операция: уходит в обычный диалог с
    // add_transaction, где уже есть разбор суммы и подтверждение.
    const session = await getActiveIntake(actor.telegramUserId)
    if (!session || session.id !== sessionId) return
    const content = await intakeContentParts(
      session,
      'На фото чек, квитанция или расписка. Определи сумму, дату и назначение платежа и предложи add_transaction (доход или расход — по смыслу).',
    )
    await cancelIntake(session, { silent: true })
    await handleUserTurn(actor, content)
    return
  }
  if (verb === 'cancel') {
    const session = await getActiveIntake(actor.telegramUserId)
    if (session && session.id === sessionId) {
      await cancelIntake(session)
      await sendMessage(actor.chatId, '❌ Отменил, файлы удалил.')
    }
    return
  }
  if (verb === 'done') return runIntakeExtraction(actor, sessionId)
  if (verb === 'create') return commitIntake(actor, sessionId, 'full')
  if (verb === 'lead') return commitIntake(actor, sessionId, 'lead')
}

// Быстрые действия внутри списков CRM (лиды/сделки/оплаты/задачи): выполняет мутацию
// и перерисовывает тот же экран-список, откуда пришло нажатие.
const CRM_ACTION_SCREEN: Record<string, MenuScreen> = {
  leadnext: 'crm_leads',
  dealnext: 'crm_deals',
  paypaid: 'crm_payments',
  ownerpay: 'crm_management',
  taskdone: 'crm_tasks',
  tasksnooze: 'crm_tasks',
}

export async function handleCrmQuickAction(action: string, entityId: string, actor: BotActor, messageId: number | undefined) {
  const { chatId, orgId } = actor
  // Быстрые действия меняют данные CRM — их достаточно уровня сотрудника,
  // но не постороннего.
  if (!isAtLeastMember(actor.role)) return
  // Выплата собственнику — движение живых денег, это раздел владельца.
  if (action === 'ownerpay' && actor.role !== 'admin') return denyAdmin(chatId)

  let result: { error?: string } = {}
  if (action === 'leadnext') result = await advanceLeadStatus(orgId, entityId)
  else if (action === 'dealnext') result = await advanceDealStatus(orgId, entityId)
  else if (action === 'paypaid') result = await markTransactionPaid(orgId, entityId)
  else if (action === 'ownerpay') result = await payOwnerFromBot(orgId, entityId)
  else if (action === 'taskdone') result = await markTaskDone(orgId, entityId)
  else if (action === 'tasksnooze') result = await snoozeTaskToTomorrow(orgId, entityId)

  if (result.error) await sendMessage(chatId, `⚠️ Не получилось: ${result.error}`)
  else if (action === 'ownerpay') await sendMessage(chatId, '✅ Выплата собственнику записана.')
  await showMenuScreen(chatId, orgId, CRM_ACTION_SCREEN[action], actor.role, messageId)
}

/**
 * Кнопки, которым нужен ввод текстом (поиск по объектам и контактам) или
 * готовый инструмент ассистента (график, запись операции).
 *
 * Запись операции намеренно не заводит собственную форму: текст уходит в
 * обычный диалог, где add_transaction уже умеет разобрать «5000 бензин» и
 * спросить подтверждение. Вторая форма для того же действия разошлась бы
 * с первой.
 */
export async function handleCrmSearchAction(action: string, arg: string, actor: BotActor) {
  const { chatId, orgId } = actor
  if (!isAtLeastMember(actor.role)) return

  if (action === 'prop' && arg === 'find') {
    await setAwaitingIntent(orgId, 'find_property', actor.telegramUserId)
    await sendMessage(chatId, '🔎 Пришли адрес или его часть — покажу подходящие объекты.')
    return
  }
  if (action === 'cont' && arg === 'find') {
    await setAwaitingIntent(orgId, 'find_contact', actor.telegramUserId)
    await sendMessage(chatId, '🔎 Пришли имя, часть имени или телефон — найду контакт.')
    return
  }

  // Деньги — раздел владельца.
  if (actor.role !== 'admin') return denyAdmin(chatId)

  if (action === 'money' && arg === 'add') {
    await setAwaitingIntent(orgId, 'add_money', actor.telegramUserId)
    await sendMessage(
      chatId,
      '➕ Напиши операцию одной строкой, например:\n' +
        '<code>расход 5000 бензин</code>\n<code>приход 45000 аренда Ленина 10</code>\n\n' +
        'Покажу, что понял, и спрошу подтверждение.'
    )
    return
  }
  if (action === 'money' && arg === 'chart') {
    const { dispatchReadOnlyTool } = await import('@/lib/telegram/tools')
    await dispatchReadOnlyTool('get_finance_chart', { months: 6 }, { chatId })
  }
}

/**
 * Текст, которого ждут кнопки раздела CRM: поиск объекта, поиск контакта,
 * запись операции, часовой пояс.
 *
 * Отдельно от обработки ввода канала, потому что тот пускает только владельца:
 * поиск по базе — работа сотрудника, и запирать её незачем.
 */
export async function tryHandleCrmInput(actor: BotActor, text: string): Promise<boolean> {
  const { chatId, orgId } = actor
  const { getChannelSettings } = await import('@/lib/telegram/channel')
  const settings = await getChannelSettings(orgId)
  const intent = settings?.awaiting_intent
  if (!intent) return false
  if (!['find_property', 'find_contact', 'add_money', 'set_timezone'].includes(intent)) return false
  // Состояние ожидания одно на организацию: без проверки владельца чужой текст
  // попадал бы в чужую форму (та же причина, что у формы добавления пользователя).
  if (!ownsIntent(actor.telegramUserId, settings?.awaiting_intent_user_id)) return false

  if (intent === 'find_property' || intent === 'find_contact') {
    await setAwaitingIntent(orgId, null)
    const result =
      intent === 'find_property'
        ? await buildPropertySearchResult(orgId, text.trim())
        : await buildContactSearchResult(orgId, text.trim())
    await sendMessage(chatId, result.text, { inlineKeyboard: result.keyboard })
    return true
  }

  if (intent === 'add_money') {
    if (actor.role !== 'admin') return false
    await setAwaitingIntent(orgId, null)
    // В обычный диалог: add_transaction уже умеет разобрать сумму и назначение
    // и показать подтверждение. Своего разбора здесь нет намеренно.
    await handleUserTurn(actor, `Запиши операцию в бухгалтерию: ${text.trim()}`)
    return true
  }

  if (intent === 'set_timezone') {
    if (actor.role !== 'admin') return false
    const parsed = parseTimezone(text)
    if (!parsed.ok) {
      await sendMessage(chatId, `⚠️ ${parsed.error}`)
      return true
    }
    await setAwaitingIntent(orgId, null)
    const result = await setTimezone(orgId, parsed.value)
    if (result.error) await sendMessage(chatId, `⚠️ Не удалось сохранить: ${result.error}`)
    else await sendMessage(chatId, `🌍 Часовой пояс: <code>${parsed.value}</code>`)
    await showMenuScreen(chatId, orgId, 'settings', actor.role)
    return true
  }

  return false
}
