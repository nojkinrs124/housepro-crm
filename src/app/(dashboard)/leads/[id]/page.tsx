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
import { formatDate } from '@/lib/utils'

const sourceLabels = LEAD_SOURCE_LABELS
const dealTypeLabels: Record<string, string> = {
 rent: 'Снять', sale: 'Купить', subrent: 'Субаренда',
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

 const [{ data: rawLead, error: leadError }, { data: rawActivities }] = await Promise.all([
 supabase.from('leads')
 .select('*, assignee:users!leads_assigned_to_fkey(full_name)')
 .eq('id', id)
 .single(),
 supabase.from('lead_activities')
 .select('*, user:users(full_name)')
 .eq('lead_id', id)
 .order('created_at', { ascending: false }),
 ])

 if (leadError && leadError.code !== 'PGRST116') {
 throw new Error(`Не удалось загрузить лид: ${leadError.message}`)
 }
 if (!rawLead) notFound()

 const lead = rawLead
 const activities = (rawActivities ?? [])
 const assignee = lead.assignee as { full_name?: string } | null

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
 primary={!isConverted && (
 <ServerActionForm action={convertLeadToClient.bind(null, id)}>
 <button type="submit" className="hp-btn-primary" data-testid="lead-convert">
 <UserCheck className="w-4 h-4" />
 В контакты
 </button>
 </ServerActionForm>
 )}
 secondary={
 <Link href={`/leads/${id}/edit`} className="hp-btn-secondary" data-testid="lead-edit">
 <Edit className="w-4 h-4" />
 Редактировать
 </Link>
 }
 more={
 <>
 <Link href={`/tasks/new?lead_id=${id}`} className="hp-menu-item" role="menuitem">
 <Plus className="w-4 h-4" />
 Поставить задачу
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
 <span className="normal-case tracking-normal text-[11px] text-[var(--hp-tertiary)]">{activities.length} записей</span>
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
