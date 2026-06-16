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
      <Link href="/settings" className="inline-flex items-center gap-2 text-sm font-medium text-[#64748B] hover:text-[#111827] transition-colors">
        <ArrowLeft style={{ width: 16, height: 16 }} />
        Вернуться к настройкам
      </Link>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0 bg-amber-50">
            <Bell className="text-amber-600" style={{ width: 20, height: 20 }} />
          </div>
          <div>
            <h1 className="text-[28px] font-bold text-[#111827] tracking-tight leading-tight">Уведомления</h1>
            {unreadCount > 0 && (
              <p className="text-[#64748B] text-sm font-medium mt-0.5">{unreadCount} непрочитанных</p>
            )}
          </div>
        </div>
        {unreadCount > 0 && (
          <form action={markAllNotificationsReadAction}>
            <button type="submit"
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-[12px] text-sm font-semibold text-[#374151] hover:bg-slate-50 transition-all">
              <CheckCheck style={{ width: 15, height: 15 }} />
              Прочитать все
            </button>
          </form>
        )}
      </div>

      {!notifications?.length ? (
        <div className="bg-white rounded-[20px] border border-slate-100 p-12 text-center" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}>
          <div className="w-14 h-14 rounded-[20px] flex items-center justify-center mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg, rgba(22,163,74,0.1), rgba(34,197,94,0.1))' }}>
            <Bell style={{ width: 24, height: 24, color: '#16A34A' }} />
          </div>
          <p className="font-bold text-[#111827] text-base">Уведомлений нет</p>
          <p className="text-[#64748B] text-sm mt-1">Все актуально — продолжайте работу</p>
        </div>
      ) : (
        <div className="bg-white rounded-[20px] border border-slate-100 overflow-hidden" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}>
          <div className="divide-y divide-slate-100">
            {notifications.map(n => {
              const href = n.entity_type && n.entity_id ? entityHref[n.entity_type]?.(n.entity_id) : null
              const Inner = (
                <div className={`flex items-start gap-4 px-5 py-4 hover:bg-[#F8FAFC] transition-all duration-200 ${!n.is_read ? 'bg-green-50/30' : ''}`}>
                  <div className="shrink-0 mt-0.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${typeColors[n.type] ?? 'bg-gray-100 text-gray-600'}`}>
                      {typeLabels[n.type] ?? n.type}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm text-[#111827] ${!n.is_read ? 'font-semibold' : 'font-medium'}`}>{n.title}</p>
                    {n.body && <p className="text-xs text-[#64748B] mt-0.5">{n.body}</p>}
                    <p className="text-xs text-[#94A3B8] mt-1">
                      {new Date(n.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {!n.is_read && (
                    <div className="w-2 h-2 rounded-full bg-[#16A34A] shrink-0 mt-1.5" />
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
