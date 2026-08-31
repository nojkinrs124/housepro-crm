import { createClient } from '@/lib/supabase/server'
import { Bell, CheckCheck } from 'lucide-react'
import { markAllNotificationsReadAction, markNotificationReadAction } from './notifications.actions'
import { PageHeader } from '@/components/layout/PageHeader'

const typeColors: Record<string, string> = {
 overdue_payment: 'bg-[var(--hp-danger-tint)] text-[var(--hp-danger)]',
 overdue_task: 'bg-[var(--hp-warn-tint)] text-[var(--hp-warn)]',
 new_lead: 'bg-[var(--hp-info-tint)] text-[var(--hp-info)]',
 deal_status: 'bg-[var(--hp-good-tint)] text-[var(--hp-good)]',
 contract_expiry: 'bg-[var(--hp-warn-tint)] text-[var(--hp-warn)]',
}
const typeLabels: Record<string, string> = {
 overdue_payment: 'Платёж', overdue_task: 'Задача',
 new_lead: 'Лид', deal_status: 'Сделка', contract_expiry: 'Договор',
}
const entityHref: Record<string, (id: string) => string> = {
 payment: id => `/payments/${id}/edit`,
 contract: id => `/contracts/${id}`,
 task: id => `/tasks`,
 deal: id => `/deals/${id}`,
 lead: id => `/leads`,
}

export default async function NotificationsPage() {
 const supabase = await createClient()
 const { data: { user } } = await supabase.auth.getUser()

 const { data: notifications } = await supabase
 .from('notifications')
 .select('*')
 .eq('user_id', user?.id ?? '')
 .order('created_at', { ascending: false })
 .limit(50)

 const unreadCount = (notifications ?? []).filter(n => !n.is_read).length

 return (
 <div className="max-w-2xl mx-auto space-y-6">
 <PageHeader
 title="Уведомления"
 subtitle={unreadCount > 0 ? `${unreadCount} непрочитанных` : undefined}
 backHref="/settings"
 backLabel="Вернуться к настройкам"
 iconBg="bg-[var(--hp-warn-tint)]"
 icon={<Bell className="text-[var(--hp-warn)]" style={{ width: 20, height: 20 }} />}
 actions={
 unreadCount > 0 ? (
 <form action={markAllNotificationsReadAction}>
 <button type="submit"
 className="flex items-center gap-2 px-4 py-2 hp-card text-sm font-semibold text-[var(--hp-ink)] hover:bg-[var(--hp-neutral-tint)] transition-all">
 <CheckCheck style={{ width: 15, height: 15 }} />
 Прочитать все
 </button>
 </form>
 ) : undefined
 }
 />

 {!notifications?.length ? (
 <div className="hp-card p-12 text-center" style={{ }}>
 <div className="w-14 h-14 flex items-center justify-center mx-auto mb-4"
 style={{ background: 'linear-gradient(135deg, rgba(22,163,74,0.1), rgba(34,197,94,0.1))' }}>
 <Bell style={{ width: 24, height: 24, color: 'var(--hp-accent)' }} />
 </div>
 <p className="font-bold text-foreground text-base">Уведомлений нет</p>
 <p className="text-muted-foreground text-sm mt-1">Все актуально — продолжайте работу</p>
 </div>
 ) : (
 <div className="hp-card overflow-hidden" style={{ }}>
 <div className="divide-y divide-[var(--hp-border-soft)]">
 {notifications.map(n => {
 const href = n.entity_type && n.entity_id ? entityHref[n.entity_type]?.(n.entity_id) : null
 const Inner = (
 <div className={`flex items-start gap-4 px-5 py-4 hover:bg-background transition-all duration-200 ${!n.is_read ? 'bg-[var(--hp-good-tint)]/30' : ''}`}>
 <div className="shrink-0 mt-0.5">
 <span className={`text-[10px] px-2 py-0.5 rounded-[var(--hp-radius-badge)] font-bold ${typeColors[n.type] ?? 'bg-[var(--hp-neutral-tint)] text-[var(--hp-sub)]'}`}>
 {typeLabels[n.type] ?? n.type}
 </span>
 </div>
 <div className="flex-1 min-w-0">
 <p className={`text-sm text-foreground ${!n.is_read ? 'font-semibold' : 'font-medium'}`}>{n.title}</p>
 {n.body && <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>}
 <p className="text-xs text-[var(--hp-tertiary)] mt-1">
 {new Date(n.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
 </p>
 </div>
 {!n.is_read && (
 <div className="w-2 h-2 rounded-full bg-[var(--hp-accent)] shrink-0 mt-1.5" />
 )}
 </div>
 )
 return href ? (
 <a key={n.id} href={href}>
 {Inner}
 </a>
 ) : (
 <div key={n.id}>{Inner}</div>
 )
 })}
 </div>
 </div>
 )}
 </div>
 )
}
