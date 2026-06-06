import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, Bell, CheckCheck } from 'lucide-react'
import Link from 'next/link'
import { markAllNotificationsReadAction, markNotificationReadAction } from './notifications.actions'

const typeColors: Record<string, string> = {
  overdue_payment:  'bg-red-100 text-red-700',
  overdue_task:     'bg-orange-100 text-orange-700',
  new_lead:         'bg-blue-100 text-blue-700',
  deal_status:      'bg-green-100 text-green-700',
  contract_expiry:  'bg-yellow-100 text-yellow-700',
}
const typeLabels: Record<string, string> = {
  overdue_payment: '💳 Платёж', overdue_task: '✅ Задача',
  new_lead: '⚡ Лид', deal_status: '📈 Сделка', contract_expiry: '📄 Договор',
}
const entityHref: Record<string, (id: string) => string> = {
  payment:  id => `/payments/${id}/edit`,
  contract: id => `/contracts/${id}`,
  task:     id => `/tasks`,
  deal:     id => `/deals/${id}`,
  lead:     id => `/leads`,
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
      <Link href="/settings" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition">
        <ArrowLeft className="w-4 h-4" />
        Вернуться к настройкам
      </Link>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
            <Bell className="w-5 h-5 text-yellow-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Уведомления</h1>
            {unreadCount > 0 && (
              <p className="text-sm text-muted-foreground">{unreadCount} непрочитанных</p>
            )}
          </div>
        </div>
        {unreadCount > 0 && (
          <form action={markAllNotificationsReadAction}>
            <button type="submit"
              className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-xl text-sm hover:bg-accent transition">
              <CheckCheck className="w-4 h-4" />
              Прочитать все
            </button>
          </form>
        )}
      </div>

      {!notifications?.length ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <Bell className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="font-semibold text-foreground">Уведомлений нет</p>
          <p className="text-muted-foreground text-sm mt-1">Все актуально — продолжайте работу</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="divide-y divide-border">
            {notifications.map(n => {
              const href = n.entity_type && n.entity_id ? entityHref[n.entity_type]?.(n.entity_id) : null
              const Inner = (
                <div className={`flex items-start gap-4 px-5 py-4 hover:bg-accent/30 transition ${!n.is_read ? 'bg-primary/3' : ''}`}>
                  <div className="shrink-0 mt-0.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColors[n.type] ?? 'bg-gray-100 text-gray-600'}`}>
                      {typeLabels[n.type] ?? n.type}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium text-foreground ${!n.is_read ? 'font-semibold' : ''}`}>{n.title}</p>
                    {n.body && <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(n.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {!n.is_read && (
                    <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
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
