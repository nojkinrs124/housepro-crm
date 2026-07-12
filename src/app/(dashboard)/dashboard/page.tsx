import { createClient } from '@/lib/supabase/server'
import {
  Users, Home, FileText, CheckSquare, TrendingUp,
  Zap, Clock, DollarSign, AlertTriangle, ArrowUpRight,
  Calendar, Banknote, Wallet
} from 'lucide-react'
import Link from 'next/link'
import { DashboardKpiCards } from '@/features/dashboard/components/DashboardKpiCards'
import { PageHeader } from '@/components/layout/PageHeader'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const now = new Date().toISOString()

  const [
    { count: contactsCount },
    { count: propertiesCount },
    { count: contractsCount },
    { count: activeTasksCount },
    { count: newLeadsCount },
    { count: activeDealsCount },
    { count: overdueTasksCount },
    { count: overduePaymentsCount },
    { data: dealsByStatus },
    { data: paymentStats },
    { data: recentContacts },
    { data: recentDeals },
    { data: myTasks },
    { data: overduePaymentsList },
    { data: upcomingDeadlines },
  ] = await Promise.all([
    supabase.from('contacts').select('id', { count: 'exact', head: true }),
    supabase.from('properties').select('id', { count: 'exact', head: true }).eq('status', 'available'),
    supabase.from('contracts').select('id', { count: 'exact', head: true }).eq('status', 'signed'),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).not('status', 'in', '(done,cancelled)'),
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'new'),
    supabase.from('deals').select('id', { count: 'exact', head: true }).not('status', 'in', '(completed,cancelled)'),
    supabase.from('tasks').select('id', { count: 'exact', head: true })
      .lt('deadline', now).not('status', 'in', '(done,cancelled)'),
    supabase.from('payments').select('id', { count: 'exact', head: true })
      .eq('payment_status', 'overdue'),
    supabase.from('deals').select('status'),
    supabase.from('payments')
      .select('amount, payment_status')
      .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    supabase.from('contacts').select('id, full_name, phone, role, status, created_at')
      .order('created_at', { ascending: false }).limit(5),
    supabase.from('deals').select('id, deal_type, status, amount, created_at, owner_contact:contacts!deals_owner_contact_id_fkey(full_name), client_contact:contacts!deals_client_contact_id_fkey(full_name)')
      .order('created_at', { ascending: false }).limit(5),
    supabase.from('tasks').select('id, title, priority, deadline, status')
      .eq('assigned_to', user?.id ?? '')
      .not('status', 'in', '(done,cancelled)')
      .order('deadline', { ascending: true }).limit(6),
    supabase.from('payments').select('id, amount, payment_type, due_date, contract:contracts(contract_number)')
      .eq('payment_status', 'overdue')
      .order('due_date', { ascending: true }).limit(4),
    supabase.from('tasks').select('id, title, priority, deadline')
      .gte('deadline', now)
      .lte('deadline', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
      .not('status', 'in', '(done,cancelled)')
      .order('deadline', { ascending: true }).limit(5),
  ])

  const paidThisMonth = (paymentStats ?? [])
    .filter(p => p.payment_status === 'paid')
    .reduce((s, p) => s + Number(p.amount ?? 0), 0)
  const pendingThisMonth = (paymentStats ?? [])
    .filter(p => ['pending', 'partial'].includes(p.payment_status))
    .reduce((s, p) => s + Number(p.amount ?? 0), 0)

  const funnelStages = [
    { key: 'new',         label: 'Новые',      color: '#60A5FA', bg: 'rgba(96,165,250,0.12)' },
    { key: 'showing',     label: 'Показы',     color: '#FBBF24', bg: 'rgba(251,191,36,0.12)' },
    { key: 'negotiation', label: 'Переговоры', color: '#F97316', bg: 'rgba(249,115,22,0.12)' },
    { key: 'contract',    label: 'Договор',    color: '#A78BFA', bg: 'rgba(167,139,250,0.12)' },
    { key: 'payment',     label: 'Оплата',     color: '#22D3EE', bg: 'rgba(34,211,238,0.12)' },
    { key: 'completed',   label: 'Завершено',  color: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
  ]
  const dealCounts = Object.fromEntries(
    funnelStages.map(s => [s.key, (dealsByStatus ?? []).filter(d => d.status === s.key).length])
  )
  const maxDeals = Math.max(...Object.values(dealCounts), 1)

  const roleLabels: Record<string, string> = { client: 'Клиент', owner: 'Собственник', both: 'Кл.+Собств.' }
  const dealTypeLabels: Record<string, string> = {
    rent: 'Аренда', sale: 'Продажа', management: 'Управление', commercial: 'Коммерция', subrent: 'Субаренда',
  }
  const dealStatusColors: Record<string, string> = {
    new: 'bg-blue-50 text-blue-700', showing: 'bg-yellow-50 text-yellow-700',
    negotiation: 'bg-orange-50 text-orange-700', contract: 'bg-purple-50 text-purple-700',
    payment: 'bg-cyan-50 text-cyan-700', completed: 'bg-green-50 text-green-700',
    cancelled: 'bg-gray-50 text-gray-500',
  }
  const dealStatusLabels: Record<string, string> = {
    new: 'Новая', showing: 'Показ', negotiation: 'Переговоры',
    contract: 'Договор', payment: 'Оплата', completed: 'Завершена', cancelled: 'Отменена',
  }
  const priorityColors: Record<string, { bg: string; text: string; dot: string }> = {
    low:    { bg: 'bg-slate-50',  text: 'text-slate-600', dot: 'bg-slate-400' },
    medium: { bg: 'bg-amber-50',  text: 'text-amber-700', dot: 'bg-amber-400' },
    high:   { bg: 'bg-red-50',    text: 'text-red-600',   dot: 'bg-red-400' },
  }
  const priorityLabels: Record<string, string> = { low: 'Низкий', medium: 'Средний', high: 'Высокий' }
  const contactStatusColors: Record<string, string> = {
    new: 'bg-slate-50 text-slate-600', active: 'bg-blue-50 text-blue-700',
    vip: 'bg-amber-50 text-amber-700', inactive: 'bg-red-50 text-red-500',
  }
  const contactStatusLabels: Record<string, string> = {
    new: 'Новый', active: 'Активный', vip: 'VIP', inactive: 'Неактивный',
  }

  const today = new Date()
  const todayStr = today.toLocaleDateString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const kpiData = [
    { title: 'Новые лиды',       value: newLeadsCount ?? 0,    icon: 'Zap',         color: '#3B82F6', iconBg: 'rgba(59,130,246,0.1)', href: '/leads',      trend: '+12%', trendPos: true },
    { title: 'Активных сделок',  value: activeDealsCount ?? 0,  icon: 'TrendingUp',  color: '#16A34A', iconBg: 'rgba(22,163,74,0.1)',  href: '/deals',      trend: '+8%',  trendPos: true },
    { title: 'Контактов',        value: contactsCount ?? 0,    icon: 'Users',       color: '#8B5CF6', iconBg: 'rgba(139,92,246,0.1)', href: '/contacts',   trend: '+5%',  trendPos: true },
    { title: 'Своб. объектов',   value: propertiesCount ?? 0,  icon: 'Home',        color: '#10B981', iconBg: 'rgba(16,185,129,0.1)', href: '/properties', trend: '0%',   trendPos: null },
    { title: 'Активных догов.',  value: contractsCount ?? 0,   icon: 'FileText',    color: '#F59E0B', iconBg: 'rgba(245,158,11,0.1)', href: '/contracts',  trend: '+3%',  trendPos: true },
    { title: 'Задач в работе',   value: activeTasksCount ?? 0,  icon: 'CheckSquare', color: '#EF4444', iconBg: 'rgba(239,68,68,0.1)',  href: '/tasks',      trend: '-2%',  trendPos: false },
  ]

  return (
    <div className="space-y-6">

      {/* Page Header */}
      <PageHeader
        title="Дашборд"
        subtitle={<span className="capitalize">{todayStr}</span>}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {(overdueTasksCount ?? 0) > 0 && (
              <Link href="/tasks" className="flex items-center gap-2 px-4 py-2 rounded-[12px] text-sm font-semibold bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition-colors">
                <AlertTriangle style={{ width: 14, height: 14 }} />
                {overdueTasksCount} просроч. задач
              </Link>
            )}
            {(overduePaymentsCount ?? 0) > 0 && (
              <Link href="/payments" className="flex items-center gap-2 px-4 py-2 rounded-[12px] text-sm font-semibold bg-orange-50 text-orange-600 border border-orange-100 hover:bg-orange-100 transition-colors">
                <DollarSign style={{ width: 14, height: 14 }} />
                {overduePaymentsCount} просроч. платежей
              </Link>
            )}
          </div>
        }
      />

      {/* KPI Cards — animated client component */}
      <DashboardKpiCards cards={kpiData} />

      {/* Finance + Funnel */}
      <div className="grid lg:grid-cols-2 gap-4">

        {/* Finance */}
        <div className="bg-white rounded-[20px] border border-slate-100 p-5 h-full flex flex-col" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-bold text-foreground text-[16px] tracking-tight">Финансы</h2>
              <p className="text-xs text-muted-foreground mt-0.5 font-medium">Текущий месяц</p>
            </div>
            <Link href="/payments" className="flex items-center gap-1 text-xs text-[#16A34A] font-semibold hover:underline">
              Подробнее <ArrowUpRight style={{ width: 13, height: 13 }} />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-5">
            {/* Paid */}
            <div className="p-4 rounded-[16px] relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)', border: '1px solid rgba(34,197,94,0.15)' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/80">
                  <Banknote style={{ width: 15, height: 15, color: '#16A34A' }} />
                </div>
                <p className="text-xs font-semibold text-green-700">Получено</p>
              </div>
              <p className="text-xl font-bold text-foreground">
                {paidThisMonth.toLocaleString('ru-RU')} ₽
              </p>
            </div>
            {/* Pending */}
            <div className="p-4 rounded-[16px] relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)', border: '1px solid rgba(245,158,11,0.15)' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/80">
                  <Wallet style={{ width: 15, height: 15, color: '#F59E0B' }} />
                </div>
                <p className="text-xs font-semibold text-amber-700">Ожидается</p>
              </div>
              <p className="text-xl font-bold text-foreground">
                {pendingThisMonth.toLocaleString('ru-RU')} ₽
              </p>
            </div>
          </div>

          {(overduePaymentsList?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-bold text-red-600 mb-3 flex items-center gap-1.5">
                <AlertTriangle style={{ width: 12, height: 12 }} />
                Просроченные платежи
              </p>
              <div className="space-y-2">
                {overduePaymentsList!.map(p => (
                  <Link key={p.id} href={`/payments/${p.id}/edit`}
                    className="flex items-center justify-between px-4 py-3 rounded-[12px] border transition-all hover:-translate-y-0.5"
                    style={{ background: '#FFF5F5', borderColor: 'rgba(239,68,68,0.15)' }}>
                    <div>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <p className="text-xs font-bold text-foreground">{(p.contract as any)?.contract_number ?? 'Без договора'}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {p.due_date ? new Date(p.due_date).toLocaleDateString('ru-RU') : '—'}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-red-600">{Number(p.amount).toLocaleString('ru-RU')} ₽</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Funnel */}
        <div className="bg-white rounded-[20px] border border-slate-100 p-5 h-full flex flex-col" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-bold text-foreground text-[16px] tracking-tight">Воронка сделок</h2>
              <p className="text-xs text-muted-foreground mt-0.5 font-medium">По стадиям</p>
            </div>
            <Link href="/deals" className="flex items-center gap-1 text-xs text-[#16A34A] font-semibold hover:underline">
              Все сделки <ArrowUpRight style={{ width: 13, height: 13 }} />
            </Link>
          </div>
          <div className="space-y-3">
            {funnelStages.map(stage => {
              const count = dealCounts[stage.key] ?? 0
              const pct = Math.round((count / maxDeals) * 100)
              return (
                <div key={stage.key} className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-muted-foreground w-24 shrink-0">{stage.label}</span>
                  <div className="flex-1 h-8 rounded-[10px] overflow-hidden" style={{ background: '#F8FAFC' }}>
                    <div
                      className="h-full flex items-center justify-end pr-3 rounded-[10px] transition-all duration-700"
                      style={{
                        width: count > 0 ? `${Math.max(pct, 8)}%` : '0%',
                        background: count > 0 ? stage.color : 'transparent',
                        minWidth: count > 0 ? '32px' : '0',
                      }}
                    >
                      {count > 0 && <span className="text-white text-xs font-bold">{count}</span>}
                    </div>
                  </div>
                  {count === 0 && <span className="text-xs text-slate-300 font-medium w-4">0</span>}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* 3-column */}
      <div className="grid lg:grid-cols-3 gap-4">

        {/* Recent contacts */}
        <div className="bg-white rounded-[20px] border border-slate-100 p-5 h-full flex flex-col" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-foreground text-[15px]">Последние контакты</h2>
            <Link href="/contacts" className="text-xs text-[#16A34A] font-semibold flex items-center gap-0.5 hover:underline">
              Все <ArrowUpRight style={{ width: 12, height: 12 }} />
            </Link>
          </div>
          {!recentContacts?.length ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-3">
                <Users style={{ width: 20, height: 20 }} className="text-slate-300" />
              </div>
              <p className="text-sm text-muted-foreground">Нет контактов</p>
              <Link href="/contacts/new" className="text-xs text-[#16A34A] hover:underline mt-1 block font-semibold">+ Добавить</Link>
            </div>
          ) : (
            <div className="space-y-1">
              {recentContacts.map(c => (
                <Link key={c.id} href={`/contacts/${c.id}`}
                  className="flex items-center justify-between p-2.5 rounded-[12px] hover:bg-background transition-colors group">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold"
                      style={{ background: 'var(--hp-gradient-primary)' }}>
                      {c.full_name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate group-hover:text-[#16A34A] transition-colors">{c.full_name}</p>
                      <p className="text-xs text-muted-foreground">{roleLabels[c.role] ?? c.role}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${contactStatusColors[c.status] ?? 'bg-slate-50 text-slate-600'}`}>
                    {contactStatusLabels[c.status] ?? c.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent deals */}
        <div className="bg-white rounded-[20px] border border-slate-100 p-5 h-full flex flex-col" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-foreground text-[15px]">Последние сделки</h2>
            <Link href="/deals" className="text-xs text-[#16A34A] font-semibold flex items-center gap-0.5 hover:underline">
              Все <ArrowUpRight style={{ width: 12, height: 12 }} />
            </Link>
          </div>
          {!recentDeals?.length ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-3">
                <TrendingUp style={{ width: 20, height: 20 }} className="text-slate-300" />
              </div>
              <p className="text-sm text-muted-foreground">Нет сделок</p>
              <Link href="/deals/new" className="text-xs text-[#16A34A] hover:underline mt-1 block font-semibold">+ Создать</Link>
            </div>
          ) : (
            <div className="space-y-1">
              {recentDeals.map(d => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const clientName = (d.client_contact as any)?.full_name ?? (d.owner_contact as any)?.full_name
                return (
                  <Link key={d.id} href={`/deals/${d.id}`}
                    className="flex items-center justify-between p-2.5 rounded-[12px] hover:bg-background transition-colors group">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground group-hover:text-[#16A34A] transition-colors">{dealTypeLabels[d.deal_type] ?? d.deal_type}</p>
                      <p className="text-xs text-muted-foreground truncate">{clientName ?? new Date(d.created_at).toLocaleDateString('ru-RU')}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold block ${dealStatusColors[d.status] ?? 'bg-gray-50'}`}>
                        {dealStatusLabels[d.status] ?? d.status}
                      </span>
                      {d.amount && <p className="text-xs text-muted-foreground mt-0.5 font-medium">{Number(d.amount).toLocaleString('ru-RU')} ₽</p>}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* My tasks */}
        <div className="bg-white rounded-[20px] border border-slate-100 p-5 h-full flex flex-col" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-foreground text-[15px]">Мои задачи</h2>
            <Link href="/tasks" className="text-xs text-[#16A34A] font-semibold flex items-center gap-0.5 hover:underline">
              Все <ArrowUpRight style={{ width: 12, height: 12 }} />
            </Link>
          </div>
          {!myTasks?.length ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-3">
                <CheckSquare style={{ width: 20, height: 20 }} className="text-slate-300" />
              </div>
              <p className="text-sm text-muted-foreground">Нет активных задач</p>
              <Link href="/tasks/new" className="text-xs text-[#16A34A] hover:underline mt-1 block font-semibold">+ Создать задачу</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {myTasks.map(task => {
                const isOverdue = task.deadline && new Date(task.deadline) < new Date()
                const pr = priorityColors[task.priority] ?? priorityColors.low
                return (
                  <Link key={task.id} href={`/tasks/${task.id}`}>
                    <div
                      className="p-3 rounded-[12px] border transition-all hover:-translate-y-0.5 cursor-pointer"
                      style={isOverdue
                        ? { background: '#FFF5F5', borderColor: 'rgba(239,68,68,0.2)' }
                        : { background: '#F8FAFC', borderColor: 'rgba(214,219,235,0.5)' }}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground leading-snug">{task.title}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 flex items-center gap-1 ${pr.bg} ${pr.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${pr.dot}`} />
                          {priorityLabels[task.priority] ?? task.priority}
                        </span>
                      </div>
                      {task.deadline && (
                        <div className={`flex items-center gap-1 mt-1.5 text-xs font-semibold ${isOverdue ? 'text-red-600' : 'text-muted-foreground'}`}>
                          <Clock style={{ width: 11, height: 11 }} />
                          {new Date(task.deadline).toLocaleDateString('ru-RU')}
                        </div>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}

          {(upcomingDeadlines?.length ?? 0) > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs font-bold text-muted-foreground mb-2.5 flex items-center gap-1.5 uppercase tracking-wide">
                <Calendar style={{ width: 11, height: 11 }} />
                Дедлайны · 7 дней
              </p>
              <div className="space-y-1.5">
                {upcomingDeadlines!.map(t => (
                  <div key={t.id} className="flex items-center justify-between text-xs">
                    <span className="text-[#374151] truncate max-w-32 font-medium">{t.title}</span>
                    <span className="text-slate-400 shrink-0 ml-2 font-medium">
                      {t.deadline ? new Date(t.deadline).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="p-6 rounded-[20px] relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #F0FDF4 0%, #ECFDF5 100%)', border: '1px solid rgba(34,197,94,0.15)' }}>
        {/* Background decoration */}
        <div className="absolute right-0 top-0 w-48 h-48 opacity-5"
          style={{ background: 'radial-gradient(circle, #16A34A 0%, transparent 70%)', transform: 'translate(25%, -25%)' }} />
        <div className="flex items-center justify-between flex-wrap gap-4 relative">
          <div>
            <h3 className="font-bold text-foreground text-[16px] tracking-tight">Быстрые действия</h3>
            <p className="text-sm text-muted-foreground mt-0.5">Создайте новую запись одним кликом</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { label: '+ Лид',     href: '/leads/new',      bg: '#3B82F6' },
              { label: '+ Контакт', href: '/contacts/new',   bg: '#8B5CF6' },
              { label: '+ Объект',  href: '/properties/new', bg: '#10B981' },
              { label: '+ Договор', href: '/contracts/new',  bg: '#F59E0B' },
              { label: '+ Сделка',  href: '/deals/new',      bg: '#16A34A' },
            ].map(a => (
              <Link key={a.href} href={a.href}
                className="px-4 py-2 text-white rounded-[12px] text-sm font-bold transition-all hover:-translate-y-0.5 hover:shadow-md"
                style={{ background: a.bg }}>
                {a.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}
