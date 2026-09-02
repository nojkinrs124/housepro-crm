// Прикладной слой почты: типовые письма CRM + журнал отправок.
//
// Все функции безопасны для вызова из любого места (cron, server action, webhook):
// они никогда не бросают исключение — почта не должна ронять основной флоу, ровно
// как writeAuditLog в lib/audit.ts. Результат возвращается вызывающему, если тот
// хочет показать пользователю «письмо отправлено».

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getSiteUrl } from '@/lib/telegram/site-url'
import { dispatchEmail, isValidEmail, type EmailAttachment, type EmailSendResult } from './provider'
import { layout, p, rows, toPlainText } from './templates'
import { formatDate, formatMoney } from '@/lib/utils'

export type EmailKind =
  | 'payment_reminder'
  | 'payment_overdue'
  | 'contract_ready'
  | 'collection_shared'
  | 'showing_scheduled'
  | 'lead_assigned'
  | 'task_assigned'
  | 'custom'

interface OrgEmailContext {
  companyName: string
  footerNote: string
  replyTo?: string
}

/** Реквизиты для шапки и подписи письма берём из профиля компании организации. */
export async function getOrgEmailContext(orgId: string): Promise<OrgEmailContext> {
  const fallback: OrgEmailContext = { companyName: 'HousePro CRM', footerNote: '' }
  try {
    const supabase = getSupabaseAdmin()
    const { data } = await supabase
      .from('company_settings')
      .select('name, phone, email, website')
      .eq('organization_id', orgId)
      .order('is_default', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!data) return fallback
    const contacts = [data.phone, data.website].filter(Boolean).join(' · ')
    return {
      companyName: data.name || fallback.companyName,
      footerNote: contacts,
      replyTo: isValidEmail(data.email) ? data.email : undefined,
    }
  } catch {
    return fallback
  }
}

interface SendEmailParams {
  orgId: string
  to: string | string[]
  subject: string
  html: string
  kind: EmailKind
  replyTo?: string
  attachments?: EmailAttachment[]
  entityType?: string
  entityId?: string
  /** Название компании в шапке — если уже загружено, чтобы не ходить в БД дважды. */
  companyName?: string
}

async function logEmail(params: SendEmailParams, result: EmailSendResult): Promise<void> {
  try {
    const supabase = getSupabaseAdmin()
    await supabase.from('email_log').insert({
      organization_id: params.orgId,
      recipient: Array.isArray(params.to) ? params.to.join(', ') : params.to,
      subject: params.subject,
      kind: params.kind,
      status: result.skipped ? 'skipped' : result.ok ? 'sent' : 'failed',
      provider: result.provider,
      provider_message_id: result.messageId ?? null,
      error: result.error ?? null,
      entity_type: params.entityType ?? null,
      entity_id: params.entityId ?? null,
    })
  } catch (e) {
    console.error('[email] не удалось записать email_log:', e)
  }
}

/** Базовая отправка: диспатч + журнал. Не бросает исключений. */
export async function sendEmail(params: SendEmailParams): Promise<EmailSendResult> {
  const result = await dispatchEmail(
    {
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: toPlainText(params.html),
      replyTo: params.replyTo,
      attachments: params.attachments,
    },
    { fromName: params.companyName }
  )
  await logEmail(params, result)
  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// Типовые письма
// ─────────────────────────────────────────────────────────────────────────────

export interface PaymentEmailParams {
  orgId: string
  to: string
  amount: number | string
  dueDate: string | null
  contractNumber?: string | null
  address?: string | null
  paymentId?: string
  /** Ссылка на онлайн-оплату, если платёж выставлен через эквайринг. */
  payUrl?: string | null
  daysOverdue?: number
}

export async function sendPaymentReminderEmail(params: PaymentEmailParams): Promise<EmailSendResult> {
  const ctx = await getOrgEmailContext(params.orgId)
  const title = 'Напоминание об оплате'
  const html = layout(
    title,
    p(`Напоминаем о предстоящем платеже${params.contractNumber ? ` по договору №${params.contractNumber}` : ''}.`) +
      rows([
        ['Сумма', formatMoney(params.amount)],
        ['Срок оплаты', formatDate(params.dueDate)],
        ['Договор', params.contractNumber ?? null],
        ['Объект', params.address ?? null],
      ]) +
      p('Если платёж уже произведён — просто проигнорируйте это письмо.'),
    {
      companyName: ctx.companyName,
      footerNote: ctx.footerNote,
      cta: params.payUrl ? { label: 'Оплатить онлайн', url: params.payUrl } : undefined,
    }
  )

  return sendEmail({
    orgId: params.orgId,
    to: params.to,
    subject: `${title}${params.contractNumber ? ` — договор №${params.contractNumber}` : ''}`,
    html,
    kind: 'payment_reminder',
    replyTo: ctx.replyTo,
    companyName: ctx.companyName,
    entityType: 'payment',
    entityId: params.paymentId,
  })
}

export async function sendPaymentOverdueEmail(params: PaymentEmailParams): Promise<EmailSendResult> {
  const ctx = await getOrgEmailContext(params.orgId)
  const title = 'Платёж просрочен'
  const html = layout(
    title,
    p(
      `Платёж${params.contractNumber ? ` по договору №${params.contractNumber}` : ''} не поступил в срок` +
        `${params.daysOverdue ? ` — просрочка ${params.daysOverdue} дн.` : ''}.`
    ) +
      rows([
        ['Сумма', formatMoney(params.amount)],
        ['Ожидался', formatDate(params.dueDate)],
        ['Договор', params.contractNumber ?? null],
        ['Объект', params.address ?? null],
      ]) +
      p('Пожалуйста, свяжитесь с нами или произведите оплату.'),
    {
      companyName: ctx.companyName,
      footerNote: ctx.footerNote,
      tone: 'alert',
      cta: params.payUrl ? { label: 'Оплатить онлайн', url: params.payUrl } : undefined,
    }
  )

  return sendEmail({
    orgId: params.orgId,
    to: params.to,
    subject: `Просроченный платёж${params.contractNumber ? ` — договор №${params.contractNumber}` : ''}`,
    html,
    kind: 'payment_overdue',
    replyTo: ctx.replyTo,
    companyName: ctx.companyName,
    entityType: 'payment',
    entityId: params.paymentId,
  })
}

export async function sendContractReadyEmail(params: {
  orgId: string
  to: string
  contractNumber?: string | null
  contractType?: string | null
  address?: string | null
  startDate?: string | null
  endDate?: string | null
  amount?: number | string | null
  contractId?: string
  attachment?: EmailAttachment
  comment?: string | null
}): Promise<EmailSendResult> {
  const ctx = await getOrgEmailContext(params.orgId)
  const title = params.contractNumber ? `Договор №${params.contractNumber}` : 'Договор готов'
  const html = layout(
    title,
    p('Направляем подготовленный договор. Файл во вложении.') +
      rows([
        ['Объект', params.address ?? null],
        ['Период', params.startDate ? `${formatDate(params.startDate)} — ${formatDate(params.endDate)}` : null],
        ['Сумма', params.amount ? formatMoney(params.amount) : null],
      ]) +
      (params.comment ? p(params.comment) : '') +
      p('Если в реквизитах есть неточности — сообщите, поправим и пришлём новую версию.'),
    { companyName: ctx.companyName, footerNote: ctx.footerNote }
  )

  return sendEmail({
    orgId: params.orgId,
    to: params.to,
    subject: title,
    html,
    kind: 'contract_ready',
    replyTo: ctx.replyTo,
    companyName: ctx.companyName,
    attachments: params.attachment ? [params.attachment] : undefined,
    entityType: 'contract',
    entityId: params.contractId,
  })
}

export async function sendCollectionSharedEmail(params: {
  orgId: string
  to: string
  collectionTitle: string
  shareUrl: string
  itemsCount: number
  agentName?: string | null
  comment?: string | null
  collectionId?: string
}): Promise<EmailSendResult> {
  const ctx = await getOrgEmailContext(params.orgId)
  const title = 'Подборка объектов для вас'
  const html = layout(
    title,
    p(`${params.agentName ? `${params.agentName} подготовил` : 'Мы подготовили'} для вас подборку «${params.collectionTitle}» — ${params.itemsCount} объект(ов).`) +
      (params.comment ? p(params.comment) : '') +
      p('Ссылка открывается без регистрации, её можно переслать близким.'),
    {
      companyName: ctx.companyName,
      footerNote: ctx.footerNote,
      cta: { label: 'Открыть подборку', url: params.shareUrl },
    }
  )

  return sendEmail({
    orgId: params.orgId,
    to: params.to,
    subject: `${title} — ${params.collectionTitle}`,
    html,
    kind: 'collection_shared',
    replyTo: ctx.replyTo,
    companyName: ctx.companyName,
    entityType: 'collection',
    entityId: params.collectionId,
  })
}

export async function sendShowingScheduledEmail(params: {
  orgId: string
  to: string
  scheduledAt: string
  address?: string | null
  agentName?: string | null
  agentPhone?: string | null
  showingId?: string
  /** iCal-вложение, чтобы показ добавился в календарь клиента одним кликом. */
  icsContent?: string
}): Promise<EmailSendResult> {
  const ctx = await getOrgEmailContext(params.orgId)
  const when = new Date(params.scheduledAt)
  const whenLabel = Number.isNaN(when.getTime())
    ? params.scheduledAt
    : when.toLocaleString('ru-RU', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })

  const html = layout(
    'Показ объекта назначен',
    p('Подтверждаем время показа.') +
      rows([
        ['Когда', whenLabel],
        ['Адрес', params.address ?? null],
        ['Агент', params.agentName ?? null],
        ['Телефон агента', params.agentPhone ?? null],
      ]) +
      p('Если планы изменились — напишите или позвоните, перенесём.'),
    { companyName: ctx.companyName, footerNote: ctx.footerNote }
  )

  return sendEmail({
    orgId: params.orgId,
    to: params.to,
    subject: `Показ ${whenLabel}${params.address ? ` — ${params.address}` : ''}`,
    html,
    kind: 'showing_scheduled',
    replyTo: ctx.replyTo,
    companyName: ctx.companyName,
    attachments: params.icsContent
      ? [
          {
            filename: 'showing.ics',
            content: Buffer.from(params.icsContent, 'utf-8').toString('base64'),
            contentType: 'text/calendar',
          },
        ]
      : undefined,
    entityType: 'showing',
    entityId: params.showingId,
  })
}

export async function sendLeadAssignedEmail(params: {
  orgId: string
  to: string
  leadName: string
  leadPhone?: string | null
  source?: string | null
  budget?: string | null
  comment?: string | null
  leadId: string
}): Promise<EmailSendResult> {
  const ctx = await getOrgEmailContext(params.orgId)
  const html = layout(
    'Вам назначен новый лид',
    rows([
      ['Клиент', params.leadName],
      ['Телефон', params.leadPhone ?? null],
      ['Источник', params.source ?? null],
      ['Бюджет', params.budget ?? null],
    ]) + (params.comment ? p(params.comment) : ''),
    {
      companyName: ctx.companyName,
      footerNote: ctx.footerNote,
      cta: { label: 'Открыть карточку лида', url: `${getSiteUrl()}/leads/${params.leadId}` },
    }
  )

  return sendEmail({
    orgId: params.orgId,
    to: params.to,
    subject: `Новый лид: ${params.leadName}`,
    html,
    kind: 'lead_assigned',
    companyName: ctx.companyName,
    entityType: 'lead',
    entityId: params.leadId,
  })
}

export async function sendTaskAssignedEmail(params: {
  orgId: string
  to: string
  title: string
  deadline?: string | null
  description?: string | null
  taskId: string
}): Promise<EmailSendResult> {
  const ctx = await getOrgEmailContext(params.orgId)
  const html = layout(
    'Вам назначена задача',
    rows([
      ['Задача', params.title],
      ['Срок', params.deadline ? formatDate(params.deadline) : null],
    ]) + (params.description ? p(params.description) : ''),
    {
      companyName: ctx.companyName,
      footerNote: ctx.footerNote,
      cta: { label: 'Открыть задачу', url: `${getSiteUrl()}/tasks/${params.taskId}` },
    }
  )

  return sendEmail({
    orgId: params.orgId,
    to: params.to,
    subject: `Задача: ${params.title}`,
    html,
    kind: 'task_assigned',
    companyName: ctx.companyName,
    entityType: 'task',
    entityId: params.taskId,
  })
}

// ─── Мостик между доменными событиями CRM и почтой ────────────────────────────
// Резолвит адрес получателя (сотрудник по user_id) и зовёт нужный шаблон.
// Ни одна функция ниже не бросает исключений и не должна await-иться ради
// результата в критичном пути — почта вторична по отношению к самой операции.
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
