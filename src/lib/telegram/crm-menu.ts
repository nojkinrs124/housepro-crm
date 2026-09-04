import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { InlineKeyboardButton } from '@/lib/telegram/api'
import type { ScreenContent } from '@/lib/telegram/menu'
import { getSiteUrl } from '@/lib/telegram/site-url'
import { LEAD_STATUS_LABELS, LEAD_PIPELINE, LEAD_STATUSES_TERMINAL } from '@/features/leads/config/lead-statuses'
import { TASK_PRIORITY_LABELS } from '@/features/tasks/config/task-priorities'
import { stagesOf, stageLabel } from '@/features/directions/config/directions'
import { collectDealFacts, canMoveStage } from '@/features/directions/services/transitions'
import { likeFilterValue } from '@/features/telegram/services/parsing'

const BACK_TO_CRM: InlineKeyboardButton = { text: '⬅ CRM', callback_data: 'nav:crm' }

/** Сколько записей на страницу списка. Больше в экран телефона не помещается. */
export const PAGE_SIZE = 5

function openInCrmButton(path: string): InlineKeyboardButton {
  return { text: '🔗 Открыть в CRM', url: `${getSiteUrl()}${path}` }
}

/**
 * Хвост списка: «показать ещё» и «в начало».
 *
 * До 05.09.2026 у списков был жёсткий `limit 5` без всякого продолжения: при
 * 21 открытой задаче через бота были видны пять, и узнать об остальных было
 * нельзя. Номер страницы едет прямо в callback_data (`nav:crm_tasks:2`).
 */
function pageFooter(screen: string, page: number, total: number): InlineKeyboardButton[][] {
  const rows: InlineKeyboardButton[][] = []
  const shown = (page + 1) * PAGE_SIZE
  const row: InlineKeyboardButton[] = []
  if (shown < total) row.push({ text: `⬇ Ещё (${total - shown})`, callback_data: `nav:${screen}:${page + 1}` })
  if (page > 0) row.push({ text: '⬆ В начало', callback_data: `nav:${screen}` })
  if (row.length) rows.push(row)
  return rows
}

function rangeOf(page: number): [number, number] {
  return [page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1]
}

function moneyRu(value: number | string | null | undefined): string {
  return Number(value ?? 0).toLocaleString('ru-RU')
}


// --- Лиды ---

// Подписи и воронка — из конфига лидов. Своя копия здесь знала статус
// `meeting`, которого нет ни в базе, ни в вебе: кнопка «следующий статус»
// записала бы его в `leads.status`, и лид пропал бы с доски (та же поломка,
// что разбиралась в #28). Не заводить копию снова.

function nextInPipeline(pipeline: string[], current: string): string | null {
  const idx = pipeline.indexOf(current)
  if (idx === -1 || idx === pipeline.length - 1) return null
  return pipeline[idx + 1]
}

export async function buildLeadsScreen(orgId: string, page = 0): Promise<ScreenContent> {
  const supabaseAdmin = getSupabaseAdmin()
  const [from, to] = rangeOf(page)
  // Терминальных статусов три, а не два: до 05.09.2026 экран отбрасывал только
  // converted и closed, и все отказные лиды (а это были ВСЕ 62 лида в базе)
  // показывались как «в работе» — да ещё без единой кнопки, потому что из
  // отказа воронка никуда не ведёт.
  const { data: leads, count } = await supabaseAdmin
    .from('leads')
    .select('id, full_name, status, budget_min, budget_max, phone', { count: 'exact' })
    .eq('organization_id', orgId)
    .not('status', 'in', `(${LEAD_STATUSES_TERMINAL.join(',')})`)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (!leads || leads.length === 0) {
    return {
      text: '🧲 <b>Лиды</b>\n\nЛидов в работе нет — все закрыты, сконвертированы или в отказе.',
      keyboard: [[BACK_TO_CRM]],
    }
  }

  const lines: string[] = []
  const keyboard: InlineKeyboardButton[][] = []
  for (const lead of leads) {
    const budget = lead.budget_min || lead.budget_max ? ` · бюджет ${moneyRu(lead.budget_min)}–${moneyRu(lead.budget_max)}` : ''
    // Телефон в тексте, а не кнопкой: инлайн-кнопки Telegram принимают только
    // http(s), tel: в них не работает — зато номер в тексте он линкует сам.
    const phone = lead.phone ? `\n  ${lead.phone}` : ''
    lines.push(`• <b>${lead.full_name || 'Без имени'}</b> — ${LEAD_STATUS_LABELS[lead.status] ?? lead.status}${budget}${phone}`)
    const next = nextInPipeline(LEAD_PIPELINE, lead.status)
    const row: InlineKeyboardButton[] = []
    if (next) row.push({ text: `▶ ${LEAD_STATUS_LABELS[next]}`, callback_data: `leadnext:${lead.id}` })
    row.push(openInCrmButton(`/leads/${lead.id}`))
    keyboard.push(row)
  }
  keyboard.push(...pageFooter('crm_leads', page, count ?? leads.length))
  keyboard.push([BACK_TO_CRM])

  return { text: `🧲 <b>Лиды в работе (${count ?? leads.length})</b>\n\n${lines.join('\n')}`, keyboard }
}

export async function advanceLeadStatus(orgId: string, leadId: string): Promise<{ error?: string }> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data: lead } = await supabaseAdmin.from('leads').select('status').eq('id', leadId).eq('organization_id', orgId).maybeSingle()
  if (!lead) return { error: 'лид не найден' }
  const next = nextInPipeline(LEAD_PIPELINE, lead.status)
  if (!next) return { error: 'дальше двигать некуда' }
  const { error } = await supabaseAdmin.from('leads').update({ status: next }).eq('id', leadId).eq('organization_id', orgId)
  return { error: error?.message }
}

// --- Сделки ---

// Подписи и порядок стадий берутся из конфига направлений. Своя копия словаря
// здесь уже расходилась бы с базой, а с четырьмя воронками цена расхождения
// выше: кнопка «следующая стадия» предлагала бы шаг из чужого процесса.

export async function buildDealsScreen(orgId: string, page = 0): Promise<ScreenContent> {
  const supabaseAdmin = getSupabaseAdmin()
  const [from, to] = rangeOf(page)
  const { data: deals, count } = await supabaseAdmin
    .from('deals')
    .select('id, status, amount, deal_type, properties(address)', { count: 'exact' })
    .eq('organization_id', orgId)
    .not('status', 'in', '(completed,cancelled)')
    .order('created_at', { ascending: false })
    .range(from, to)

  if (!deals || deals.length === 0) {
    return { text: '🤝 <b>Сделки</b>\n\nАктивных сделок нет.', keyboard: [[BACK_TO_CRM]] }
  }

  const lines: string[] = []
  const keyboard: InlineKeyboardButton[][] = []
  for (const deal of deals) {
    const property = Array.isArray(deal.properties) ? deal.properties[0] : deal.properties
    const label = property?.address || `Сделка №${String(deal.id).slice(0, 8)}`
    const amount = deal.amount ? ` · ${moneyRu(deal.amount)} ₽` : ''
    lines.push(`• <b>${label}</b> — ${stageLabel(deal.deal_type, deal.status)}${amount}`)
    const pipeline = stagesOf(deal.deal_type).map(st => st.value).filter(v => v !== 'cancelled')
    const next = nextInPipeline(pipeline, deal.status)
    const row: InlineKeyboardButton[] = []
    if (next) row.push({ text: `➡ ${stageLabel(deal.deal_type, next)}`, callback_data: `dealnext:${deal.id}` })
    row.push(openInCrmButton(`/deals/${deal.id}`))
    keyboard.push(row)
  }
  keyboard.push(...pageFooter('crm_deals', page, count ?? deals.length))
  keyboard.push([BACK_TO_CRM])

  return { text: `🤝 <b>Сделки в работе (${count ?? deals.length})</b>\n\n${lines.join('\n')}`, keyboard }
}

/**
 * Перевод сделки на следующую стадию — по тем же правилам, что и в вебе.
 *
 * До 05.09.2026 бот писал новый статус прямым UPDATE, минуя предусловия и
 * чек-лист стадии: кнопкой в телефоне можно было поставить «Заселение» без
 * подписанного договора найма, чего интерфейс CRM не позволяет. Проверку
 * делает общий `canMoveStage`, и его отказ показывается дословно — он и
 * написан для человека («не закрыты пункты: …»).
 */
export async function advanceDealStatus(orgId: string, dealId: string): Promise<{ error?: string }> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data: deal } = await supabaseAdmin.from('deals').select('status, deal_type').eq('id', dealId).eq('organization_id', orgId).maybeSingle()
  if (!deal) return { error: 'сделка не найдена' }

  // Воронка своя у каждого направления, поэтому «следующая стадия» считается
  // по стадиям именно этого направления, а не по общему списку.
  const pipeline = stagesOf(deal.deal_type).map(st => st.value).filter(v => v !== 'cancelled')
  const next = nextInPipeline(pipeline, deal.status)
  if (!next) return { error: 'дальше двигать некуда' }

  const facts = await collectDealFacts(supabaseAdmin, dealId)
  if (!facts) return { error: 'сделка не найдена' }
  const verdict = canMoveStage(facts, next)
  if (!verdict.allowed) return { error: verdict.reason ?? 'переход не разрешён' }

  const { error } = await supabaseAdmin.from('deals').update({ status: next }).eq('id', dealId).eq('organization_id', orgId)
  return { error: error?.message }
}

// --- Деньги ---

/**
 * Начисления и итог месяца.
 *
 * Реестр — `accounting_transactions`, а не legacy-таблица `payments`: в неё
 * приложение не пишет с переезда бухгалтерии (последняя запись — июнь 2026),
 * поэтому экран «Оплаты» всегда бодро отвечал «неоплаченных нет 🎉», сколько
 * бы просрочек ни висело. Утренний дайджест переехал ещё раньше — бот
 * противоречил сам себе.
 */
export async function buildFinanceScreen(orgId: string, page = 0): Promise<ScreenContent> {
  const supabaseAdmin = getSupabaseAdmin()
  const [from, to] = rangeOf(page)
  const monthStart = new Date()
  monthStart.setDate(1)
  const monthStartIso = monthStart.toISOString().slice(0, 10)

  const [{ data: planned, count }, { data: monthTx }] = await Promise.all([
    supabaseAdmin
      .from('accounting_transactions')
      .select('id, amount, due_date, type, contracts:contract_id(contract_number)', { count: 'exact' })
      .eq('organization_id', orgId)
      .eq('type', 'income')
      .eq('status', 'planned')
      .order('due_date', { ascending: true })
      .range(from, to),
    supabaseAdmin
      .from('accounting_transactions')
      .select('type, amount')
      .eq('organization_id', orgId)
      .eq('status', 'completed')
      .gte('date', monthStartIso),
  ])

  let income = 0
  let expense = 0
  for (const t of monthTx ?? []) {
    if (t.type === 'income') income += Number(t.amount)
    else expense += Number(t.amount)
  }

  const today = new Date().toISOString().slice(0, 10)
  const lines: string[] = [
    `За месяц: приход ${moneyRu(income)} ₽ · расход ${moneyRu(expense)} ₽ · итог <b>${moneyRu(income - expense)} ₽</b>`,
  ]
  const keyboard: InlineKeyboardButton[][] = []

  if (!planned || planned.length === 0) {
    lines.push('\nЗапланированных начислений нет.')
  } else {
    lines.push('')
    for (const p of planned) {
      const contract = Array.isArray(p.contracts) ? p.contracts[0] : p.contracts
      const label = contract?.contract_number ? `Договор ${contract.contract_number}` : `Начисление №${String(p.id).slice(0, 8)}`
      const overdue = p.due_date && p.due_date <= today ? ' ⚠️ просрочено' : ''
      lines.push(`• <b>${label}</b> — ${moneyRu(p.amount)} ₽${p.due_date ? ` · срок ${p.due_date}` : ''}${overdue}`)
      keyboard.push([
        { text: '✅ Оплачено', callback_data: `paypaid:${p.id}` },
        openInCrmButton(`/accounting/transactions/${p.id}`),
      ])
    }
    keyboard.push(...pageFooter('crm_payments', page, count ?? planned.length))
  }

  keyboard.push([
    { text: '➕ Записать операцию', callback_data: 'money:add' },
    { text: '📈 График', callback_data: 'money:chart' },
  ])
  keyboard.push([BACK_TO_CRM])

  return { text: `💰 <b>Деньги</b>\n\n${lines.join('\n')}`, keyboard }
}

/**
 * Отметка начисления оплаченным — тем же способом, что и в вебе
 * (`completeTransactionAction`): статус `completed` плюс автоматический
 * перевод сделки на завершение, если это доход по сделке. Без второго шага
 * оплата через бота и оплата через CRM давали бы разное состояние сделки.
 */
export async function markTransactionPaid(orgId: string, transactionId: string): Promise<{ error?: string }> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data: updated, error } = await supabaseAdmin
    .from('accounting_transactions')
    .update({ status: 'completed', paid_at: new Date().toISOString() })
    .eq('id', transactionId)
    .eq('organization_id', orgId)
    .neq('status', 'completed')
    .select('id, type, deal_id')
    .maybeSingle()

  if (error) return { error: error.message }
  if (!updated) return { error: 'начисление уже проведено' }

  if (updated.deal_id && updated.type === 'income') {
    const { advanceDealStage } = await import('@/lib/deal-automation')
    await advanceDealStage(supabaseAdmin, updated.deal_id, 'completed')
  }
  return {}
}

// --- Объекты ---

const PROPERTY_STATUS_LABELS: Record<string, string> = {
  available: 'свободен',
  reserved: 'бронь',
  rented: 'сдан',
  sold: 'продан',
  inactive: 'неактивен',
}

/**
 * Объекты — центральная сущность агентства, а в меню бота их не было вовсе:
 * посмотреть с телефона, что свободно, было нельзя. Порядок намеренный:
 * свободные и забронированные впереди, остальное следом.
 */
export async function buildPropertiesScreen(orgId: string, page = 0): Promise<ScreenContent> {
  const supabaseAdmin = getSupabaseAdmin()
  const [from, to] = rangeOf(page)
  const { data: properties, count } = await supabaseAdmin
    .from('properties')
    .select('id, title, address, status, deal_type, price, rooms, area', { count: 'exact' })
    .eq('organization_id', orgId)
    .order('status', { ascending: true })
    .order('updated_at', { ascending: false })
    .range(from, to)

  if (!properties || properties.length === 0) {
    return {
      text: '🏠 <b>Объекты</b>\n\nВ базе пока ни одного объекта.\n\n<i>Пришли выписку ЕГРН или свидетельство — заведу объект сам.</i>',
      keyboard: [[{ text: '🔎 Найти по адресу', callback_data: 'prop:find' }], [BACK_TO_CRM]],
    }
  }

  const lines: string[] = []
  const keyboard: InlineKeyboardButton[][] = []
  for (const p of properties) {
    const params = [p.rooms ? `${p.rooms}к` : null, p.area ? `${p.area} м²` : null, p.price ? `${moneyRu(p.price)} ₽` : null]
      .filter(Boolean)
      .join(' · ')
    lines.push(
      `• <b>${p.title || p.address}</b> — ${PROPERTY_STATUS_LABELS[p.status] ?? p.status}` +
        (params ? `\n  ${params}` : '')
    )
    keyboard.push([openInCrmButton(`/properties/${p.id}`)])
  }
  keyboard.push(...pageFooter('crm_properties', page, count ?? properties.length))
  keyboard.push([{ text: '🔎 Найти по адресу', callback_data: 'prop:find' }])
  keyboard.push([BACK_TO_CRM])

  return { text: `🏠 <b>Объекты (${count ?? properties.length})</b>\n\n${lines.join('\n')}`, keyboard }
}

export async function buildPropertySearchResult(orgId: string, query: string): Promise<ScreenContent> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data: properties } = await supabaseAdmin
    .from('properties')
    .select('id, title, address, status, price, rooms, area')
    .eq('organization_id', orgId)
    .or(`address.ilike.${likeFilterValue(query)},title.ilike.${likeFilterValue(query)}`)
    .limit(PAGE_SIZE)

  if (!properties || properties.length === 0) {
    return {
      text: `🔎 <b>Объекты по запросу «${query}»</b>\n\nНичего не нашлось.`,
      keyboard: [[{ text: '🔎 Искать ещё раз', callback_data: 'prop:find' }], [{ text: '⬅ Объекты', callback_data: 'nav:crm_properties' }]],
    }
  }

  const lines = properties.map((p) => {
    const params = [p.rooms ? `${p.rooms}к` : null, p.area ? `${p.area} м²` : null, p.price ? `${moneyRu(p.price)} ₽` : null]
      .filter(Boolean)
      .join(' · ')
    return `• <b>${p.title || p.address}</b> — ${PROPERTY_STATUS_LABELS[p.status] ?? p.status}` + (params ? `\n  ${params}` : '')
  })
  const keyboard: InlineKeyboardButton[][] = properties.map((p) => [openInCrmButton(`/properties/${p.id}`)])
  keyboard.push([{ text: '🔎 Искать ещё раз', callback_data: 'prop:find' }])
  keyboard.push([{ text: '⬅ Объекты', callback_data: 'nav:crm_properties' }])

  return { text: `🔎 <b>Объекты по запросу «${query}»</b>\n\n${lines.join('\n')}`, keyboard }
}

// --- Контакты ---

const CONTACT_ROLE_LABELS: Record<string, string> = {
  client: 'клиент',
  owner: 'собственник',
  both: 'клиент и собственник',
}

function contactLine(c: { full_name: string | null; role: string; phone: string | null; company_name?: string | null }): string {
  const name = c.company_name || c.full_name || 'Без имени'
  return `• <b>${name}</b> — ${CONTACT_ROLE_LABELS[c.role] ?? c.role}${c.phone ? `\n  ${c.phone}` : ''}`
}

export async function buildContactsScreen(orgId: string, page = 0): Promise<ScreenContent> {
  const supabaseAdmin = getSupabaseAdmin()
  const [from, to] = rangeOf(page)
  const { data: contacts, count } = await supabaseAdmin
    .from('contacts')
    .select('id, full_name, company_name, role, phone', { count: 'exact' })
    .eq('organization_id', orgId)
    .is('merged_into', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (!contacts || contacts.length === 0) {
    return { text: '👤 <b>Контакты</b>\n\nКонтактов пока нет.', keyboard: [[BACK_TO_CRM]] }
  }

  const keyboard: InlineKeyboardButton[][] = contacts.map((c) => [openInCrmButton(`/contacts/${c.id}`)])
  keyboard.push(...pageFooter('crm_contacts', page, count ?? contacts.length))
  keyboard.push([{ text: '🔎 Найти по имени или телефону', callback_data: 'cont:find' }])
  keyboard.push([BACK_TO_CRM])

  return {
    text: `👤 <b>Контакты (${count ?? contacts.length})</b>\nПоследние добавленные:\n\n${contacts.map(contactLine).join('\n')}`,
    keyboard,
  }
}

export async function buildContactSearchResult(orgId: string, query: string): Promise<ScreenContent> {
  const supabaseAdmin = getSupabaseAdmin()
  // Телефон в базе хранится как ввели, поэтому ищем и по сырой строке, и по
  // одним цифрам: «+7 (999) 000-11-22» и «9990001122» — один человек.
  const digits = query.replace(/\D/g, '')
  const value = likeFilterValue(query)
  const filters = [`full_name.ilike.${value}`, `company_name.ilike.${value}`, `phone.ilike.${value}`]
  if (digits.length >= 4) filters.push(`phone.ilike.${likeFilterValue(digits.slice(-10))}`)

  const { data: contacts } = await supabaseAdmin
    .from('contacts')
    .select('id, full_name, company_name, role, phone')
    .eq('organization_id', orgId)
    .is('merged_into', null)
    .or(filters.join(','))
    .limit(PAGE_SIZE)

  if (!contacts || contacts.length === 0) {
    return {
      text: `🔎 <b>Контакты по запросу «${query}»</b>\n\nНичего не нашлось.`,
      keyboard: [[{ text: '🔎 Искать ещё раз', callback_data: 'cont:find' }], [{ text: '⬅ Контакты', callback_data: 'nav:crm_contacts' }]],
    }
  }

  const keyboard: InlineKeyboardButton[][] = contacts.map((c) => [openInCrmButton(`/contacts/${c.id}`)])
  keyboard.push([{ text: '🔎 Искать ещё раз', callback_data: 'cont:find' }])
  keyboard.push([{ text: '⬅ Контакты', callback_data: 'nav:crm_contacts' }])

  return { text: `🔎 <b>Контакты по запросу «${query}»</b>\n\n${contacts.map(contactLine).join('\n')}`, keyboard }
}

// --- Задачи ---

export async function buildTasksScreen(orgId: string, page = 0): Promise<ScreenContent> {
  const supabaseAdmin = getSupabaseAdmin()
  const [from, to] = rangeOf(page)
  const { data: tasks, count } = await supabaseAdmin
    .from('tasks')
    .select('id, title, priority, due_date, deadline', { count: 'exact' })
    .eq('organization_id', orgId)
    .in('status', ['todo', 'in_progress'])
    .order('due_date', { ascending: true, nullsFirst: false })
    .range(from, to)

  if (!tasks || tasks.length === 0) {
    return { text: '✅ <b>Задачи</b>\n\nОткрытых задач нет.', keyboard: [[BACK_TO_CRM]] }
  }

  const lines: string[] = []
  const keyboard: InlineKeyboardButton[][] = []
  for (const t of tasks) {
    const due = t.due_date || t.deadline
    const dueText = due ? ` · срок ${new Date(due).toLocaleDateString('ru-RU')}` : ''
    lines.push(`• <b>${t.title}</b> — приоритет: ${TASK_PRIORITY_LABELS[t.priority] ?? t.priority}${dueText}`)
    keyboard.push([
      { text: '✅ Готово', callback_data: `taskdone:${t.id}` },
      { text: '🕘 На завтра', callback_data: `tasksnooze:${t.id}` },
    ])
  }
  keyboard.push(...pageFooter('crm_tasks', page, count ?? tasks.length))
  keyboard.push([BACK_TO_CRM])

  return { text: `✅ <b>Открытые задачи (${count ?? tasks.length})</b>\n\n${lines.join('\n')}`, keyboard }
}

export async function markTaskDone(orgId: string, taskId: string): Promise<{ error?: string }> {
  const supabaseAdmin = getSupabaseAdmin()
  const { error } = await supabaseAdmin.from('tasks').update({ status: 'done' }).eq('id', taskId).eq('organization_id', orgId)
  return { error: error?.message }
}

/**
 * Перенос срока на завтра. На выезде «сделаю завтра» — самое частое решение по
 * задаче, а раньше единственной кнопкой было «Готово»: срок правился только
 * из веба, поэтому просроченное копилось.
 */
export async function snoozeTaskToTomorrow(orgId: string, taskId: string): Promise<{ error?: string }> {
  const supabaseAdmin = getSupabaseAdmin()
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const iso = tomorrow.toISOString().slice(0, 10)
  const { error } = await supabaseAdmin
    .from('tasks')
    .update({ due_date: iso, deadline: iso })
    .eq('id', taskId)
    .eq('organization_id', orgId)
  return { error: error?.message }
}
