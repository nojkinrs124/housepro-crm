import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { InlineKeyboardButton } from '@/lib/telegram/api'
import type { ScreenContent } from '@/lib/telegram/menu'

const BACK_TO_CRM: InlineKeyboardButton = { text: '⬅ CRM', callback_data: 'nav:crm' }

// --- Лиды ---

const LEAD_STATUS_LABELS: Record<string, string> = {
  new: 'Новый',
  contacted: 'Связались',
  meeting: 'Встреча',
  searching: 'Подбираем варианты',
  showing: 'Показы',
  converted: 'Конвертирован',
  closed: 'Закрыт',
}
// Порядок продвижения по воронке (без учёта терминального 'closed' — им управляют вручную текстом).
const LEAD_PIPELINE = ['new', 'contacted', 'meeting', 'searching', 'showing', 'converted']

function nextInPipeline(pipeline: string[], current: string): string | null {
  const idx = pipeline.indexOf(current)
  if (idx === -1 || idx === pipeline.length - 1) return null
  return pipeline[idx + 1]
}

export async function buildLeadsScreen(orgId: string): Promise<ScreenContent> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data: leads } = await supabaseAdmin
    .from('leads')
    .select('id, full_name, status, budget_min, budget_max, phone')
    .eq('organization_id', orgId)
    .not('status', 'in', '(converted,closed)')
    .order('created_at', { ascending: false })
    .limit(5)

  if (!leads || leads.length === 0) {
    return { text: '🧲 <b>Лиды</b>\n\nАктивных лидов нет — все в работе закрыты или сконвертированы.', keyboard: [[BACK_TO_CRM]] }
  }

  const lines: string[] = []
  const keyboard: InlineKeyboardButton[][] = []
  for (const lead of leads) {
    const budget = lead.budget_min || lead.budget_max ? ` · бюджет ${lead.budget_min ?? '?'}–${lead.budget_max ?? '?'}` : ''
    lines.push(`• <b>${lead.full_name || 'Без имени'}</b> — ${LEAD_STATUS_LABELS[lead.status] ?? lead.status}${budget}`)
    const next = nextInPipeline(LEAD_PIPELINE, lead.status)
    if (next) {
      keyboard.push([{ text: `▶ ${lead.full_name}: ${LEAD_STATUS_LABELS[next]}`, callback_data: `leadnext:${lead.id}` }])
    }
  }
  keyboard.push([BACK_TO_CRM])

  return { text: `🧲 <b>Лиды в работе</b>\n\n${lines.join('\n')}`, keyboard }
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

const DEAL_STATUS_LABELS: Record<string, string> = {
  new: 'Новая',
  showing: 'Показы',
  negotiation: 'Переговоры',
  contract: 'Договор',
  payment: 'Оплата',
  completed: 'Завершена',
  cancelled: 'Отменена',
}
const DEAL_PIPELINE = ['new', 'showing', 'negotiation', 'contract', 'payment', 'completed']

export async function buildDealsScreen(orgId: string): Promise<ScreenContent> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data: deals } = await supabaseAdmin
    .from('deals')
    .select('id, status, amount, deal_type, properties(address)')
    .eq('organization_id', orgId)
    .not('status', 'in', '(completed,cancelled)')
    .order('created_at', { ascending: false })
    .limit(5)

  if (!deals || deals.length === 0) {
    return { text: '🤝 <b>Сделки</b>\n\nАктивных сделок нет.', keyboard: [[BACK_TO_CRM]] }
  }

  const lines: string[] = []
  const keyboard: InlineKeyboardButton[][] = []
  for (const deal of deals) {
    const property = Array.isArray(deal.properties) ? deal.properties[0] : deal.properties
    const label = property?.address || `Сделка №${String(deal.id).slice(0, 8)}`
    const amount = deal.amount ? ` · ${Number(deal.amount).toLocaleString('ru-RU')} ₽` : ''
    lines.push(`• <b>${label}</b> — ${DEAL_STATUS_LABELS[deal.status] ?? deal.status}${amount}`)
    const next = nextInPipeline(DEAL_PIPELINE, deal.status)
    if (next) {
      keyboard.push([{ text: `➡ ${label.slice(0, 20)}: ${DEAL_STATUS_LABELS[next]}`, callback_data: `dealnext:${deal.id}` }])
    }
  }
  keyboard.push([BACK_TO_CRM])

  return { text: `🤝 <b>Сделки в работе</b>\n\n${lines.join('\n')}`, keyboard }
}

export async function advanceDealStatus(orgId: string, dealId: string): Promise<{ error?: string }> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data: deal } = await supabaseAdmin.from('deals').select('status').eq('id', dealId).eq('organization_id', orgId).maybeSingle()
  if (!deal) return { error: 'сделка не найдена' }
  const next = nextInPipeline(DEAL_PIPELINE, deal.status)
  if (!next) return { error: 'дальше двигать некуда' }
  const { error } = await supabaseAdmin.from('deals').update({ status: next }).eq('id', dealId).eq('organization_id', orgId)
  return { error: error?.message }
}

// --- Оплаты ---

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидает',
  paid: 'Оплачен',
  partial: 'Частично',
  overdue: 'Просрочен',
  cancelled: 'Отменён',
}

export async function buildPaymentsScreen(orgId: string): Promise<ScreenContent> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data: payments } = await supabaseAdmin
    .from('payments')
    .select('id, amount, payment_status, due_date, contracts(contract_number)')
    .eq('organization_id', orgId)
    .in('payment_status', ['pending', 'overdue', 'partial'])
    .order('due_date', { ascending: true })
    .limit(5)

  if (!payments || payments.length === 0) {
    return { text: '💰 <b>Оплаты</b>\n\nНеоплаченных платежей нет 🎉', keyboard: [[BACK_TO_CRM]] }
  }

  const lines: string[] = []
  const keyboard: InlineKeyboardButton[][] = []
  for (const p of payments) {
    const contract = Array.isArray(p.contracts) ? p.contracts[0] : p.contracts
    const label = contract?.contract_number ? `Договор ${contract.contract_number}` : `Платёж №${String(p.id).slice(0, 8)}`
    const due = p.due_date ? ` · срок ${p.due_date}` : ''
    lines.push(`• <b>${label}</b> — ${Number(p.amount).toLocaleString('ru-RU')} ₽ · ${PAYMENT_STATUS_LABELS[p.payment_status] ?? p.payment_status}${due}`)
    keyboard.push([{ text: `✅ Оплачено: ${label.slice(0, 24)}`, callback_data: `paypaid:${p.id}` }])
  }
  keyboard.push([BACK_TO_CRM])

  return { text: `💰 <b>Ожидают оплаты</b>\n\n${lines.join('\n')}`, keyboard }
}

export async function markPaymentPaid(orgId: string, paymentId: string): Promise<{ error?: string }> {
  const supabaseAdmin = getSupabaseAdmin()
  const { error } = await supabaseAdmin
    .from('payments')
    .update({ payment_status: 'paid', payment_date: new Date().toISOString() })
    .eq('id', paymentId)
    .eq('organization_id', orgId)
  return { error: error?.message }
}

// --- Задачи ---

const TASK_PRIORITY_LABELS: Record<string, string> = { low: 'низкий', medium: 'средний', high: 'высокий' }

export async function buildTasksScreen(orgId: string): Promise<ScreenContent> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data: tasks } = await supabaseAdmin
    .from('tasks')
    .select('id, title, priority, due_date, deadline')
    .eq('organization_id', orgId)
    .in('status', ['todo', 'in_progress'])
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(5)

  if (!tasks || tasks.length === 0) {
    return { text: '✅ <b>Задачи</b>\n\nОткрытых задач нет.', keyboard: [[BACK_TO_CRM]] }
  }

  const lines: string[] = []
  const keyboard: InlineKeyboardButton[][] = []
  for (const t of tasks) {
    const due = t.due_date || t.deadline
    const dueText = due ? ` · срок ${new Date(due).toLocaleDateString('ru-RU')}` : ''
    lines.push(`• <b>${t.title}</b> — приоритет ${TASK_PRIORITY_LABELS[t.priority] ?? t.priority}${dueText}`)
    keyboard.push([{ text: `✅ Готово: ${t.title.slice(0, 24)}`, callback_data: `taskdone:${t.id}` }])
  }
  keyboard.push([BACK_TO_CRM])

  return { text: `✅ <b>Открытые задачи</b>\n\n${lines.join('\n')}`, keyboard }
}

export async function markTaskDone(orgId: string, taskId: string): Promise<{ error?: string }> {
  const supabaseAdmin = getSupabaseAdmin()
  const { error } = await supabaseAdmin.from('tasks').update({ status: 'done' }).eq('id', taskId).eq('organization_id', orgId)
  return { error: error?.message }
}
