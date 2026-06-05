import { createClient } from '@/lib/supabase/server'
import {
  Users, Home, FileText, CheckSquare, TrendingUp,
  Zap, Clock, DollarSign, AlertTriangle, ArrowUpRight,
  Calendar, ArrowUp, Banknote, Wallet
} from 'lucide-react'
import Link from 'next/link'

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
    { key: 'new',         label: 'Новые',      color: '#60A5FA' },
    { key: 'showing',     label: 'Показы',     color: '#FBBF24' },
    { key: 'negotiation', label: 'Переговоры', color: '#F97316' },
    { key: 'contract',    label: 'Договор',    color: '#A78BFA' },
    { key: 'payment',     label: 'Оплата',     color: '#22D3EE' },
    { key: 'completed',   label: 'Завершено',  color: '#22C55E' },
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
  const priorityColors: Record<string, string> = {
    low: 'bg-slate-50 text-slate-600', medium: 'bg-amber-50 text-amber-700', high: 'bg-red-50 text-red-600',
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

  const cardStyle = {
    background: '#ffffff',
    borderRadius: '20px',
    border: '1px solid rgba(214,219,235,0.6)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05)',
  }

  return (
    <div className="space-y-8">

      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111827] tracking-tight">Дашборд</h1>
          <p className="text-[#64748B] mt-1 text-sm capitalize">{todayStr}</p>
        </div>
        <div className="flex items-center gap-2">
          {(overdueTasksCount ?? 0) > 0 && (
            <Link href="/tasks"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-sm font-medium transition-all"
              style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid rgba(220,38,38,0.15)' }}>
              <AlertTriangle style={{ width: 14, height: 14 }} />
              {overdueTasksCount} просроченных задач
            </Link>
          )}
          {(overduePaymentsCount ?? 0) > 0 && (
            <Link href="/payments"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-sm font-medium transition-all"
              style={{ background: '#FFF7ED', color: '#C2410C', border: '1px solid rgba(194,65,12,0.15)' }}>
              <DollarSign style={{ width: 14, height: 14 }} />
              {overduePaymentsCount} просроченных платежей
            </Link>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          { title: 'Новые лиды',       value: newLeadsCount ?? 0,   icon: Zap,         iconBg: '#EFF6FF', iconColor: '#3B82F6', href: '/leads',      trend: '+12%' },
          { title: 'Активных сделок',  value: activeDealsCount ?? 0, icon: TrendingUp,  iconBg: '#F0FDF4', iconColor: '#16A34A', href: '/deals',      trend: '+8%' },
          { title: 'Контактов',        value: contactsCount ?? 0,   icon: Users,       iconBg: '#F5F3FF', iconColor: '#7C3AED', href: '/contacts',   trend: '+5%' },
          { title: 'Свободных объект.',value: propertiesCount ?? 0, icon: Home,        iconBg: '#ECFDF5', iconColor: '#059669', href: '/properties', trend: '0%' },
          { title: 'Активных догов.',  value: contractsCount ?? 0,  icon: FileText,    iconBg: '#FFF7ED', iconColor: '#EA580C', href: '/contracts',  trend: '+3%' },
          { title: 'Задач в работе',   value: activeTasksCount ?? 0, icon: CheckSquare, iconBg: '#FFF1F2', iconColor: '#E11D48', href: '/tasks',      trend: '-2%' },
        ].map(card => {
          const Icon = card.icon
          return (
            <Link key={card.title} href={card.href}
              className="group p-5 transition-all duration-300"
              style={{
                ...cardStyle,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
                ;(e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.06), 0 12px 32px rgba(0,0,0,0.08)'
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
                ;(e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05)'
              }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-[12px] flex items-center justify-center"
                  style={{ background: card.iconBg }}>
                  <Icon style={{ width: 18, height: 18, color: card.iconColor }} />
                </div>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    background: card.trend.startsWith('+') ? '#F0FDF4' : card.trend === '0%' ? '#F8FAFC' : '#FFF1F2',
                    color: card.trend.startsWith('+') ? '#16A34A' : card.trend === '0%' ? '#64748B' : '#E11D48',
                  }}>
                  {card.trend}
                </span>
              </div>
              <p className="text-3xl font-bold text-[#111827] leading-none">{card.value}</p>
              <p className="text-xs text-[#64748B] mt-1.5 leading-snug font-medium">{card.title}</p>
            </Link>
          )
        })}
      </div>

      {/* Finance + Funnel */}
      <div className="grid lg:grid-cols-2 gap-6">

        {/* Finance */}
        <div style={cardStyle} className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-[#111827] text-[15px]">Финансы — текущий месяц</h2>
            <Link href="/payments" className="text-xs text-[#16A34A] font-medium flex items-center gap-0.5 hover:underline">
              Подробнее <ArrowUpRight style={{ width: 12, height: 12 }} />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: 'Получено', value: paidThisMonth, icon: Banknote, bg: 'linear-gradient(135deg, #F0FDF4, #DCFCE7)', color: '#16A34A', iconColor: '#22C55E' },
              { label: 'Ожидается', value: pendingThisMonth, icon: Wallet, bg: 'linear-gradient(135deg, #FFFBEB, #FEF3C7)', color: '#D97706', iconColor: '#F59E0B' },
            ].map(item => {
              const Icon = item.icon
              return (
                <div key={item.label} className="p-4 rounded-[16px]" style={{ background: item.bg }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon style={{ width: 15, height: 15, color: item.iconColor }} />
                    <p className="text-xs font-semibold" style={{ color: item.color }}>{item.label}</p>
                  </div>
                  <p className="text-xl font-bold" style={{ color: item.color }}>
                    {item.value.toLocaleString('ru-RU')} ₽
                  </p>
                </div>
              )
            })}
          </div>

          {(overduePaymentsList?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-semibold text-[#DC2626] mb-2 flex items-center gap-1.5">
                <AlertTriangle style={{ width: 13, height: 13 }} />
                Просроченные платежи
              </p>
              <div className="space-y-1.5">
                {overduePaymentsList!.map(p => (
                  <Link key={p.id} href={`/payments/${p.id}/edit`}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-[12px] transition-all"
                    style={{ background: '#FEF2F2', border: '1px solid rgba(220,38,38,0.1)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#FEE2E2'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#FEF2F2'}
                  >
                    <div>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <p className="text-xs font-semibold text-[#111827]">{(p.contract as any)?.contract_number ?? 'Без договора'}</p>
                      <p className="text-xs text-[#64748B] mt-0.5">
                        {p.due_date ? new Date(p.due_date).toLocaleDateString('ru-RU') : '—'}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-[#DC2626]">{Number(p.amount).toLocaleString('ru-RU')} ₽</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Funnel */}
        <div style={cardStyle} className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-[#111827] text-[15px]">Воронка сделок</h2>
            <Link href="/deals" className="text-xs text-[#16A34A] font-medium flex items-center gap-0.5 hover:underline">
              Все сделки <ArrowUpRight style={{ width: 12, height: 12 }} />
            </Link>
          </div>
          <div className="space-y-3">
            {funnelStages.map(stage => {
              const count = dealCounts[stage.key] ?? 0
              const pct = Math.round((count / maxDeals) * 100)
              return (
                <div key={stage.key} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-[#64748B] w-24 shrink-0">{stage.label}</span>
                  <div className="flex-1 h-7 rounded-[8px] overflow-hidden" style={{ background: '#F1F5F9' }}>
                    <div
                      className="h-full flex items-center justify-end pr-2.5 rounded-[8px] transition-all duration-700"
                      style={{
                        width: count > 0 ? `${Math.max(pct, 10)}%` : '0%',
                        background: count > 0 ? stage.color : 'transparent',
                        opacity: 0.9,
                      }}
                    >
                      {count > 0 && <span className="text-white text-xs font-bold">{count}</span>}
                    </div>
                  </div>
                  {count === 0 && <span className="text-xs text-[#94A3B8] font-medium w-4">0</span>}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* 3-column content */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* Recent contacts */}
        <div style={cardStyle} className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[#111827] text-[15px]">Последние контакты</h2>
            <Link href="/contacts" className="text-xs text-[#16A34A] font-medium flex items-center gap-0.5 hover:underline">
              Все <ArrowUpRight style={{ width: 12, height: 12 }} />
            </Link>
          </div>
          {!recentContacts?.length ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-[#F1F5F9] flex items-center justify-center mx-auto mb-3">
                <Users style={{ width: 20, height: 20, color: '#94A3B8' }} />
              </div>
              <p className="text-sm text-[#64748B]">Нет контактов</p>
              <Link href="/contacts/new" className="text-xs text-[#16A34A] hover:underline mt-1 block font-medium">+ Добавить</Link>
            </div>
          ) : (
            <div className="space-y-1">
              {recentContacts.map(c => (
                <Link key={c.id} href={`/contacts/${c.id}`}
                  className="flex items-center justify-between p-2.5 rounded-[12px] transition-all"
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F8FAFC'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-semibold"
                      style={{ background: 'linear-gradient(135deg, #16A34A, #22C55E)' }}>
                      {c.full_name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#111827] truncate">{c.full_name}</p>
                      <p className="text-xs text-[#64748B]">{roleLabels[c.role] ?? c.role}</p>
                    </div>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${contactStatusColors[c.status] ?? 'bg-slate-50 text-slate-600'}`}>
                    {contactStatusLabels[c.status] ?? c.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent deals */}
        <div style={cardStyle} className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[#111827] text-[15px]">Последние сделки</h2>
            <Link href="/deals" className="text-xs text-[#16A34A] font-medium flex items-center gap-0.5 hover:underline">
              Все <ArrowUpRight style={{ width: 12, height: 12 }} />
            </Link>
          </div>
          {!recentDeals?.length ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-[#F1F5F9] flex items-center justify-center mx-auto mb-3">
                <TrendingUp style={{ width: 20, height: 20, color: '#94A3B8' }} />
              </div>
              <p className="text-sm text-[#64748B]">Нет сделок</p>
              <Link href="/deals/new" className="text-xs text-[#16A34A] hover:underline mt-1 block font-medium">+ Создать</Link>
            </div>
          ) : (
            <div className="space-y-1">
              {recentDeals.map(d => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const clientName = (d.client_contact as any)?.full_name ?? (d.owner_contact as any)?.full_name
                return (
                  <Link key={d.id} href={`/deals/${d.id}`}
                    className="flex items-center justify-between p-2.5 rounded-[12px] transition-all"
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F8FAFC'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#111827]">{dealTypeLabels[d.deal_type] ?? d.deal_type}</p>
                      <p className="text-xs text-[#64748B] truncate">{clientName ?? new Date(d.created_at).toLocaleDateString('ru-RU')}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold block ${dealStatusColors[d.status] ?? 'bg-gray-50'}`}>
                        {dealStatusLabels[d.status] ?? d.status}
                      </span>
                      {d.amount && <p className="text-xs text-[#64748B] mt-0.5">{Number(d.amount).toLocaleString('ru-RU')} ₽</p>}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* My tasks */}
        <div style={cardStyle} className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[#111827] text-[15px]">Мои задачи</h2>
            <Link href="/tasks" className="text-xs text-[#16A34A] font-medium flex items-center gap-0.5 hover:underline">
              Все <ArrowUpRight style={{ width: 12, height: 12 }} />
            </Link>
          </div>
          {!myTasks?.length ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-[#F1F5F9] flex items-center justify-center mx-auto mb-3">
                <CheckSquare style={{ width: 20, height: 20, color: '#94A3B8' }} />
              </div>
              <p className="text-sm text-[#64748B]">Нет активных задач</p>
              <Link href="/tasks/new" className="text-xs text-[#16A34A] hover:underline mt-1 block font-medium">+ Создать задачу</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {myTasks.map(task => {
                const isOverdue = task.deadline && new Date(task.deadline) < new Date()
                return (
                  <div key={task.id}
                    className="p-3 rounded-[12px]"
                    style={{
                      background: isOverdue ? '#FEF2F2' : '#F8FAFC',
                      border: isOverdue ? '1px solid rgba(220,38,38,0.15)' : '1px solid transparent',
                    }}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-[#111827] leading-snug">{task.title}</p>
                      <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${priorityColors[task.priority] ?? 'bg-slate-50 text-slate-600'}`}>
                        {priorityLabels[task.priority] ?? task.priority}
                      </span>
                    </div>
                    {task.deadline && (
                      <div className={`flex items-center gap-1 mt-1.5 text-xs font-medium ${isOverdue ? 'text-[#DC2626]' : 'text-[#64748B]'}`}>
                        <Clock style={{ width: 11, height: 11 }} />
                        {isOverdue ? '⚠ ' : ''}{new Date(task.deadline).toLocaleDateString('ru-RU')}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {(upcomingDeadlines?.length ?? 0) > 0 && (
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(214,219,235,0.6)' }}>
              <p className="text-xs font-semibold text-[#64748B] mb-2.5 flex items-center gap-1.5">
                <Calendar style={{ width: 12, height: 12 }} />
                Дедлайны на 7 дней
              </p>
              <div className="space-y-1.5">
                {upcomingDeadlines!.map(t => (
                  <div key={t.id} className="flex items-center justify-between text-xs">
                    <span className="text-[#374151] truncate max-w-32 font-medium">{t.title}</span>
                    <span className="text-[#94A3B8] shrink-0 ml-2">
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
      <div
        className="p-6 rounded-[20px]"
        style={{
          background: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 50%, #F0FDF4 100%)',
          border: '1px solid rgba(34,197,94,0.2)',
        }}
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="font-bold text-[#111827] text-[15px]">Быстрые действия</h3>
            <p className="text-sm text-[#64748B] mt-0.5">Создайте новую запись одним кликом</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { label: '+ Лид',     href: '/leads/new',      bg: '#3B82F6' },
              { label: '+ Контакт', href: '/contacts/new',   bg: '#7C3AED' },
              { label: '+ Объект',  href: '/properties/new', bg: '#059669' },
              { label: '+ Договор', href: '/contracts/new',  bg: '#EA580C' },
              { label: '+ Сделка',  href: '/deals/new',      bg: '#16A34A' },
            ].map(a => (
              <Link key={a.href} href={a.href}
                className="px-4 py-2 text-white rounded-[10px] text-sm font-semibold transition-all duration-200"
                style={{ background: a.bg, boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'}
              >
                {a.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}
