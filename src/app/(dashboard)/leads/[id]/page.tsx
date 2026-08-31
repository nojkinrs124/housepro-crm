import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, Phone, Mail, MessageCircle, Clock, UserCheck, MapPin, Home, DollarSign, Zap, Edit, Plus, Users, FileText, Activity, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { convertLeadToClient } from '@/features/leads/actions/leads.actions'
import { DeleteLeadButton } from '@/features/leads/components/DeleteLeadButton'
import { LeadActivityForm } from '@/features/leads/components/LeadActivityForm'
import { LeadStatusSelect } from '@/features/leads/components/LeadStatusSelect'
import { ServerActionForm } from '@/components/forms/ServerActionForm'
import { PageHeader } from '@/components/layout/PageHeader'

const sourceLabels: Record<string, string> = {
 avito: 'Авито', cian: 'ЦИАН', domclick: 'Домклик',
 whatsapp: 'WhatsApp', telegram: 'Telegram', call: 'Звонок',
 website: 'Сайт', referral: 'Рекомендация',
 instagram: 'Instagram', vk: 'VK', other: 'Другое',
}
const dealTypeLabels: Record<string, string> = {
 rent: 'Аренда', sale: 'Покупка', subrent: 'Субаренда',
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

const statusColors: Record<string, string> = {
 new: 'bg-blue-100 text-blue-700',
 contacted: 'bg-yellow-100 text-yellow-700',
 showing: 'bg-orange-100 text-orange-700',
 searching: 'bg-purple-100 text-purple-700',
 converted: 'bg-green-100 text-green-700',
 closed: 'bg-gray-100 text-gray-500',
 interested:'bg-cyan-100 text-cyan-700',
 rejected: 'bg-red-100 text-red-500',
}
const statusLabels: Record<string, string> = {
 new: 'Новый', contacted: 'Связались', showing: 'Показ',
 searching: 'Подбор', converted: 'Конвертирован',
 closed: 'Закрыт', interested: 'Заинтересован', rejected: 'Отказ',
}

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

 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const lead = rawLead as any
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const activities = (rawActivities ?? []) as any[]
 const assignee = lead.assignee as { full_name?: string } | null

 const isConverted = lead.status === 'converted' || lead.status === 'closed'
 const isOverdue = lead.next_contact_at && new Date(lead.next_contact_at) < new Date() && !isConverted

 return (
 <div className="max-w-4xl mx-auto space-y-6">
 <PageHeader
 title={lead.full_name || 'Без имени'}
 backHref="/leads"
 backLabel="Все лиды"
 iconBg="bg-blue-100"
 iconBoxClassName="w-14 h-14"
 icon={
 <span className="text-blue-600 text-2xl font-bold">
 {lead.full_name?.charAt(0)?.toUpperCase() ?? '?'}
 </span>
 }
 subtitle={
 <span className="flex items-center gap-2 flex-wrap">
 <span className={`text-xs px-2.5 py-1 rounded-[var(--hp-radius-badge)] font-medium ${statusColors[lead.status] ?? 'bg-gray-100'}`}>
 {statusLabels[lead.status] ?? lead.status}
 </span>
 {lead.source && (
 <span className="text-xs text-muted-foreground">{sourceLabels[lead.source] ?? lead.source}</span>
 )}
 {isOverdue && (
 <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-[var(--hp-radius-badge)] font-medium bg-red-100 text-red-700 animate-pulse">
 <AlertTriangle className="w-3 h-3" />
 Просрочен контакт
 </span>
 )}
 </span>
 }
 actions={
 <>
 {!isConverted && (
 <ServerActionForm action={convertLeadToClient.bind(null, id)}>
 <button type="submit"
 className="flex items-center gap-2 px-4 py-2 text-white text-sm font-bold transition whitespace-nowrap" style={{ background: 'var(--hp-accent)', }}>
 <UserCheck className="w-4 h-4" />
 → Контакт
 </button>
 </ServerActionForm>
 )}
 <Link href={`/leads/${id}/edit`}
 className="flex items-center gap-2 px-4 py-2 border border-border text-sm font-medium hover:bg-accent transition whitespace-nowrap">
 <Edit className="w-4 h-4" />
 Изменить
 </Link>
 <DeleteLeadButton leadId={id} />
 </>
 }
 />

 <div className="grid lg:grid-cols-3 gap-6">
 <div className="lg:col-span-2 space-y-4">

 {/* Контактная информация */}
 <div className="hp-card p-5">
 <h2 className="font-semibold text-foreground mb-4">Контактные данные</h2>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 {lead.phone && (
 <a href={`tel:${lead.phone}`}
 className="flex items-center gap-3 p-3 bg-muted/30 hover:bg-accent transition">
 <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
 <div>
 <p className="text-xs text-muted-foreground">Телефон</p>
 <p className="text-sm font-medium text-foreground">{lead.phone}</p>
 </div>
 </a>
 )}
 {lead.email && (
 <a href={`mailto:${lead.email}`}
 className="flex items-center gap-3 p-3 bg-muted/30 hover:bg-accent transition">
 <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
 <div>
 <p className="text-xs text-muted-foreground">Email</p>
 <p className="text-sm font-medium text-foreground truncate">{lead.email}</p>
 </div>
 </a>
 )}
 {lead.telegram && (
 <div className="flex items-center gap-3 p-3 bg-muted/30">
 <MessageCircle className="w-4 h-4 text-blue-400 shrink-0" />
 <div>
 <p className="text-xs text-muted-foreground">Telegram</p>
 <p className="text-sm font-medium text-foreground">{lead.telegram}</p>
 </div>
 </div>
 )}
 {lead.whatsapp && (
 <div className="flex items-center gap-3 p-3 bg-muted/30">
 <MessageCircle className="w-4 h-4 text-green-500 shrink-0" />
 <div>
 <p className="text-xs text-muted-foreground">WhatsApp</p>
 <p className="text-sm font-medium text-foreground">{lead.whatsapp}</p>
 </div>
 </div>
 )}
 </div>
 </div>

 {/* Критерии подбора */}
 {(lead.deal_type || lead.property_type || lead.budget_min || lead.budget_max || lead.rooms || lead.district || lead.area_min || lead.area_max) && (
 <div className="hp-card p-5">
 <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
 <Home className="w-4 h-4" />
 Критерии подбора
 </h2>
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
 {lead.deal_type && (
 <div className="p-3 bg-blue-50 text-center">
 <p className="text-xs text-blue-500 font-medium">Тип сделки</p>
 <p className="text-sm font-semibold text-blue-900 mt-0.5">{dealTypeLabels[lead.deal_type] ?? lead.deal_type}</p>
 </div>
 )}
 {lead.property_type && (
 <div className="p-3 bg-muted/30 text-center">
 <p className="text-xs text-muted-foreground font-medium">Тип объекта</p>
 <p className="text-sm font-semibold text-foreground mt-0.5">{propertyTypeLabels[lead.property_type] ?? lead.property_type}</p>
 </div>
 )}
 {lead.rooms && (
 <div className="p-3 bg-muted/30 text-center">
 <p className="text-xs text-muted-foreground font-medium">Комнат</p>
 <p className="text-sm font-semibold text-foreground mt-0.5">{lead.rooms}</p>
 </div>
 )}
 {(lead.budget_min || lead.budget_max) && (
 <div className="p-3 bg-green-50 col-span-2 sm:col-span-1">
 <p className="text-xs text-green-600 font-medium flex items-center gap-1">
 <DollarSign className="w-3 h-3" /> Бюджет
 </p>
 <p className="text-sm font-semibold text-green-900 mt-0.5">
 {lead.budget_min ? `${Number(lead.budget_min).toLocaleString('ru-RU')}` : '0'} —{' '}
 {lead.budget_max ? `${Number(lead.budget_max).toLocaleString('ru-RU')} ₽` : '∞'}
 </p>
 </div>
 )}
 {(lead.area_min || lead.area_max) && (
 <div className="p-3 bg-muted/30 text-center">
 <p className="text-xs text-muted-foreground font-medium">Площадь</p>
 <p className="text-sm font-semibold text-foreground mt-0.5">
 {lead.area_min ?? '—'} – {lead.area_max ?? '∞'} м²
 </p>
 </div>
 )}
 {lead.district && (
 <div className="p-3 bg-muted/30">
 <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
 <MapPin className="w-3 h-3" /> Район
 </p>
 <p className="text-sm font-semibold text-foreground mt-0.5">{lead.district}</p>
 </div>
 )}
 </div>
 </div>
 )}

 {/* Комментарий */}
 {lead.comment && (
 <div className="hp-card p-5">
 <h2 className="font-semibold text-foreground mb-2">Комментарий</h2>
 <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{lead.comment}</p>
 </div>
 )}

 {/* Активности */}
 <div className="hp-card p-5">
 <div className="flex items-center justify-between mb-4">
 <h2 className="font-semibold text-foreground">История активности</h2>
 <span className="text-xs text-muted-foreground">{activities.length} записей</span>
 </div>

 {/* Форма добавления активности */}
 {!isConverted && <LeadActivityForm leadId={id} />}

 {/* Список активностей */}
 {activities.length === 0 ? (
 <div className="text-center py-6 text-muted-foreground text-sm mt-4">
 Активностей ещё нет — добавьте первую
 </div>
 ) : (
 <div className="mt-4 space-y-3">
 {activities.map(act => {
 const ActivityIcon = activityIcons[act.type] ?? Activity
 return (
 <div key={act.id} className="flex gap-3">
 <div className="w-8 h-8 bg-muted flex items-center justify-center shrink-0">
 <ActivityIcon className="w-4 h-4 text-muted-foreground" />
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <span className="text-sm font-medium text-foreground">
 {activityLabels[act.type] ?? act.type}
 </span>
 <span className="text-xs text-muted-foreground">
 {new Date(act.created_at).toLocaleDateString('ru-RU', {
 day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
 })}
 </span>
 {act.user?.full_name && (
 <span className="text-xs text-muted-foreground">· {act.user.full_name}</span>
 )}
 </div>
 {act.content && (
 <p className="text-sm text-foreground mt-0.5">{act.content}</p>
 )}
 {act.result && (
 <p className="text-xs text-muted-foreground mt-0.5 italic">Результат: {act.result}</p>
 )}
 {act.scheduled_at && (
 <p className="text-xs text-primary mt-0.5">
 Следующий: {new Date(act.scheduled_at).toLocaleDateString('ru-RU', {
 day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
 })}
 </p>
 )}
 </div>
 </div>
 )})}
 </div>
 )}
 </div>
 </div>

 {/* Правая колонка */}
 <div className="space-y-4">

 {/* Статус */}
 <div className="hp-card p-5">
 <h2 className="font-semibold text-foreground mb-3">Статус лида</h2>
 <LeadStatusSelect leadId={id} currentStatus={lead.status} />
 </div>

 {/* Детали */}
 <div className="hp-card p-5">
 <h2 className="font-semibold text-foreground mb-4">Детали</h2>
 <div className="space-y-2.5 text-sm">
 {assignee?.full_name && (
 <div className="flex justify-between">
 <span className="text-muted-foreground">Ответственный</span>
 <span className="text-foreground font-medium">{assignee.full_name}</span>
 </div>
 )}
 {lead.next_contact_at && (
 <div className="flex justify-between items-start">
 <span className="text-muted-foreground">След. контакт</span>
 <span className={`font-medium text-right ${isOverdue ? 'text-red-600' : 'text-foreground'}`}>
 {new Date(lead.next_contact_at).toLocaleDateString('ru-RU', {
 day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
 })}
 </span>
 </div>
 )}
 <div className="flex justify-between">
 <span className="text-muted-foreground">Добавлен</span>
 <span className="text-foreground">{new Date(lead.created_at).toLocaleDateString('ru-RU')}</span>
 </div>
 {lead.updated_at && (
 <div className="flex justify-between">
 <span className="text-muted-foreground">Обновлён</span>
 <span className="text-foreground">{new Date(lead.updated_at).toLocaleDateString('ru-RU')}</span>
 </div>
 )}
 </div>
 </div>

 {/* Быстрые действия */}
 {!isConverted && (
 <div className="hp-card p-4 space-y-2">
 <Link href={`/deals/new?client_id=${id}`}
 className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition">
 <Zap className="w-4 h-4" />
 Создать сделку
 </Link>
 <Link href={`/tasks/new?lead_id=${id}`}
 className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-border text-sm font-medium hover:bg-accent transition">
 <Plus className="w-4 h-4" />
 Добавить задачу
 </Link>
 </div>
 )}
 </div>
 </div>
 </div>
 )
}
