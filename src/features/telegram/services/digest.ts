/**
 * «Что горит» — один сбор данных на два потребителя: утренний крон
 * (`/api/cron/daily-digest`) и экран «⚡ Сегодня» в меню бота.
 *
 * Раньше сбор жил только в кроне. Экрана в меню не было вовсе: узнать, что
 * горит, можно было исключительно дождавшись утреннего сообщения. Заводить в
 * меню вторую копию тех же запросов нельзя — копии словарей и фильтров в этой
 * подсистеме уже расходились дважды (статус `meeting` у лидов, легаси-таблица
 * `payments`), и каждый раз бот начинал уверенно говорить неправду.
 *
 * Источник начислений — `accounting_transactions` (type='income',
 * status='planned'), а не legacy-таблица `payments`: в неё приложение не пишет
 * с переезда бухгалтерии.
 *
 * Файл серверный, без 'use client'.
 */

import { getSupabaseAdmin } from '@/lib/supabase/admin'

/** Лид без движения дольше этого срока считается «молчащим». */
export const STALE_LEAD_DAYS = 3

export interface DigestPayment {
  id: string
  amount: number
  due_date: string | null
  label: string
}

export interface DigestTask {
  id: string
  title: string
  deadline: string | null
}

export interface DigestLead {
  id: string
  full_name: string | null
  status: string
}

export interface DigestData {
  /** Начисления, срок которых наступил или прошёл. */
  overduePayments: DigestPayment[]
  /** Задачи со сроком сегодня или раньше. */
  tasksDue: DigestTask[]
  /** Лиды в начале воронки, к которым не возвращались. */
  staleLeads: DigestLead[]
}

export function isQuiet(data: DigestData): boolean {
  return data.overduePayments.length === 0 && data.tasksDue.length === 0 && data.staleLeads.length === 0
}

function daysAgoIso(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

export async function collectDigest(orgId: string): Promise<DigestData> {
  const supabaseAdmin = getSupabaseAdmin()
  const today = new Date().toISOString().slice(0, 10)

  const [{ data: payments }, { data: tasks }, { data: leads }] = await Promise.all([
    supabaseAdmin
      .from('accounting_transactions')
      .select('id, amount, due_date, contracts:contract_id(contract_number)')
      .eq('organization_id', orgId)
      .eq('type', 'income')
      .eq('status', 'planned')
      .lte('due_date', today)
      .order('due_date', { ascending: true }),
    supabaseAdmin
      .from('tasks')
      .select('id, title, deadline')
      .eq('organization_id', orgId)
      .in('status', ['todo', 'in_progress'])
      .lte('deadline', today)
      .order('deadline', { ascending: true }),
    supabaseAdmin
      .from('leads')
      .select('id, full_name, status, created_at')
      .eq('organization_id', orgId)
      .in('status', ['new', 'contacted'])
      .lt('created_at', daysAgoIso(STALE_LEAD_DAYS))
      .order('created_at', { ascending: true }),
  ])

  return {
    overduePayments: (payments ?? []).map((p) => {
      const contract = Array.isArray(p.contracts) ? p.contracts[0] : p.contracts
      return {
        id: p.id,
        amount: Number(p.amount),
        due_date: p.due_date,
        label: contract?.contract_number
          ? `Договор ${contract.contract_number}`
          : `Начисление №${String(p.id).slice(0, 8)}`,
      }
    }),
    tasksDue: (tasks ?? []).map((t) => ({ id: t.id, title: t.title, deadline: t.deadline })),
    staleLeads: (leads ?? []).map((l) => ({ id: l.id, full_name: l.full_name, status: l.status })),
  }
}

/**
 * Текст сводки в Telegram-HTML. `maxPerSection` ограничивает список: полное
 * число всё равно называется в заголовке раздела, а простыня на сорок строк
 * в чате не читается.
 */
export function renderDigest(data: DigestData, maxPerSection = 7): string[] {
  const parts: string[] = []

  if (data.overduePayments.length > 0) {
    const lines = data.overduePayments
      .slice(0, maxPerSection)
      .map((p) => `• ${p.label} — ${p.amount.toLocaleString('ru-RU')} ₽${p.due_date ? ` (срок ${p.due_date})` : ''}`)
    parts.push(`💰 <b>Оплаты (${data.overduePayments.length})</b>\n${lines.join('\n')}`)
  }

  if (data.tasksDue.length > 0) {
    const lines = data.tasksDue
      .slice(0, maxPerSection)
      .map((t) => `• ${t.title}${t.deadline ? ` (срок ${String(t.deadline).slice(0, 10)})` : ''}`)
    parts.push(`✅ <b>Задачи (${data.tasksDue.length})</b>\n${lines.join('\n')}`)
  }

  if (data.staleLeads.length > 0) {
    const lines = data.staleLeads
      .slice(0, maxPerSection)
      .map((l) => `• ${l.full_name || 'Без имени'} — без движения ${STALE_LEAD_DAYS}+ дн.`)
    parts.push(`🧲 <b>Лиды без ответа (${data.staleLeads.length})</b>\n${lines.join('\n')}`)
  }

  return parts
}
