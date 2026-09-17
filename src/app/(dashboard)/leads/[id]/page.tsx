import { createClient } from '@/lib/supabase/server'
import { Phone, Mail, MessageCircle, UserCheck, Home, Edit, Plus, Users, FileText, Activity } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { convertLeadToClient } from '@/features/leads/actions/leads.actions'
import { deleteLeadAction } from '@/features/leads/actions/leads.actions'
import { RecordActions } from '@/components/layout/RecordActions'
import { ConfirmDeleteButton } from '@/components/forms/ConfirmDeleteButton'
import { LeadActivityForm } from '@/features/leads/components/LeadActivityForm'
import { LeadStatusSelect } from '@/features/leads/components/LeadStatusSelect'
import { ServerActionForm } from '@/components/forms/ServerActionForm'
import { PageHeader } from '@/components/layout/PageHeader'
import { ReadinessPanel } from '@/components/layout/ReadinessPanel'
import { checkLead } from '@/lib/readiness'
import { LEAD_STATUS_BADGE, LEAD_STATUS_LABELS } from '@/features/leads/config/lead-statuses'
import { LEAD_SOURCE_LABELS } from '@/features/leads/config/lead-sources'
import { LEAD_DEAL_TYPE_LABELS } from '@/features/leads/config/lead-deal-types'
import { formatDate, formatDeadline, plural } from '@/lib/utils'
import { contactDisplayName } from '@/features/contacts/config/display-name'
import { SHOWING_STATUS_LABELS, SHOWING_RESULT_LABELS } from '@/features/showings/config/showing-labels'

const sourceLabels = LEAD_SOURCE_LABELS
const dealTypeLabels: Record<string, string> = {
 ...LEAD_DEAL_TYPE_LABELS,
 management: 'Управление', commercial: 'Коммерция',
}
const propertyTypeLabels: Record<string, string> = {
 apartment: 'Квартира', house: 'Дом', commercial: 'Коммерция',
 office: 'Офис', warehouse: 'Склад', land: 'Участок',
}
const activityIcons: Record<string, typeof Phone> = {
 call: Phone, message: MessageCircle, meeting: Users,
 showing: Home, note: FileText, email: Mail,
}
const activityLabels: Record<string, string> = {
 call: 'Звонок', message: 'Сообщение', meeting: 'Встреча',
 showing: 'Показ', note: 'Заметка', email: 'Email',
}

const statusColors = LEAD_STATUS_BADGE
const statusLabels = LEAD_STATUS_LABELS

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
 const { id } = await params
 const supabase = await createClient()

 const [{ data: rawLead, error: leadError }, { data: rawActivities }, { data: rawTasks }, { data: rawShowings }] = await Promise.all([
 supabase.from('leads')
 .select('*, assignee:users!leads_assigned_to_fkey(full_name), contact:contacts!leads_contact_id_fkey(id, full_name, company_name, client_type)')
 .eq('id', id)
 .single(),
 supabase.from('lead_activities')
 .select('*, user:users(full_name)')
 .eq('lead_id', id)
 .order('created_at', { ascending: false }),
 // Задачи и показы по лиду: раньше они жили только в общих реестрах, и с
 // карточки было не видно, что по лиду уже что-то назначено (проход 17.09.2026, L-5/L-7).
 supabase.from('tasks')
 .select('id, title, status, deadline')
 .eq('lead_id', id)
 .order('deadline', { ascending: true, nullsFirst: false })
 .limit(8),
 supabase.from('showings')
 .select('id, scheduled_at, status, result, property:properties(title)')
 .eq('lead_id', id)
 .order('scheduled_at', { ascending: false })
 .limit(8),
 ])

 if (leadError && leadError.code !== 'PGRST116') {
 throw new Error(`Не удалось загрузить лид: ${leadError.message}`)
 }
 if (!rawLead) notFound()

 const lead = rawLead
 const activities = (rawActivities ?? [])
 const tasks = rawTasks ?? []
 const showings = (rawShowings ?? []).map(s => ({ ...s, property: s.property as { title?: string | null } | null }))
 const assignee = lead.assignee as { full_name?: string } | null
 const contact = lead.contact as { id: string; full_name: string | null; company_name: string | null; client_type: string | null } | null

 const issues = checkLead(lead)

 const isConverted = lead.status === 'converted' || lead.status === 'closed'
 const isOverdue = lead.next_contact_at && new Date(lead.next_contact_at) < new Date() && !isConverted

 const fmtDt = (d: string) => formatDate(d, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
 const criteria = [
 lead.deal_type && { label: 'Хочет', value: dealTypeLabels[lead.deal_type] ?? lead.deal_type },
 lead.property_type && { label: 'Тип объекта', value: propertyTypeLabels[lead.property_type] ?? lead.property_type },
 lead.rooms && { label: 'Комнат', value: String(lead.rooms) },
 (lead.budget_min || lead.budget_max) && { label: 'Бюджет', value: `${lead.budget_min ? Number(lead.budget_min).toLocaleString('ru-RU') : '0'} — ${lead.budget_max ? `${Number(lead.budget_max).toLocaleString('ru-RU')} ₽` : 'без верхней границы'}` },
 (lead.area_min || lead.area_max) && { label: 'Площадь', value: `${lead.area_min ?? '—'} – ${lead.area_max ?? '∞'} м²` },
 lead.district && { label: 'Район', value: lead.district },
 ].filter((c): c is { label: string; value: string } => Boolean(c))

 return (
 <div className="max-w-4xl mx-auto space-y-5">
 <PageHeader
 crumbs={[{ label: 'Лиды', href: '/leads' }, { label: statusLabels[lead.status] ?? lead.status }]}
 title={lead.full_name || lead.phone || 'Без имени'}
 badges={
 <span className="flex items-center gap-1.5 flex-wrap">
 <span className={`hp-badge ${statusColors[lead.status] ?? 'hp-badge-neutral'}`}>{statusLabels[lead.status] ?? lead.status}</span>
 {isOverdue && <span className="hp-badge hp-badge-danger">Просрочен контакт</span>}
 </span>
 }
 meta={
 <>
 {lead.source && <span>{sourceLabels[lead.source] ?? lead.source}</span>}
 {lead.source && <span className="sep">·</span>}
 <span>добавлен {formatDate(lead.created_at)}</span>
 {assignee?.full_name && (<><span className="sep">·</span><span>риелтор {assignee.full_name}</span></>)}
 </>
 }
 actions={
 <RecordActions
 /* Главное действие лида — сделать его контактом: после этого с карточки
 контакта одной кнопкой заводится сделка. Раньше «Создать сделку» была
 прямо здесь, но передавала id лида вместо контакта и молча ничего не
 подставляла. */
 primary={lead.status === 'converted' && lead.contact_id ? (
 /* Конвертированный лид — история обращения; работа идёт в контакте. */
 <Link href={`/contacts/${lead.contact_id}`} className="hp-btn-primary" data-testid="lead-open-contact">
 <UserCheck className="w-4 h-4" />
 Открыть контакт
 </Link>
 ) : !isConverted && (
 <ServerActionForm action={convertLeadToClient.bind(null, id)}>
 <button type="submit" className="hp-btn-primary" data-testid="lead-convert">
 <UserCheck className="w-4 h-4" />
 В контакты
 </button>
 </ServerActionForm>
 )}
 secondary={lead.status !== 'converted' && (
 <Link href={`/leads/${id}/edit`} className="hp-btn-secondary" data-testid="lead-edit">
 <Edit className="w-4 h-4" />
 Редактировать
 </Link>
 )}
 more={
 <>
 <Link href={`/tasks/new?lead_id=${id}`} className="hp-menu-item" role="menuitem">
 <Plus className="w-4 h-4" />
 Поставить задачу
 </Link>
 <Link href={`/showings/new?lead_id=${id}${lead.property_id ? `&property_id=${lead.property_id}` : ''}`} className="hp-menu-item" role="menuitem">
 <Home className="w-4 h-4" />
 Запланировать показ
 </Link>
 <ConfirmDeleteButton
 action={deleteLeadAction.bind(null, id)}
 confirmText={`Удалить лид «${lead.full_name || lead.phone || 'без имени'}»? История звонков по нему тоже удалится. Отменить нельзя.`}
 label="Удалить лид"
 />
 </>
 }
 />
 }
 />

 <ReadinessPanel issues={issues} />

 {/* Статус — то, ради чего открывают карточку: сразу под шапкой */}
 <div className="hp-block">
 <div className="hp-block-header">Статус</div>
 <div className="px-[18px] py-3">
 <LeadStatusSelect leadId={id} currentStatus={lead.status} />
 </div>
 </div>

 <div className="grid lg:grid-cols-3 gap-4 items-start">
 <div className="lg:col-span-2 space-y-4">

 <div className="hp-block">
 <div className="hp-block-header">Контакт</div>
 {lead.phone && (
 <a href={`tel:${lead.phone}`} className="hp-block-item">
 <Phone className="w-4 h-4 shrink-0 text-[var(--hp-sub)]" />
 <span className="flex-1 min-w-0 truncate text-[var(--hp-ink)] font-medium">{lead.phone}</span>
 <span className="shrink-0 text-[11px] uppercase tracking-wide text-[var(--hp-tertiary)]">Телефон</span>
 </a>
 )}
 {lead.email && (
 <a href={`mailto:${lead.email}`} className="hp-block-item">
 <Mail className="w-4 h-4 shrink-0 text-[var(--hp-sub)]" />
 <span className="flex-1 min-w-0 truncate text-[var(--hp-ink)] font-medium">{lead.email}</span>
 <span className="shrink-0 text-[11px] uppercase tracking-wide text-[var(--hp-tertiary)]">Email</span>
 </a>
 )}
 {lead.telegram && (
 <div className="hp-block-item">
 <MessageCircle className="w-4 h-4 shrink-0 text-[var(--hp-sub)]" />
 <span className="flex-1 min-w-0 truncate text-[var(--hp-ink)] font-medium">{lead.telegram}</span>
 <span className="shrink-0 text-[11px] uppercase tracking-wide text-[var(--hp-tertiary)]">Telegram</span>
 </div>
 )}
 {lead.whatsapp && (
 <div className="hp-block-item">
 <MessageCircle className="w-4 h-4 shrink-0 text-[var(--hp-sub)]" />
 <span className="flex-1 min-w-0 truncate text-[var(--hp-ink)] font-medium">{lead.whatsapp}</span>
 <span className="shrink-0 text-[11px] uppercase tracking-wide text-[var(--hp-tertiary)]">WhatsApp</span>
 </div>
 )}
 {!lead.phone && !lead.email && !lead.telegram && !lead.whatsapp && (
 <div className="hp-block-item text-[var(--hp-tertiary)]">Контакты не указаны</div>
 )}
 </div>

 {criteria.length > 0 && (
 <div className="hp-block">
 <div className="hp-block-header">Что ищет</div>
 <div className="hp-block-grid">
 {criteria.map(c => (
 <div key={c.label} className="hp-block-row"><span className="label">{c.label}</span><span className="value">{c.value}</span></div>
 ))}
 </div>
 </div>
 )}

 {lead.comment && (
 <div className="hp-block">
 <div className="hp-block-header">Комментарий</div>
 <p className="px-[18px] py-3 text-sm text-[var(--hp-sub)] whitespace-pre-wrap leading-relaxed">{lead.comment}</p>
 </div>
 )}

 <div className="hp-block">
 <div className="hp-block-header flex items-center justify-between">
 <span>История общения</span>
 <span className="normal-case tracking-normal text-[11px] text-[var(--hp-tertiary)]">{plural(activities.length, ['запись', 'записи', 'записей'])}</span>
 </div>
 {!isConverted && (
 <div className="px-[18px] py-3 border-b border-[var(--hp-border-soft)]">
 <LeadActivityForm leadId={id} />
 </div>
 )}
 {activities.length === 0 ? (
 <div className="hp-block-item text-[var(--hp-tertiary)]">
 <Activity className="w-4 h-4 shrink-0" />
 Пока ничего не записано — отметьте первый звонок или сообщение
 </div>
 ) : (
 activities.map(act => {
 const ActivityIcon = activityIcons[act.type] ?? Activity
 return (
 <div key={act.id} className="hp-block-item items-start">
 <ActivityIcon className="w-4 h-4 shrink-0 text-[var(--hp-sub)] mt-0.5" />
 <div className="flex-1 min-w-0">
 <p className="text-sm text-[var(--hp-ink)]">
 <span className="font-medium">{activityLabels[act.type] ?? act.type}</span>
 <span className="text-[var(--hp-tertiary)]"> · {act.created_at ? fmtDt(act.created_at) : ""}{act.user?.full_name ? ` · ${act.user.full_name}` : ''}</span>
 </p>
 {act.content && <p className="text-sm text-[var(--hp-sub)] mt-0.5 whitespace-pre-wrap">{act.content}</p>}
 {act.result && <p className="text-xs text-[var(--hp-sub)] mt-0.5">Результат: {act.result}</p>}
 {act.scheduled_at && <p className="text-xs text-[var(--hp-accent)] mt-0.5">Следующий контакт: {fmtDt(act.scheduled_at)}</p>}
 </div>
 </div>
 )
 })
 )}
 </div>
 </div>

 <div className="space-y-4">
 {contact && (
 <div className="hp-block">
 <div className="hp-block-header">Контакт из лида</div>
 <Link href={`/contacts/${contact.id}`} className="hp-block-item">
 <UserCheck className="w-4 h-4 shrink-0 text-[var(--hp-sub)]" />
 <span className="flex-1 min-w-0 truncate text-[var(--hp-ink)] font-medium">{contactDisplayName(contact)}</span>
 <span className="shrink-0 text-[11px] text-[var(--hp-sub)]">открыть</span>
 </Link>
 </div>
 )}

 <div className="hp-block">
 <div className="hp-block-header flex items-center justify-between">
 <span>Задачи</span>
 <Link href={`/tasks/new?lead_id=${id}`} className="flex items-center gap-1 normal-case tracking-normal text-[11px] font-semibold text-[var(--hp-sub)] hover:text-[var(--hp-ink)] transition-colors">
 <Plus className="w-3 h-3" />
 Задача
 </Link>
 </div>
 {tasks.length === 0 && <div className="hp-block-item text-[var(--hp-tertiary)]">Задач по лиду нет</div>}
 {tasks.map(t => {
 const dl = formatDeadline(t.deadline)
 const done = t.status === 'done' || t.status === 'cancelled'
 return (
 <Link key={t.id} href={`/tasks/${t.id}`} className="hp-block-item">
 <span className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${done ? 'bg-[var(--hp-good)]' : dl?.overdue ? 'bg-[var(--hp-danger)]' : 'bg-[var(--hp-sub)]'}`} />
 <span className={`flex-1 min-w-0 truncate ${done ? 'line-through text-[var(--hp-tertiary)]' : 'text-[var(--hp-ink)]'}`}>{t.title}</span>
 {dl && !done && <span className={`shrink-0 text-[11.5px] ${dl.overdue ? 'text-[var(--hp-danger)]' : 'text-[var(--hp-sub)]'}`}>{dl.label}</span>}
 </Link>
 )
 })}
 </div>

 <div className="hp-block">
 <div className="hp-block-header flex items-center justify-between">
 <span>Показы</span>
 <Link href={`/showings/new?lead_id=${id}${lead.property_id ? `&property_id=${lead.property_id}` : ''}`} className="flex items-center gap-1 normal-case tracking-normal text-[11px] font-semibold text-[var(--hp-sub)] hover:text-[var(--hp-ink)] transition-colors">
 <Plus className="w-3 h-3" />
 Показ
 </Link>
 </div>
 {showings.length === 0 && <div className="hp-block-item text-[var(--hp-tertiary)]">Показов по лиду нет</div>}
 {showings.map(sh => (
 <Link key={sh.id} href={`/showings/${sh.id}`} className="hp-block-item">
 <Home className="w-4 h-4 shrink-0 text-[var(--hp-sub)]" />
 <span className="flex-1 min-w-0 truncate text-[var(--hp-ink)]">{sh.property?.title ?? 'Показ'} · {fmtDt(sh.scheduled_at)}</span>
 <span className="shrink-0 text-[11.5px] text-[var(--hp-sub)]">{SHOWING_STATUS_LABELS[sh.status] ?? sh.status}{sh.result ? ` · ${SHOWING_RESULT_LABELS[sh.result] ?? sh.result}` : ''}</span>
 </Link>
 ))}
 </div>

 <div className="hp-block">
 <div className="hp-block-header">Детали</div>
 <div className="hp-block-row">
 <span className="label">Следующий контакт</span>
 <span className={`value${isOverdue ? ' danger' : ''}`}>{lead.next_contact_at ? fmtDt(lead.next_contact_at) : <span className="text-[var(--hp-tertiary)] font-normal">не назначен</span>}</span>
 </div>
 {assignee?.full_name && (
 <div className="hp-block-row"><span className="label">Ответственный</span><span className="value">{assignee.full_name}</span></div>
 )}
 <div className="hp-block-row"><span className="label">Добавлен</span><span className="value">{formatDate(lead.created_at)}</span></div>
 {lead.updated_at && (
 <div className="hp-block-row"><span className="label">Обновлён</span><span className="value">{formatDate(lead.updated_at)}</span></div>
 )}
 </div>
 </div>
 </div>
 </div>
 )
}
