// Мостик между доменными событиями CRM и почтой: резолвит адрес получателя
// (сотрудник по user_id, клиент по contact_id) и зовёт нужный шаблон.
//
// Ни одна функция здесь не бросает исключений и не должна await-иться ради
// результата в критичном пути — почта вторична по отношению к самой операции.

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { isValidEmail } from './provider'
import { sendLeadAssignedEmail, sendTaskAssignedEmail } from './send'

/** Email сотрудника по его user_id. null, если сотрудник не найден или адрес битый. */
async function userEmail(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null
  try {
    const supabase = getSupabaseAdmin()
    const { data } = await supabase.from('users').select('email').eq('id', userId).maybeSingle()
    return isValidEmail(data?.email) ? data!.email : null
  } catch {
    return null
  }
}

export async function emailLeadAssigned(
  orgId: string,
  lead: {
    id: string
    full_name: string | null
    phone: string | null
    source: string | null
    comment?: string | null
    budget_min?: number | null
    budget_max?: number | null
    assigned_to: string | null
  },
  /** Не слать письмо тому, кто сам только что завёл лид — он и так о нём знает. */
  actorId?: string
): Promise<void> {
  if (!lead.assigned_to || lead.assigned_to === actorId) return
  const to = await userEmail(lead.assigned_to)
  if (!to) return

  const budget =
    lead.budget_min || lead.budget_max
      ? `${(lead.budget_min ?? 0).toLocaleString('ru-RU')} — ${(lead.budget_max ?? 0).toLocaleString('ru-RU')} ₽`
      : null

  await sendLeadAssignedEmail({
    orgId,
    to,
    leadId: lead.id,
    leadName: lead.full_name || 'Без имени',
    leadPhone: lead.phone,
    source: lead.source,
    budget,
    comment: lead.comment ?? null,
  })
}

export async function emailTaskAssigned(
  orgId: string,
  task: { id: string; title: string; deadline: string | null; description: string | null; assigned_to: string | null },
  actorId?: string
): Promise<void> {
  if (!task.assigned_to || task.assigned_to === actorId) return
  const to = await userEmail(task.assigned_to)
  if (!to) return

  await sendTaskAssignedEmail({
    orgId,
    to,
    taskId: task.id,
    title: task.title,
    deadline: task.deadline,
    description: task.description,
  })
}
